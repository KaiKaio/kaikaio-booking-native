import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveAccount } from './storage';

// 用户隔离的分类使用记录 key 前缀（LRU：记录每个分类最近使用时间）
const CATEGORY_USAGE_PREFIX = 'category_usage_lru';
// 最多保留的分类记录条数，防止无限增长
const MAX_USAGE_ENTRIES = 100;

export const getCategoryUsageKey = (account: string) =>
  `${CATEGORY_USAGE_PREFIX}:${account}`;

/**
 * 记录一次分类使用（更新最近使用时间）
 */
export async function recordCategoryUsage(categoryId: number): Promise<void> {
  if (!categoryId) return;

  const account = await getActiveAccount();
  if (!account) return;

  const key = getCategoryUsageKey(account);
  let usage: Record<string, number> = {};

  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      usage = JSON.parse(raw) || {};
    }
  } catch (error) {
    console.error('Failed to load category usage', error);
  }

  usage[String(categoryId)] = Date.now();

  // 超出上限时，淘汰最久未使用的记录
  const entries = Object.entries(usage).sort((a, b) => b[1] - a[1]);
  if (entries.length > MAX_USAGE_ENTRIES) {
    usage = Object.fromEntries(entries.slice(0, MAX_USAGE_ENTRIES));
  }

  try {
    await AsyncStorage.setItem(key, JSON.stringify(usage));
  } catch (error) {
    console.error('Failed to save category usage', error);
  }
}

/**
 * 读取分类最近使用时间映射：{ categoryId: timestamp }
 */
export async function getCategoryUsageMap(): Promise<Record<number, number>> {
  const account = await getActiveAccount();
  if (!account) return {};

  try {
    const raw = await AsyncStorage.getItem(getCategoryUsageKey(account));
    if (!raw) return {};

    const parsed = JSON.parse(raw) || {};
    const result: Record<number, number> = {};
    Object.keys(parsed).forEach(id => {
      const numericId = Number(id);
      if (!Number.isNaN(numericId)) {
        result[numericId] = parsed[id];
      }
    });
    return result;
  } catch (error) {
    console.error('Failed to read category usage', error);
    return {};
  }
}

/**
 * 按最近使用时间倒序排序分类（稳定排序，未使用过的保持原有顺序）
 */
export function sortCategoriesByUsage<T extends { id: number }>(
  categories: T[],
  usageMap: Record<number, number>
): T[] {
  return [...categories].sort((a, b) => {
    const timeA = usageMap[a.id] ?? 0;
    const timeB = usageMap[b.id] ?? 0;
    return timeB - timeA;
  });
}
