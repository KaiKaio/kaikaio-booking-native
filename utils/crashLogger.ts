import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ===== 本地崩溃/异常日志 =====
//
// 捕获 JS 层致命错误（渲染异常、未捕获的 Promise rejection），
// 滚动写入 AsyncStorage，供 DebugTools 页「崩溃日志」查看，便于追查偶发闪退。
// 注意：只能覆盖 JS 层异常；原生层崩溃（ObjC/Swift/Java 层）需接入 Sentry 等工具。

const CRASH_LOG_STORAGE_KEY = 'crash_logs';
// 最多保留条数（滚动覆盖，防止无限增长）
const MAX_CRASH_LOGS = 50;

export interface CrashLogEntry {
  // 发生时间（ISO 字符串）
  time: string;
  // fatal=未被任何 ErrorBoundary 捕获的全局错误；boundary=渲染期错误（被 ErrorBoundary 捕获）
  kind: 'fatal' | 'boundary' | 'promise';
  message: string;
  stack?: string;
  componentStack?: string;
  appVersion?: string;
  os?: string;
}

export async function loadCrashLogs(): Promise<CrashLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(CRASH_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

export async function clearCrashLogs(): Promise<void> {
  await AsyncStorage.removeItem(CRASH_LOG_STORAGE_KEY);
}

/**
 * 记录一条崩溃日志（最新在前，超限滚动丢弃）。
 * 写入失败静默忽略——日志本身不能反过来引发崩溃。
 */
export async function recordCrash(entry: Omit<CrashLogEntry, 'time' | 'appVersion' | 'os'>): Promise<void> {
  try {
    const full: CrashLogEntry = {
      ...entry,
      time: new Date().toISOString(),
      appVersion: Constants.expoConfig?.version,
      os: `${Platform.OS} ${String(Platform.Version)}`,
    };
    const logs = await loadCrashLogs();
    await AsyncStorage.setItem(
      CRASH_LOG_STORAGE_KEY,
      JSON.stringify([full, ...logs].slice(0, MAX_CRASH_LOGS))
    );
  } catch (error) {
    console.error('recordCrash failed', error);
  }
}

function describeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: `${error.name}: ${error.message}`, stack: error.stack };
  }
  try {
    return { message: String(error) };
  } catch {
    return { message: 'Unknown error' };
  }
}

/**
 * 安装全局异常捕获（在入口文件尽早调用一次）：
 * - ErrorUtils 全局处理器：未被 ErrorBoundary 捕获的渲染/事件错误
 * - unhandledrejection：未捕获的 Promise 异常
 */
export function initCrashLogger(): void {
  const globalAny = global as any;

  const prevHandler = globalAny.ErrorUtils?.getGlobalHandler?.();
  globalAny.ErrorUtils?.setGlobalHandler?.((error: unknown, isFatal?: boolean) => {
    const { message, stack } = describeError(error);
    void recordCrash({ kind: 'fatal', message: `${isFatal === false ? '[non-fatal] ' : ''}${message}`, stack });
    if (typeof prevHandler === 'function') {
      prevHandler(error, isFatal);
    }
  });

  const tracking = require('promise/setimmediate/rejection-tracking');
  const previousOnUnhandled = tracking._onUnhandled;
  tracking._onUnhandled = (id: number, error: unknown) => {
    const { message, stack } = describeError(error);
    void recordCrash({ kind: 'promise', message, stack });
    if (typeof previousOnUnhandled === 'function') {
      previousOnUnhandled(id, error);
    }
  };
}
