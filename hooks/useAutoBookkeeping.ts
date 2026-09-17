import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
// 注意：你需要安装 expo-clipboard: npx expo install expo-clipboard
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { billParser } from '../services/parser';
import { ParsedBill } from '../services/parser/types';
import {
  addPaymentNotificationListener,
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

    // 开关实时读取：支持同一会话内切换开关立即生效
    const account = await getActiveAccount();
    const enabled = account ? await getAutoBillNotificationEnabled(account) : false;
    if (!enabled) {
      console.log('[AutoBookkeeping] skipped: auto bill notification disabled');
      return;
    }

    const label = event.source === 'Alipay' ? '支付宝' : '微信';
    const content = `【${label}】${[event.title, event.text].filter(Boolean).join('\n')}`;

    // 防抖：同一内容在窗口期内不重复触发
    const last = lastDetectedRef.current;
    if (last && last.content === content && Date.now() - last.time < DEBOUNCE_MS) {
      console.log('[AutoBookkeeping] skipped: debounced');
      return;
    }

    const result = traceSync('bill.parse', 'notification bill parse', () =>
      billParser.parse(content)
    );
    if (!result) {
      console.log('[AutoBookkeeping] skipped: parse failed', content);
      return;
    }

    // 去重：已识别过的通知不再重复弹窗（实时事件与缓冲兜底可能重复送达）
    const hash = hashText(result.rawText.trim());
    if (account) {
      const seen = await getSeenHashes(account);
      if (seen.includes(hash)) {
        console.log('[AutoBookkeeping] skipped: already seen', hash);
        return;
      }
      await markHashSeen(account, hash);
    }

    console.log('[AutoBookkeeping] bill detected, showing dialog', result.amount, result.source);
    lastDetectedRef.current = { content, time: Date.now() };
    setDetectedBill(result);
  };

  useEffect(() => {
    if (!isPaymentNotificationAvailable) return;

    const subscription = addPaymentNotificationListener(handlePaymentNotification);

    const init = async () => {
      const account = await getActiveAccount();
      const enabled = account ? await getAutoBillNotificationEnabled(account) : false;
      if (!enabled) return;

      // 兜底：拉取 App 在后台/RN 未就绪期间收到的支付通知（单条事件内部仍会实时校验开关）
      const pending = await getPendingPaymentNotifications();
      pending.forEach(handlePaymentNotification);
    };
    init();

    return () => {
      subscription?.remove();
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
