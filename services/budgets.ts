import AsyncStorage from '@react-native-async-storage/async-storage';
import request from '../request';
import { getTimeZone } from './bookkeepingStreak';

// ===== 预算辅助：月度总预算 + 分类预算 =====

export type BudgetScope = 'total' | 'category';

export interface TotalBudget {
  amount: number;
  updatedAt?: number;
}

export interface CategoryBudget {
  id?: number;
  categoryId: number;
  categoryName: string;
  amount: number;
  updatedAt?: number;
}

export interface BudgetListData {
  totalBudget: TotalBudget | null;
  categoryBudgets: CategoryBudget[];
}

export interface BudgetProgressItem {
  categoryId: number;
  categoryName: string;
  amount: number;
  used: number;
  ratio: number;
}

export interface TotalBudgetProgress {
  amount: number;
  used: number;
  ratio: number;
}

export interface BudgetProgressData {
  month: string;
  totalBudget: TotalBudgetProgress | null;
  categoryBudgets: BudgetProgressItem[];
}

interface BudgetResponse<T> {
  code: number;
  msg: string;
  data: T;
}

// 接近上限的预警阈值（≥80% 变色预警 / 轻提醒）
export const BUDGET_WARN_RATIO = 0.8;

// ===== 接口 =====

export async function fetchBudgetList(): Promise<BudgetListData | null> {
  try {
    const res: BudgetResponse<BudgetListData> = await request('/api/budget/list', {
      method: 'GET',
    });
    return res.code === 200 && res.data ? res.data : null;
  } catch (error) {
    console.error('fetchBudgetList failed', error);
    return null;
  }
}

export async function saveBudget(params: {
  scope: BudgetScope;
  categoryId?: number;
  amount: number;
}): Promise<boolean> {
  try {
    const res: BudgetResponse<unknown> = await request('/api/budget/save', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return res.code === 200;
  } catch (error) {
    console.error('saveBudget failed', error);
    return false;
  }
}

export async function deleteBudget(params: {
  scope: BudgetScope;
  categoryId?: number;
}): Promise<boolean> {
  try {
    const res: BudgetResponse<unknown> = await request('/api/budget/delete', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return res.code === 200;
  } catch (error) {
    console.error('deleteBudget failed', error);
    return false;
  }
}

export async function fetchBudgetProgress(month: string): Promise<BudgetProgressData | null> {
  try {
    const query = new URLSearchParams({
      month,
      timezone: getTimeZone(),
    }).toString();
    const res: BudgetResponse<BudgetProgressData> = await request(
      `/api/budget/progress?${query}`,
      { method: 'GET' }
    );
    return res.code === 200 && res.data ? res.data : null;
  } catch (error) {
    console.error('fetchBudgetProgress failed', error);
    return null;
  }
}

// ===== 本地缓存（离线兜底，key 带 account 前缀） =====

const BUDGET_LIST_CACHE_PREFIX = 'budget_list_cache_user';
const BUDGET_PROGRESS_CACHE_PREFIX = 'budget_progress_cache_user';

export const getBudgetListCacheKey = (account: string) =>
  `${BUDGET_LIST_CACHE_PREFIX}:${account}`;

export const getBudgetProgressCacheKey = (account: string, month: string) =>
  `${BUDGET_PROGRESS_CACHE_PREFIX}:${account}:${month}`;

export async function loadBudgetListCache(account: string): Promise<BudgetListData | null> {
  try {
    const raw = await AsyncStorage.getItem(getBudgetListCacheKey(account));
    if (!raw) return null;
    return JSON.parse(raw) as BudgetListData;
  } catch (error) {
    return null;
  }
}

export async function saveBudgetListCache(account: string, data: BudgetListData): Promise<void> {
  try {
    await AsyncStorage.setItem(getBudgetListCacheKey(account), JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save budget list cache', error);
  }
}

export async function loadBudgetProgressCache(
  account: string,
  month: string
): Promise<BudgetProgressData | null> {
  try {
    const raw = await AsyncStorage.getItem(getBudgetProgressCacheKey(account, month));
    if (!raw) return null;
    return JSON.parse(raw) as BudgetProgressData;
  } catch (error) {
    return null;
  }
}

export async function saveBudgetProgressCache(
  account: string,
  data: BudgetProgressData
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      getBudgetProgressCacheKey(account, data.month),
      JSON.stringify(data)
    );
  } catch (error) {
    console.error('Failed to save budget progress cache', error);
  }
}

// ===== 超支轻提醒去重（同预算同档位每月只提示一次） =====

export type BudgetHintLevel = 'warn' | 'over';

const BUDGET_HINT_PREFIX = 'budget_hint_user';

export const getBudgetHintKey = (account: string) => `${BUDGET_HINT_PREFIX}:${account}`;

// 提示去重维度 key：月份 + scope + 分类（总预算为 'total'）
export function buildHintEntryKey(
  month: string,
  scope: BudgetScope,
  categoryId?: number
): string {
  return `${month}|${scope}|${scope === 'category' ? categoryId : 'total'}`;
}

export async function loadHintShownMap(account: string): Promise<Record<string, BudgetHintLevel>> {
  try {
    const raw = await AsyncStorage.getItem(getBudgetHintKey(account));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

export async function saveHintShownMap(
  account: string,
  map: Record<string, BudgetHintLevel>
): Promise<void> {
  try {
    await AsyncStorage.setItem(getBudgetHintKey(account), JSON.stringify(map));
  } catch (error) {
    console.error('Failed to save budget hint map', error);
  }
}

// ===== 超支检测（纯函数，便于单测） =====

export interface BudgetAlert {
  entryKey: string;
  level: BudgetHintLevel;
  message: string;
}

function levelForRatio(ratio: number): BudgetHintLevel | null {
  if (ratio >= 1) return 'over';
  if (ratio >= BUDGET_WARN_RATIO) return 'warn';
  return null;
}

// 已提示过的档位不低于本次档位时跳过（warn 后仍可再提示 over）
function shouldNotify(shown: BudgetHintLevel | undefined, next: BudgetHintLevel): boolean {
  if (!shown) return true;
  if (shown === 'warn' && next === 'over') return true;
  return false;
}

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/**
 * 根据当月预算进度与已提示记录，计算本次需要轻提示的超支条目。
 */
export function detectBudgetAlerts(
  progress: BudgetProgressData,
  shownMap: Record<string, BudgetHintLevel>
): BudgetAlert[] {
  const alerts: BudgetAlert[] = [];

  if (progress.totalBudget) {
    const { amount, used, ratio } = progress.totalBudget;
    const level = levelForRatio(ratio);
    const entryKey = buildHintEntryKey(progress.month, 'total');
    if (level && shouldNotify(shownMap[entryKey], level)) {
      alerts.push({
        entryKey,
        level,
        message:
          level === 'over'
            ? `本月总预算已超支（¥${used.toFixed(2)} / ¥${amount.toFixed(2)}`.concat('）')
            : `本月总预算已使用 ${formatPercent(ratio)}，注意控制支出`,
      });
    }
  }

  for (const item of progress.categoryBudgets || []) {
    const level = levelForRatio(item.ratio);
    if (!level) continue;
    const entryKey = buildHintEntryKey(progress.month, 'category', item.categoryId);
    if (!shouldNotify(shownMap[entryKey], level)) continue;
    alerts.push({
      entryKey,
      level,
      message:
        level === 'over'
          ? `「${item.categoryName}」分类预算已超支`
          : `「${item.categoryName}」分类预算已使用 ${formatPercent(item.ratio)}`,
    });
  }

  return alerts;
}
