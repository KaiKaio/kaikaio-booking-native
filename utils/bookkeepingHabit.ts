import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveAccount } from './storage';

// ===== 记账习惯记录（用于漏记检测） =====

// 用户隔离的最后记账时间 key 前缀
const BOOKKEEPING_HABIT_PREFIX = 'bookkeeping_habit';
// 漏记轻提示每天只弹一次，记录已提示日期
const MISSED_HINT_DATE_PREFIX = 'missed_hint_date';

export const getBookkeepingHabitKey = (account: string) =>
  `${BOOKKEEPING_HABIT_PREFIX}:${account}`;

export const getMissedHintDateKey = (account: string) =>
  `${MISSED_HINT_DATE_PREFIX}:${account}`;

/**
 * 记录一次手动记账行为（时间戳）
 */
export async function recordBookkeeping(): Promise<void> {
  const account = await getActiveAccount();
  if (!account) return;
  try {
    await AsyncStorage.setItem(getBookkeepingHabitKey(account), String(Date.now()));
  } catch (error) {
    console.error('Failed to record bookkeeping habit', error);
  }
}

export async function getLastBookkeepingTime(): Promise<number | null> {
  const account = await getActiveAccount();
  if (!account) return null;
  try {
    const raw = await AsyncStorage.getItem(getBookkeepingHabitKey(account));
    if (!raw) return null;
    const time = parseInt(raw, 10);
    return Number.isNaN(time) ? null : time;
  } catch (error) {
    console.error('Failed to read bookkeeping habit', error);
    return null;
  }
}

/**
 * 最近 N 天内是否有过记账（判定用户是否具备记账习惯）
 */
export async function hasRecentHabit(days = 7): Promise<boolean> {
  const last = await getLastBookkeepingTime();
  if (!last) return false;
  return Date.now() - last <= days * 24 * 60 * 60 * 1000;
}

/**
 * 漏记轻提示是否今天已经展示过
 */
export async function hasMissedHintShownToday(today: string): Promise<boolean> {
  const account = await getActiveAccount();
  if (!account) return true;
  try {
    const shown = await AsyncStorage.getItem(getMissedHintDateKey(account));
    return shown === today;
  } catch (error) {
    return true;
  }
}

export async function markMissedHintShown(today: string): Promise<void> {
  const account = await getActiveAccount();
  if (!account) return;
  try {
    await AsyncStorage.setItem(getMissedHintDateKey(account), today);
  } catch (error) {
    console.error('Failed to mark missed hint shown', error);
  }
}
