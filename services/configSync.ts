import AsyncStorage from '@react-native-async-storage/async-storage';
import request from '../request';
import type { RecurringBill } from './recurringBills';
import type { BillTemplate } from './billTemplates';
import type { ReminderSettings } from './reminderSettings';

// ===== 本地配置云端同步（周期账单 / 快捷模板 / 提醒设置） =====
//
// 协议（详见 BACKEND_API_P3.md 第 3 节）：
// - 类型化 KV：(type, id) 为键，payload 透传 JSON
// - 冲突解决：updatedAt 最后写入优先（LWW），客户端侧用本地 meta 记录每条配置的 updatedAt
// - 删除：软删标记（deleted: true），多端同步后由本地移除

export type SyncConfigType = 'recurring_bill' | 'bill_template' | 'reminder_settings';

export const SYNC_CONFIG_TYPES: SyncConfigType[] = [
  'recurring_bill',
  'bill_template',
  'reminder_settings',
];

export interface SyncItem {
  type: SyncConfigType;
  id: string;
  payload?: RecurringBill | BillTemplate | ReminderSettings | Record<string, unknown>;
  deleted: boolean;
  updatedAt: number;
}

interface PullResponseData {
  serverTime: number;
  items: SyncItem[];
}

interface PushResultItem {
  type: SyncConfigType;
  id: string;
  accepted: boolean;
  updatedAt: number;
}

interface PushResponseData {
  serverTime: number;
  results: PushResultItem[];
}

interface SyncResponse<T> {
  code: number;
  msg: string;
  data: T;
}

// ===== 接口 =====

export async function pullConfigs(since?: number): Promise<PullResponseData | null> {
  try {
    const res: SyncResponse<PullResponseData> = await request('/api/sync/pull', {
      method: 'POST',
      body: JSON.stringify({ ...(since ? { since } : {}) }),
      timeout: 10000,
    });
    return res.code === 200 && res.data ? res.data : null;
  } catch (error) {
    console.error('pullConfigs failed', error);
    return null;
  }
}

export async function pushConfigs(items: SyncItem[]): Promise<PushResponseData | null> {
  if (items.length === 0) return null;
  try {
    const res: SyncResponse<PushResponseData> = await request('/api/sync/push', {
      method: 'POST',
      body: JSON.stringify({ items }),
      timeout: 10000,
    });
    return res.code === 200 && res.data ? res.data : null;
  } catch (error) {
    console.error('pushConfigs failed', error);
    return null;
  }
}

// ===== 本地同步状态（key 带 account 前缀） =====

const SYNC_SINCE_PREFIX = 'config_sync_since_user';
const SYNC_META_PREFIX = 'config_sync_meta_user';
const SYNC_TOMBSTONE_PREFIX = 'config_sync_tombstones_user';
const SYNC_DIRTY_PREFIX = 'config_sync_dirty_user';

export const getConfigSyncSinceKey = (account: string) => `${SYNC_SINCE_PREFIX}:${account}`;
export const getConfigSyncMetaKey = (account: string) => `${SYNC_META_PREFIX}:${account}`;
export const getConfigSyncTombstoneKey = (account: string) =>
  `${SYNC_TOMBSTONE_PREFIX}:${account}`;
export const getConfigSyncDirtyKey = (account: string) => `${SYNC_DIRTY_PREFIX}:${account}`;

export const getSyncItemKey = (type: SyncConfigType, id: string) => `${type}:${id}`;

// 每条配置的 updatedAt（拉取/推送成功时记录服务端值，本地变更时记录本地时间）
export type SyncMetaMap = Record<string, number>;

export interface SyncTombstone {
  type: SyncConfigType;
  id: string;
  updatedAt: number;
}

export async function loadSyncSince(account: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(getConfigSyncSinceKey(account));
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch (error) {
    return 0;
  }
}

export async function saveSyncSince(account: string, since: number): Promise<void> {
  await AsyncStorage.setItem(getConfigSyncSinceKey(account), String(since));
}

export async function loadSyncMeta(account: string): Promise<SyncMetaMap> {
  try {
    const raw = await AsyncStorage.getItem(getConfigSyncMetaKey(account));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

export async function saveSyncMeta(account: string, meta: SyncMetaMap): Promise<void> {
  await AsyncStorage.setItem(getConfigSyncMetaKey(account), JSON.stringify(meta));
}

export async function loadTombstones(account: string): Promise<SyncTombstone[]> {
  try {
    const raw = await AsyncStorage.getItem(getConfigSyncTombstoneKey(account));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

export async function saveTombstones(account: string, tombstones: SyncTombstone[]): Promise<void> {
  // 软删记录上限保护，防止无限增长
  await AsyncStorage.setItem(
    getConfigSyncTombstoneKey(account),
    JSON.stringify(tombstones.slice(0, 200))
  );
}

export async function isSyncDirty(account: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(getConfigSyncDirtyKey(account));
    return raw === 'true';
  } catch (error) {
    return false;
  }
}

export async function setSyncDirty(account: string, dirty: boolean): Promise<void> {
  await AsyncStorage.setItem(getConfigSyncDirtyKey(account), String(dirty));
}

// ===== 变更总线：配置发生变更时通知同步 Hook =====

type Listener = () => void;
const dirtyListeners: Set<Listener> = new Set();

export const configDirtyBus = {
  subscribe(listener: Listener): () => void {
    dirtyListeners.add(listener);
    return () => {
      dirtyListeners.delete(listener);
    };
  },
  notify(): void {
    dirtyListeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('configDirtyBus listener error', error);
      }
    });
  },
};

