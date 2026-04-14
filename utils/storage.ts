import AsyncStorage from '@react-native-async-storage/async-storage';

export const TOKEN_STORAGE_KEY = 'token';
export const USER_CREDENTIALS_STORAGE_KEY = 'user_credentials';
export const LAST_SELECTED_DATE_STORAGE_KEY = 'lastSelectedDate';
export const PENDING_BILLS_STORAGE_KEY = 'pendingOptimisticBills';
export const CATEGORIES_CACHE_STORAGE_KEY = 'categories_cache';
export const ACTIVE_ACCOUNT_STORAGE_KEY = 'active_account';

export const BILL_MONTH_CACHE_PREFIX = 'bills_month_cache_';
const LEGACY_BILL_CACHE_PREFIX = 'bills_cache_';
const LEGACY_BILL_META_PREFIX = 'bills_meta_';

// 用户隔离的离线账单存储 key 前缀
const PENDING_BILLS_USER_PREFIX = 'pending_bills_user';

export const getBillMonthCacheKey = (month: string) => `${BILL_MONTH_CACHE_PREFIX}${month}`;

/**
 * 获取当前用户的待同步账单存储 key
 */
export function getUserPendingBillsKey(account: string): string {
  return `${PENDING_BILLS_USER_PREFIX}:${account}`;
}

/**
 * 获取当前活跃账号
 */
export async function getActiveAccount(): Promise<string | null> {
  return await AsyncStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY);
}

/**
 * 保存用户隔离的待同步账单
 */
export async function saveUserPendingBills(
  account: string,
  bills: any[]
): Promise<void> {
  const key = getUserPendingBillsKey(account);
  await AsyncStorage.setItem(key, JSON.stringify(bills));
}

/**
 * 获取用户隔离的待同步账单
 */
export async function getUserPendingBills(account: string): Promise<any[]> {
  const key = getUserPendingBillsKey(account);
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

/**
 * 清除指定用户的待同步账单
 */
export async function removeUserPendingBills(account: string): Promise<void> {
  const key = getUserPendingBillsKey(account);
  await AsyncStorage.removeItem(key);
}

/**
 * 清除所有用户的待同步账单（用于清理遗留数据）
 */
export async function clearAllUserPendingBills(): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const pendingKeys = allKeys.filter(key =>
    key.startsWith(`${PENDING_BILLS_USER_PREFIX}:`)
  );
  if (pendingKeys.length > 0) {
    await AsyncStorage.multiRemove(pendingKeys);
  }
}

export async function clearUserLocalData() {
  const allKeys = await AsyncStorage.getAllKeys();
  const dynamicKeys = allKeys.filter(
    key =>
      key.startsWith(BILL_MONTH_CACHE_PREFIX) ||
      key.startsWith(LEGACY_BILL_CACHE_PREFIX) ||
      key.startsWith(LEGACY_BILL_META_PREFIX)
  );

  const fixedKeys = [
    TOKEN_STORAGE_KEY,
    USER_CREDENTIALS_STORAGE_KEY,
    LAST_SELECTED_DATE_STORAGE_KEY,
    PENDING_BILLS_STORAGE_KEY, // 保留旧的兼容,后续会清理
    CATEGORIES_CACHE_STORAGE_KEY,
    ACTIVE_ACCOUNT_STORAGE_KEY,
  ];

  const keysToRemove = Array.from(new Set([...fixedKeys, ...dynamicKeys]));
  if (keysToRemove.length === 0) return;

  await AsyncStorage.multiRemove(keysToRemove);
}
