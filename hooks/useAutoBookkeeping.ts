import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
// 注意：你需要安装 expo-clipboard: npx expo install expo-clipboard
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { billParser } from '../services/parser';
import { ParsedBill } from '../services/parser/types';
import {
  addPaymentNotificationListener,
  ackPaymentNotification,
  getPendingPaymentNotifications,
  isPaymentNotificationAvailable,
  isNotificationListenerGranted,
  PaymentNotificationEvent
} from '../services/paymentNotification';
import { getActiveAccount, getAutoBillNotificationEnabled } from '../utils/storage';
import { todayStr } from '../services/recurringBills';
import { traceSync } from '../utils/perfTracing';

// 用户隔离的「已识别账单」哈希 key 前缀（去重：已导入过的账单不再重复弹窗）
const SEEN_HASHES_PREFIX = 'clipboard_seen_hashes';
// 最多保留的哈希条数，防止无限增长
const MAX_SEEN_HASHES = 200;
// 防抖窗口：同一内容短时间内不重复触发
const DEBOUNCE_MS = 60 * 1000;
// 通知使用权失效提示每天只提醒一次，记录已提示日期（与漏记轻提示同一模式）
const NOTIF_PERM_HINT_DATE_PREFIX = 'notif_perm_hint_date';

// —— 支付通知去重 ——
// 关键：去重必须只针对「同一条通知的重复送达」，不能针对「内容相同的不同笔支付」。
// 微信/支付宝的扣费通知经常只有金额（如「已扣费¥9.29」），不含商户与时间，
// 若按文案做长期去重，同额的第二笔及之后的支付会被永久静默丢弃。
// 因此：
//   1) 事件级 ID = 来源 + 标题 + 正文 + 通知 postTime：实时 emit 与缓冲兜底重复送达同一
//      条时 ID 完全一致，可靠去重；
//   2) 文案级短窗口（60s）：兜底防住系统分组通知产生的同文案重复。
const NOTIF_CONTENT_DEDUP_WINDOW_MS = 60 * 1000;
const NOTIF_SEEN_ID_LIMIT = 500;

/** 会话内已处理的通知事件 ID（原生 postTime 参与，进程重启后自然清空） */
const notifSeenIds = new Set<string>();
/** 会话内文案 → 最近处理时间（60s 窗口内视为同一条） */
const notifContentSeenAt = new Map<string, number>();

function trimNotifSeenIds() {
  if (notifSeenIds.size <= NOTIF_SEEN_ID_LIMIT) return;
  for (const id of notifSeenIds) {
    notifSeenIds.delete(id);
    if (notifSeenIds.size <= NOTIF_SEEN_ID_LIMIT / 2) break;
  }
}

function trimNotifContentSeen(now: number) {
  if (notifContentSeenAt.size <= NOTIF_SEEN_ID_LIMIT) return;
  for (const [key, time] of notifContentSeenAt) {
    if (now - time > NOTIF_CONTENT_DEDUP_WINDOW_MS) notifContentSeenAt.delete(key);
  }
}

/**
 * 判断该通知是否已处理过；未处理过则记录为已处理。
 * @param eventId 事件级唯一 ID
 * @param content 拼好来源前缀的完整文案
 */
export function markNotificationHandled(eventId: string, content: string): boolean {
  const now = Date.now();
  if (notifSeenIds.has(eventId)) return true;
  const contentKey = hashText(content);
  const last = notifContentSeenAt.get(contentKey);
  if (last !== undefined && now - last < NOTIF_CONTENT_DEDUP_WINDOW_MS) return true;

  notifSeenIds.add(eventId);
  notifContentSeenAt.set(contentKey, now);
  trimNotifSeenIds();
  trimNotifContentSeen(now);
  return false;
}

/** 【测试用】重置会话内通知去重状态 */
export function resetNotificationDedupState(): void {
  notifSeenIds.clear();
  notifContentSeenAt.clear();
}

export const getSeenHashesKey = (account: string) => `${SEEN_HASHES_PREFIX}:${account}`;

export const getNotifPermHintDateKey = (account: string) =>
  `${NOTIF_PERM_HINT_DATE_PREFIX}:${account}`;

