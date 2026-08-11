import AsyncStorage from '@react-native-async-storage/async-storage';
import request from '../request';

// ===== 记账习惯激励：连续记账天数（streak）与里程碑 =====

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalDays: number;
  checkedToday: boolean;
  // checkIn 时服务端返回的"本次新达到"里程碑档位；查询接口恒为空数组
  milestonesReached: number[];
}

export const MILESTONE_LEVELS = [7, 30, 100, 365];

export const MILESTONE_MESSAGES: Record<number, string> = {
  7: '已连续记账 7 天，习惯正在养成！',
  30: '连续记账 30 天，了不起的坚持！',
  100: '连续记账 100 天，你就是记账达人！',
  365: '连续记账 365 天，整整一年的坚持！',
};

export function getMilestoneMessage(level: number): string | null {
  return MILESTONE_MESSAGES[level] || null;
}

// 设备时区（IANA），服务端按该时区判定自然日
export function getTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone || 'Asia/Shanghai';
  } catch (error) {
    return 'Asia/Shanghai';
  }
}

// ===== 接口 =====

interface HabitResponse {
  code: number;
  msg: string;
  data: StreakData;
}

/**
 * 记账打卡：记账成功 / 离线账单补同步成功后调用，支持一次补多天。
 * 服务端幂等，重复调用不产生副作用。
 */
export async function checkIn(dates: string[]): Promise<StreakData | null> {
  if (dates.length === 0) return null;
  try {
    const res: HabitResponse = await request('/api/habit/checkIn', {
      method: 'POST',
      body: JSON.stringify({ dates, timezone: getTimeZone() }),
    });
    return res.code === 200 && res.data ? res.data : null;
  } catch (error) {
    console.error('checkIn failed', error);
    return null;
  }
}

/**
 * 查询连记数据（统计页 / 我的页展示用）
 */
export async function fetchStreak(): Promise<StreakData | null> {
  try {
    const query = new URLSearchParams({ timezone: getTimeZone() }).toString();
    const res: HabitResponse = await request(`/api/habit/streak?${query}`, {
      method: 'GET',
    });
    return res.code === 200 && res.data ? res.data : null;
  } catch (error) {
    console.error('fetchStreak failed', error);
    return null;
  }
}

// ===== 本地缓存（离线兜底展示，key 带 account 前缀） =====

const STREAK_CACHE_PREFIX = 'streak_cache_user';

export const getStreakCacheKey = (account: string) =>
  `${STREAK_CACHE_PREFIX}:${account}`;

export async function loadStreakCache(account: string): Promise<StreakData | null> {
  try {
    const raw = await AsyncStorage.getItem(getStreakCacheKey(account));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.currentStreak !== 'number') return null;
    return parsed as StreakData;
  } catch (error) {
    return null;
  }
}

export async function saveStreakCache(account: string, data: StreakData): Promise<void> {
  try {
    await AsyncStorage.setItem(getStreakCacheKey(account), JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save streak cache', error);
  }
}

// ===== 激励开关（"我的"页个性化可关闭，默认开） =====

const MOTIVATION_ENABLED_PREFIX = 'motivation_enabled_user';

export const getMotivationEnabledKey = (account: string) =>
  `${MOTIVATION_ENABLED_PREFIX}:${account}`;

export async function isMotivationEnabled(account: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(getMotivationEnabledKey(account));
    return raw === null ? true : raw === 'true';
  } catch (error) {
    return true;
  }
}

export async function setMotivationEnabled(account: string, enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(getMotivationEnabledKey(account), String(enabled));
}

/**
 * 拉取最新 streak 并更新本地缓存；失败时回退缓存。
 */
export async function loadStreakWithCache(account: string): Promise<StreakData | null> {
  const fresh = await fetchStreak();
  if (fresh) {
    await saveStreakCache(account, fresh);
    return fresh;
  }
  return await loadStreakCache(account);
}
