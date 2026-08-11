import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { getActiveAccount } from '../utils/storage';
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

// ===== 本地配置云端同步编排 =====
//
// 时机：App 启动进入 Main / 回到前台 / 配置发生变更（configDirtyBus，防抖）。
// 流程：先拉取远端增量（LWW 合并落盘）→ 脏标记或首次同步时推送本地全量（含软删墓碑）。
// 首次同步会把本地已有配置推上云端，兼容存量用户（此前配置仅存本地）。

const DEBOUNCE_MS = 1500;

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

async function runSyncOnce(): Promise<void> {
  const account = await getActiveAccount();
  if (!account) return;

  const sinceBeforePull = await loadSyncSince(account);
  let meta = await loadSyncMeta(account);

  // 1. 拉取远端增量并落盘
  const pulled = await pullConfigs(sinceBeforePull || undefined);
  if (pulled) {
    meta = await applyPulledItems(account, pulled.items || [], meta);
    await saveSyncMeta(account, meta);
    await saveSyncSince(account, pulled.serverTime);
  }

  // 2. 推送：有本地变更，或首次同步（把存量本地配置迁上云端）
  const dirty = await isSyncDirty(account);
  if (!dirty && sinceBeforePull !== 0) return;

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

  const pushed = await pushConfigs(items);
  if (!pushed) return; // 推送失败保留脏标记，等待下次触发重试

  for (const result of pushed.results || []) {
    if (result.accepted) {
      meta[getSyncItemKey(result.type, result.id)] = result.updatedAt;
    }
  }
  await saveSyncMeta(account, meta);
  await saveTombstones(account, []);
  await setSyncDirty(account, false);
  await saveSyncSince(account, pushed.serverTime);

  // 存在被服务端拒绝（远端更新）的条目时，再拉一次让远端版本收敛到本地
  const hasRejected = (pushed.results || []).some(result => !result.accepted);
  if (hasRejected) {
    const reconcile = await pullConfigs(pushed.serverTime);
    if (reconcile) {
      const reconciledMeta = await applyPulledItems(account, reconcile.items || [], meta);
      await saveSyncMeta(account, reconciledMeta);
      await saveSyncSince(account, reconcile.serverTime);
    }
  }
}

/**
 * 配置同步 Hook：挂载在 Main 下，登录后自动同步周期账单/模板/提醒设置。
 */
export function useConfigSync() {
  const runningRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const runSync = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      await runSyncOnce();
    } catch (error) {
      console.error('Config sync error', error);
    } finally {
      runningRef.current = false;
    }
  }, []);

  // 配置变更防抖后同步
  const scheduleSync = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      runSync();
    }, DEBOUNCE_MS);
  }, [runSync]);

  useEffect(() => {
    runSync();
    const unsubscribe = configDirtyBus.subscribe(scheduleSync);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') runSync();
    });
    return () => {
      unsubscribe();
      subscription.remove();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [runSync, scheduleSync]);
}