/**
 * 通知使用权失效提示今天是否已展示过（读取失败时不打扰用户）
 */
async function hasNotifPermHintShownToday(account: string, today: string): Promise<boolean> {
  try {
    const shown = await AsyncStorage.getItem(getNotifPermHintDateKey(account));
    return shown === today;
  } catch (error) {
    console.error('Failed to read notification permission hint date', error);
    return true;
  }
}

async function markNotifPermHintShown(account: string, today: string): Promise<void> {
  try {
    await AsyncStorage.setItem(getNotifPermHintDateKey(account), today);
  } catch (error) {
    console.error('Failed to mark notification permission hint shown', error);
  }
}

/**
 * 轻量字符串哈希（djb2），用于账单原文去重
 */
export function hashText(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    // eslint-disable-next-line no-bitwise
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  // eslint-disable-next-line no-bitwise
  return `${text.length}_${(hash >>> 0).toString(36)}`;
}

async function getSeenHashes(account: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(getSeenHashesKey(account));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load seen hashes', error);
    return [];
  }
}

async function markHashSeen(account: string, hash: string): Promise<void> {
  try {
    const seen = await getSeenHashes(account);
    if (seen.includes(hash)) return;
    seen.unshift(hash);
    await AsyncStorage.setItem(
      getSeenHashesKey(account),
      JSON.stringify(seen.slice(0, MAX_SEEN_HASHES))
    );
  } catch (error) {
    console.error('Failed to save seen hash', error);
  }
}

