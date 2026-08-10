import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getActiveAccount, getUserPendingBills } from '../utils/storage';
import { loadBillMonthCache } from '../services/bill';
import { loadReminderSettings } from '../services/reminderSettings';
import {
  hasMissedHintShownToday,
  hasRecentHabit,
  markMissedHintShown,
} from '../utils/bookkeepingHabit';
import { formatDateStr, todayStr } from '../services/recurringBills';

// 漏记检测的最早提示时间（小时）：晚上再轻提示，避免白天打扰
const MISSED_HINT_AFTER_HOUR = 20;

/**
 * 判断今天是否已有账单记录（月度缓存 + 本地待同步队列）
 */
export async function hasRecordToday(account: string): Promise<boolean> {
  const today = todayStr();
  const month = today.slice(0, 7);

  try {
    const cached = await loadBillMonthCache(month);
    if (cached) {
      const daily = cached.list.find(d => d.date === today);
      if (daily && daily.bills.length > 0) return true;
    }
  } catch (error) {
    console.error('Failed to check month cache for missed detection', error);
  }

  try {
    const pending = await getUserPendingBills(account);
    return pending.some(item => {
      const timestamp = parseInt(String(item.date), 10);
      if (Number.isNaN(timestamp)) return false;
      return formatDateStr(new Date(timestamp)) === today;
    });
  } catch (error) {
    console.error('Failed to check pending bills for missed detection', error);
    return false;
  }
}

/**
 * 漏记检测：当晚打开 App 时，若当天零记录且用户有记账习惯，轻提示一次。
 * 返回是否需要提示，以及提示关闭回调。
 */
export function useMissedRecordReminder() {
  const [missedHintVisible, setMissedHintVisible] = useState(false);

  const check = useCallback(async () => {
    try {
      const account = await getActiveAccount();
      if (!account) return;

      const settings = await loadReminderSettings(account);
      if (!settings.missedDetectEnabled) return;

      const now = new Date();
      if (now.getHours() < MISSED_HINT_AFTER_HOUR) return;

      const today = todayStr(now);
      if (await hasMissedHintShownToday(today)) return;

      // 无记账习惯的用户不打扰
      if (!(await hasRecentHabit(7))) return;

      if (await hasRecordToday(account)) return;

      setMissedHintVisible(true);
    } catch (error) {
      console.error('Missed record reminder check failed', error);
    }
  }, []);

  useEffect(() => {
    check();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') check();
    });
    return () => subscription.remove();
  }, [check]);

  // 关闭提示（无论记或不记，今天不再提示）
  const dismissMissedHint = useCallback(async () => {
    setMissedHintVisible(false);
    await markMissedHintShown(todayStr());
  }, []);

  return { missedHintVisible, dismissMissedHint };
}
