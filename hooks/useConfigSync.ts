import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveAccount, TOKEN_STORAGE_KEY } from '../utils/storage';
import {
  RecurringBill,
  loadRecurringBills,
  saveRecurringBills,
} from '../services/recurringBills';
import {
  BillTemplate,
  loadTemplates,
  saveTemplates,
} from '../services/billTemplates';
import {
  DEFAULT_REMINDER_SETTINGS,
  loadReminderSettings,
  saveReminderSettings,
} from '../services/reminderSettings';
import {
  SyncItem,
  SyncMetaMap,
  configDirtyBus,
  getSyncItemKey,
  isSyncDirty,
  loadSyncMeta,
  loadSyncSince,
  loadTombstones,
  mergeSyncItems,
  pickReminderSettingsItem,
  pullConfigs,
  pushConfigs,
  saveSyncMeta,
  saveSyncSince,
  saveTombstones,
  setSyncDirty,
} from '../services/configSync';
import { traceAsync } from '../utils/perfTracing';

// ===== 本地配置云端同步编排 =====
//
// 时机：App 启动进入 Main / 回到前台 / 配置发生变更（configDirtyBus，防抖）。
// 流程：先拉取远端增量（LWW 合并落盘）→ 脏标记或首次同步时推送本地全量（含软删墓碑）。
// 首次同步会把本地已有配置推上云端，兼容存量用户（此前配置仅存本地）。
//
// 限流保护：两次完整同步之间有最小间隔，失败指数退避，冷却期内的触发合并为一次，
// 避免触发源异常（前后台抖动、接口持续失败等）造成请求风暴拖垮 App。

const DEBOUNCE_MS = 1500;
// 两次完整同步的最小间隔
const MIN_SYNC_INTERVAL_MS = 30 * 1000;
// 连续失败退避上限（30s → 60s → 120s ... 封顶 10 分钟）
const MAX_BACKOFF_MS = 10 * 60 * 1000;

/**
 * 应用拉取结果到本地（静默落盘，不触发推送回环），返回更新后的 meta。
 */
async function applyPulledItems(
  account: string,
  items: SyncItem[],
  meta: SyncMetaMap
): Promise<SyncMetaMap> {
  const nextMeta = { ...meta };

  const localBills = await loadRecurringBills(account);
  const mergedBills = mergeSyncItems<RecurringBill>('recurring_bill', localBills, items, nextMeta);
  if (mergedBills.changed) {
    await saveRecurringBills(account, mergedBills.list);
  }

  const localTemplates = await loadTemplates(account);
  const mergedTemplates = mergeSyncItems<BillTemplate>('bill_template', localTemplates, items, nextMeta);
  if (mergedTemplates.changed) {
    await saveTemplates(account, mergedTemplates.list);
  }

  const reminderPick = pickReminderSettingsItem(items, nextMeta);
  if (reminderPick) {
    const settings = reminderPick.deleted
      ? { ...DEFAULT_REMINDER_SETTINGS }
      : { ...DEFAULT_REMINDER_SETTINGS, ...(reminderPick.payload || {}) };
    await saveReminderSettings(account, settings, { silent: true });
    nextMeta[getSyncItemKey('reminder_settings', 'default')] = reminderPick.updatedAt;
  }

  for (const applied of [...mergedBills.applied, ...mergedTemplates.applied]) {
    nextMeta[applied.key] = applied.updatedAt;
  }

  return nextMeta;
}