export function useAutoBookkeeping() {
  const [detectedBill, setDetectedBill] = useState<ParsedBill | null>(null);
  // 防抖：记录上次触发检测的内容与时间
  const lastDetectedRef = useRef<{ content: string; time: number } | null>(null);
  // 通知使用权丢失告警（开关开启但权限被系统回收时提醒用户）
  const [notificationPermissionWarning, setNotificationPermissionWarning] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', checkClipboard);

    // 首次加载检查一次
    checkClipboard(AppState.currentState);

    return () => {
      subscription.remove();
    };
  }, []);

  // 通知权限看门狗：App 回前台时检测开关开启但授权丢失的情况
  useEffect(() => {
    if (!isPaymentNotificationAvailable) return;

    const checkPermission = async () => {
      const account = await getActiveAccount();
      if (!account) {
        setNotificationPermissionWarning(false);
        return;
      }
      const enabled = await getAutoBillNotificationEnabled(account);
      if (!enabled) {
        setNotificationPermissionWarning(false);
        return;
      }
      const granted = await isNotificationListenerGranted();
      if (granted) {
        setNotificationPermissionWarning(false);
        return;
      }
      // 失效提示每天最多一次，避免每次回前台都打扰（授权恢复后不受影响）
      if (await hasNotifPermHintShownToday(account, todayStr())) return;
      setNotificationPermissionWarning(true);
    };

    checkPermission();

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') checkPermission();
    });
    return () => subscription.remove();
  }, []);

  const checkClipboard = async (state: AppStateStatus) => {
    if (state !== 'active') return;

    try {
      const hasString = await Clipboard.hasStringAsync();
      if (!hasString) return;

      const content = await Clipboard.getStringAsync();
      if (!content || !content.trim()) return;

      // 防抖：同一内容在窗口期内不重复触发
      const last = lastDetectedRef.current;
      if (last && last.content === content && Date.now() - last.time < DEBOUNCE_MS) {
        return;
      }

      // 解析
      const result = traceSync('bill.parse', 'clipboard bill parse', () => billParser.parse(content));
      if (!result) return;

      // 去重：已识别/导入过的账单内容不再重复弹窗
      const hash = hashText(result.rawText.trim());
      const account = await getActiveAccount();
      if (account) {
        const seen = await getSeenHashes(account);
        if (seen.includes(hash)) return;
        await markHashSeen(account, hash);
      }

      lastDetectedRef.current = { content, time: Date.now() };
      setDetectedBill(result);
    } catch (e) {
      console.log('Clipboard check failed (module might not be installed)', e);
    }
  };

  // 处理支付通知事件（Android 通知监听）：拼接来源前缀后走同一套解析/去重链路
  const handlePaymentNotification = async (event: PaymentNotificationEvent) => {
    console.log('[AutoBookkeeping] payment event received', event.source, event.title, event.text);

    // 是否真正进入了处理链路：只有处理过才回执给原生，未开启开关的事件留在缓冲里等下次补
    let delivered = false;
    try {
      // 开关实时读取：支持同一会话内切换开关立即生效
      const account = await getActiveAccount();
      const enabled = account ? await getAutoBillNotificationEnabled(account) : false;
      if (!enabled) {
        console.log('[AutoBookkeeping] skipped: auto bill notification disabled');
        return;
      }
      delivered = true;

      const label = event.source === 'Alipay' ? '支付宝' : '微信';
      const content = `【${label}】${[event.title, event.text].filter(Boolean).join('\n')}`;

      // 去重：只针对同一条通知的重复送达（实时事件 + 缓冲兜底），不针对同额的不同笔支付
      const eventId = hashText(
        `${event.source}|${event.title ?? ''}|${event.text ?? ''}|${event.time}`
      );
      if (markNotificationHandled(eventId, content)) {
        console.log('[AutoBookkeeping] skipped: duplicate notification', eventId);
        return;
      }

      const result = traceSync('bill.parse', 'notification bill parse', () =>
        billParser.parse(content)
      );
      if (!result) {
        console.log('[AutoBookkeeping] skipped: parse failed', content);
        return;
      }

      // 账单日期取通知时间：App 被杀后延迟补记时，日期仍与真实支付时间一致
      if (event.time && Number.isFinite(event.time)) {
        const notifiedAt = new Date(event.time);
        if (!Number.isNaN(notifiedAt.getTime())) {
          result.date = notifiedAt;
        }
      }

      console.log(
        '[AutoBookkeeping] bill detected, showing dialog',
        result.amount,
        result.source,
        result.date?.toISOString()
      );
      setDetectedBill(result);
    } catch (e) {
      console.error('[AutoBookkeeping] notification handling failed', e);
    } finally {
      // 已交付 JS 的事件从原生持久化缓冲移除，防止进程重启后重复补记
      if (delivered) ackPaymentNotification(event);
    }
  };

  useEffect(() => {
    if (!isPaymentNotificationAvailable) return;

    const subscription = addPaymentNotificationListener(handlePaymentNotification);

    let draining = false;
    // 兜底：拉取原生持久化缓冲（App 在后台 / RN 未就绪 / 进程被系统回收期间收到的通知）。
    // 原生层保证「先落盘再 emit」，所以这里能补回实时事件没送达的账单。
    const drainPending = async () => {
      if (draining) return;
      draining = true;
      try {
        const account = await getActiveAccount();
        const enabled = account ? await getAutoBillNotificationEnabled(account) : false;
        // 开关关闭时不去消费缓冲，避免用户关开关期间的通知被读空丢弃
        if (!enabled) return;

        const pending = await getPendingPaymentNotifications();
        if (pending.length > 0) {
          console.log('[AutoBookkeeping] draining pending notifications', pending.length);
        }
        // 顺序处理：并发处理会让去重记录的读改写互相覆盖
        for (const event of pending) {
          await handlePaymentNotification(event);
        }
      } catch (e) {
        console.error('Failed to drain pending payment notifications', e);
      } finally {
        draining = false;
      }
    };

    drainPending();

    // 每次回前台补拉一次：后台期间的通知可能只落在原生缓冲里，实时 emit 未必能送达 JS
    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') drainPending();
    });

    return () => {
      subscription?.remove();
      appStateSub.remove();
    };
  }, []);

  const clearDetectedBill = useCallback(() => {
    setDetectedBill(null);
  }, []);

  const dismissNotificationPermissionWarning = useCallback(async () => {
    setNotificationPermissionWarning(false);
    const account = await getActiveAccount();
    if (account) await markNotifPermHintShown(account, todayStr());
  }, []);

  return {
    detectedBill,
    clearDetectedBill,
    notificationPermissionWarning,
    dismissNotificationPermissionWarning
  };
}
