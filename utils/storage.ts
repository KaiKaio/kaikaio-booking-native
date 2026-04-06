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

export const getBillMonthCacheKey = (month: string) => `${BILL_MONTH_CACHE_PREFIX}${month}`;

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
    PENDING_BILLS_STORAGE_KEY,
    CATEGORIES_CACHE_STORAGE_KEY,
    ACTIVE_ACCOUNT_STORAGE_KEY,
  ];

  const keysToRemove = Array.from(new Set([...fixedKeys, ...dynamicKeys]));
  if (keysToRemove.length === 0) return;

  await AsyncStorage.multiRemove(keysToRemove);
}
