// request.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from './config';
import { navigate } from './utils/navigationRef';
import {
  TOKEN_STORAGE_KEY,
  CATEGORIES_CACHE_STORAGE_KEY,
  LAST_SELECTED_DATE_STORAGE_KEY,
  // ACTIVE_ACCOUNT_STORAGE_KEY,
  USER_CREDENTIALS_STORAGE_KEY,
  BILL_MONTH_CACHE_PREFIX,
} from './utils/storage';

export default async function request(url: string, options: any = {}) {
  const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);

  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: token } : {}),
    ...(options.headers || {}),
  };
  const finalOptions = {
    ...options,
    headers: defaultHeaders,
  };

  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;

  const timeout = options.timeout || 5000; // 默认超时时间 10 秒
  const controller = new AbortController();
  finalOptions.signal = controller.signal;
  let timeoutId: NodeJS.Timeout | number | undefined;
  try {
    timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);
    console.log('Request Start:', fullUrl, finalOptions);
    const response = await fetch(fullUrl, finalOptions);
    clearTimeout(timeoutId);

    if (response.status === 401) {
      let msg = '登录过期，请重新登录';
      try {
        const errData = await response.json();
        console.log('Request Error Response 401:', fullUrl, errData);
        if (errData?.msg) {
          msg = errData.msg;
        }
      } catch (e) {
        console.log('Request Error Response 401 (Parse Error):', fullUrl, {
          status: response.status,
          statusText: response.statusText,
        });
      }

      // 401 时不清除离线账单数据,只清除认证相关数据
      // 离线账单会在用户重新登录后继续同步
      const keysToRemove = [
        TOKEN_STORAGE_KEY,
        USER_CREDENTIALS_STORAGE_KEY,
        CATEGORIES_CACHE_STORAGE_KEY,
        LAST_SELECTED_DATE_STORAGE_KEY,
      ];

      // 清除月度缓存(避免数据过大)
      const allKeys = await AsyncStorage.getAllKeys();
      const monthCacheKeys = allKeys.filter(key =>
        key.startsWith(BILL_MONTH_CACHE_PREFIX)
      );
      keysToRemove.push(...monthCacheKeys);

      await AsyncStorage.multiRemove(keysToRemove);

      console.log('401: 已清除认证数据,保留离线账单数据');

      navigate('Login');
      throw new Error(msg);
    }

    if (!response.ok) {
      let msg = '服务器错误';
      try {
        console.log('Request Error Response:', fullUrl, response);
        const errData = await response.json();
        console.log('Request Error Data:', fullUrl, errData);
        msg = errData.msg || msg;
      } catch (err: any) {
        console.error(err, '!response.ok')
      }
      throw new Error(msg);
    }
    const data = await response.json();
    console.log('Request Success:', fullUrl, data);
    return data;
  } catch (err: any) {
    console.error(err, 'Rquest Error')

    if (err?.message === 'NETWORK_UNAVAILABLE' || err?.message === 'REQUEST_TIMEOUT') {
      throw err;
    }

    if (err.name === 'AbortError') {
      throw new Error('REQUEST_TIMEOUT');
    }

    if (err instanceof TypeError && err.message.includes('Network request failed')) {
      throw new Error('NETWORK_UNAVAILABLE');
    }

    const errorMsg = err instanceof Error ? err.message : '网络错误';
    throw new Error(errorMsg);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