async function runSyncOnce(): Promise<boolean> {
  const account = await getActiveAccount();
  if (!account) return true;

  // 未登录（token 已被清除）时跳过，避免发出必然 401 的请求
  const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) return true;

  const sinceBeforePull = await loadSyncSince(account);
  let meta = await loadSyncMeta(account);

  // 1. 拉取远端增量并落盘
  const pulled = await traceAsync('config.sync.pull', 'pull configs', () =>
    pullConfigs(sinceBeforePull || undefined)
  );
  if (pulled) {
    meta = await applyPulledItems(account, pulled.items || [], meta);
    await saveSyncMeta(account, meta);
    await saveSyncSince(account, pulled.serverTime);
  }

  // 2. 推送：有本地变更，或首次同步（把存量本地配置迁上云端）
  const dirty = await isSyncDirty(account);
  if (!dirty && sinceBeforePull !== 0) return pulled !== null;

  const now = Date.now();
  const items: SyncItem[] = [];

  const bills = await loadRecurringBills(account);
  for (const bill of bills) {
    items.push({
      type: 'recurring_bill',
      id: bill.id,
      payload: bill,
      deleted: false,
      updatedAt: meta[getSyncItemKey('recurring_bill', bill.id)] ?? bill.createdAt ?? now,
    });
  }

  const templates = await loadTemplates(account);
  for (const template of templates) {
    items.push({
      type: 'bill_template',
      id: template.id,
      payload: template,
      deleted: false,
      updatedAt:
        meta[getSyncItemKey('bill_template', template.id)] ??
        Math.max(template.createdAt ?? 0, template.lastUsedAt ?? 0) ??
        now,
    });
  }

  const settings = await loadReminderSettings(account);
  items.push({
    type: 'reminder_settings',
    id: 'default',
    payload: settings,
    deleted: false,
    updatedAt: meta[getSyncItemKey('reminder_settings', 'default')] ?? now,
  });

  const tombstones = await loadTombstones(account);
  for (const tombstone of tombstones) {
    items.push({
      type: tombstone.type,
      id: tombstone.id,
      deleted: true,
      updatedAt: tombstone.updatedAt,
    });
  }

  const pushed = await traceAsync('config.sync.push', 'push configs', () => pushConfigs(items));
  if (!pushed) return false; // 推送失败保留脏标记，等待下次触发重试

  for (const result of pushed.results || []) {
    if (result.accepted) {
      meta[getSyncItemKey(result.type, result.id)] = result.updatedAt;
    }
  }
  await saveSyncMeta(account, meta);
  await saveTombstones(account, []);
  await setSyncDirty(account, false);
  await saveSyncSince(account, pushed.serverTime);

  // 存在被服务端拒绝（远端更新）的条目时，再拉一次让远端版本收敛到本地。
  // 注意：必须从本次同步前的增量起点拉取——被拒条目的远端 updatedAt ≤ serverTime，
  // 用 pushed.serverTime 作 since 永远拉不到，分歧无法收敛。
  const hasRejected = (pushed.results || []).some(result => !result.accepted);
  if (hasRejected) {
    const reconcile = await pullConfigs(sinceBeforePull || undefined);
    if (reconcile) {
      const reconciledMeta = await applyPulledItems(account, reconcile.items || [], meta);
      await saveSyncMeta(account, reconciledMeta);
      await saveSyncSince(account, reconcile.serverTime);
    }
  }

  return pulled !== null;
}

/**
 * 配置同步 Hook：挂载在 Main 下，登录后自动同步周期账单/模板/提醒设置。
 */
export function useConfigSync() {
  const runningRef = useRef(false);
  // 配置变更防抖定时器
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  // 冷却期合并触发用的定时器
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
  // 上次同步开始时间（限流基准）
  const lastRunAtRef = useRef(0);
  // 连续失败次数（指数退避，防止接口持续失败时的请求风暴）
  const failureCountRef = useRef(0);

  const doRun = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    lastRunAtRef.current = Date.now();
    try {
      const ok = await traceAsync('config.sync', 'config sync', () => runSyncOnce());
      failureCountRef.current = ok ? 0 : failureCountRef.current + 1;
    } catch (error) {
      console.error('Config sync error', error);
      failureCountRef.current += 1;
    } finally {
      runningRef.current = false;
    }
  }, []);

  // 限流触发：两次同步最小间隔 + 失败指数退避，冷却期内的多次触发合并为一次
  const triggerSync = useCallback(() => {
    const backoff =
      failureCountRef.current === 0
        ? MIN_SYNC_INTERVAL_MS
        : Math.min(MIN_SYNC_INTERVAL_MS * 2 ** failureCountRef.current, MAX_BACKOFF_MS);
    const wait = lastRunAtRef.current + backoff - Date.now();
    if (wait <= 0) {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
      doRun();
      return;
    }
    if (!cooldownTimerRef.current) {
      cooldownTimerRef.current = setTimeout(() => {
        cooldownTimerRef.current = null;
        doRun();
      }, wait);
    }
  }, [doRun]);

  // 配置变更防抖后同步
  const scheduleSync = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      triggerSync();
    }, DEBOUNCE_MS);
  }, [triggerSync]);

  useEffect(() => {
    triggerSync();
    const unsubscribe = configDirtyBus.subscribe(scheduleSync);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') triggerSync();
    });
    return () => {
      unsubscribe();
      subscription.remove();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, [triggerSync, scheduleSync]);
}
