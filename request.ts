// request.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from './config';
import { navigate } from './utils/navigationRef';

export default async function request(url: string, options: any = {}) {
  const token = await AsyncStorage.getItem('token');
  
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
      await AsyncStorage.removeItem('token');
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
    if (err.name === 'AbortError') {
      throw new Error('请求超时，请稍后重试');
    }
    const errorMsg = err instanceof Error ? err.message : '网络错误';
    throw new Error(errorMsg);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
} 