/**
 * 本地新增/修改某条配置后调用：记录本地 updatedAt、置脏并触发同步。
 * 由 services/recurringBills、billTemplates、reminderSettings 的写操作调用。
 */
export async function markConfigChanged(
  account: string,
  type: SyncConfigType,
  id: string
): Promise<void> {
  try {
    const meta = await loadSyncMeta(account);
    meta[getSyncItemKey(type, id)] = Date.now();
    await saveSyncMeta(account, meta);
    await setSyncDirty(account, true);
  } catch (error) {
    console.error('markConfigChanged failed', error);
  }
  configDirtyBus.notify();
}

/**
 * 本地删除某条配置后调用：生成软删墓碑（推送 deleted:true 供其他设备同步删除）。
 */
export async function markConfigRemoved(
  account: string,
  type: SyncConfigType,
  id: string
): Promise<void> {
  try {
    const [meta, tombstones] = await Promise.all([
      loadSyncMeta(account),
      loadTombstones(account),
    ]);
    delete meta[getSyncItemKey(type, id)];
    await saveSyncMeta(account, meta);
    await saveTombstones(account, [
      ...tombstones.filter(t => !(t.type === type && t.id === id)),
      { type, id, updatedAt: Date.now() },
    ]);
    await setSyncDirty(account, true);
  } catch (error) {
    console.error('markConfigRemoved failed', error);
  }
  configDirtyBus.notify();
}

// ===== 合并逻辑（纯函数，便于单测） =====

export interface MergeResult<T> {
  list: T[];
  // 本次被应用的远端条目（用于更新 meta）
  applied: { key: string; updatedAt: number }[];
  changed: boolean;
}

/**
 * 将拉取到的同步条目合并进本地列表（LWW）：
 * - 本地 meta 中的 updatedAt 更新（说明本地在拉取之后又改过）→ 跳过，保留本地版本
 * - deleted 条目 → 从本地移除
 * - 其余 → upsert payload
 */
export function mergeSyncItems<T extends { id: string }>(
  type: SyncConfigType,
  local: T[],
  items: SyncItem[],
  meta: SyncMetaMap
): MergeResult<T> {
  const typed = items.filter(item => item.type === type);
  if (typed.length === 0) {
    return { list: local, applied: [], changed: false };
  }

  const list = [...local];
  const applied: { key: string; updatedAt: number }[] = [];
  let changed = false;

  for (const item of typed) {
    const key = getSyncItemKey(type, item.id);
    const localUpdatedAt = meta[key];
    if (localUpdatedAt !== undefined && localUpdatedAt > item.updatedAt) {
      // 本地版本更新，跳过远端旧版本（本地会在推送时被采纳）
      continue;
    }

    const index = list.findIndex(entry => entry.id === item.id);
    if (item.deleted) {
      if (index >= 0) {
        list.splice(index, 1);
        changed = true;
      }
    } else {
      const payload = item.payload as T;
      if (index >= 0) {
        list[index] = payload;
      } else {
        list.unshift(payload);
      }
      changed = true;
    }
    applied.push({ key, updatedAt: item.updatedAt });
  }

  return { list, applied, changed };
}

/**
 * 从拉取结果中取提醒设置（单例，id 固定 'default'）：
 * 返回 [是否有远端变更, 应落盘的设置或 null（null 表示被远端删除，应重置默认）]
 */
export function pickReminderSettingsItem(
  items: SyncItem[],
  meta: SyncMetaMap
): { applied: boolean; deleted: boolean; payload: ReminderSettings | null; updatedAt: number } | null {
  const typed = items
    .filter(item => item.type === 'reminder_settings')
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const latest = typed[0];
  if (!latest) return null;

  const key = getSyncItemKey('reminder_settings', latest.id);
  const localUpdatedAt = meta[key];
  if (localUpdatedAt !== undefined && localUpdatedAt > latest.updatedAt) {
    return null;
  }

  return {
    applied: true,
    deleted: latest.deleted,
    payload: latest.deleted ? null : (latest.payload as ReminderSettings),
    updatedAt: latest.updatedAt,
  };
}
