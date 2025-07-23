// request.ts
export default async function request(url: string, options: any = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const finalOptions = {
    ...options,
    headers: defaultHeaders,
  };
  const timeout = options.timeout || 5000; // 默认超时时间 10 秒
  const controller = new AbortController();
  finalOptions.signal = controller.signal;
  let timeoutId: NodeJS.Timeout | number | undefined;
  try {
    timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);
    const response = await fetch(url, finalOptions);
    clearTimeout(timeoutId);
    if (!response.ok) {
      let msg = '服务器错误';
      try {
        console.log(response, '=> errData')
        const errData = await response.json();
        msg = errData.msg || msg;
      } catch (err: any) {
        console.error(err, '!response.ok')
      }
      throw new Error(msg);
    }
    return await response.json();
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