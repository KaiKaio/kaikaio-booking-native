// request.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from './config';
import { navigate } from './utils/navigationRef';
import {
  TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
  CATEGORIES_CACHE_STORAGE_KEY,
  LAST_SELECTED_DATE_STORAGE_KEY,
  // ACTIVE_ACCOUNT_STORAGE_KEY,
  USER_CREDENTIALS_STORAGE_KEY,
  BILL_MONTH_CACHE_PREFIX,
} from './utils/storage';

const REFRESH_URL = `${BASE_URL}/api/user/refresh`;

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
      if (!refreshToken) {
        console.log('没有 refreshToken，无法刷新');
        return false;
      }

      console.log('开始刷新 token...');
      const response = await fetch(REFRESH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          refreshToken
        })
      });

      if (!response.ok) {
        console.log('刷新 token 失败:', response.status);
        return false;
      }

      const data = await response.json();
      if (data.accessToken) {
        await AsyncStorage.setItem(TOKEN_STORAGE_KEY, data.accessToken);
        if (data.refreshToken) {
          await AsyncStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, data.refreshToken);
        }
        console.log('token 刷新成功');
        return true;
      }

      return false;
    } catch (err) {
      console.error('刷新 token 异常:', err);
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

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
      const isRefreshRequest = url === REFRESH_URL;
      
      if (!isRefreshRequest) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          const newToken = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
          const retryHeaders = {
            ...defaultHeaders,
            ...(newToken ? { Authorization: newToken } : {}),
          };
          console.log('Token 已刷新，重试请求:', fullUrl);
          const retryResponse = await fetch(fullUrl, {
            ...finalOptions,
            headers: retryHeaders,
          });
          
          if (!retryResponse.ok) {
            if (retryResponse.status === 401) {
              console.log('重试仍然 401，跳转登录');
            } else {
              let msg = '服务器错误';
              try {
                const errData = await retryResponse.json();
                msg = errData.msg || msg;
              } catch (err: any) {
                console.error(err, 'retry response parse error');
              }
              throw new Error(msg);
            }
          } else {
            const data = await retryResponse.json();
            console.log('Request Success (Retry):', fullUrl, data);
            return data;
          }
        }
      }

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

      const keysToRemove = [
        TOKEN_STORAGE_KEY,
        REFRESH_TOKEN_STORAGE_KEY,
        USER_CREDENTIALS_STORAGE_KEY,
        CATEGORIES_CACHE_STORAGE_KEY,
        LAST_SELECTED_DATE_STORAGE_KEY,
      ];

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
