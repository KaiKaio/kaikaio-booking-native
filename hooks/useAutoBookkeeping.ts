import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
// 注意：你需要安装 expo-clipboard: npx expo install expo-clipboard
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { billParser } from '../services/parser';
import { ParsedBill } from '../services/parser/types';
import { getActiveAccount } from '../utils/storage';
import { traceSync } from '../utils/perfTracing';

// 用户隔离的「已识别账单」哈希 key 前缀（去重：已导入过的账单不再重复弹窗）
const SEEN_HASHES_PREFIX = 'clipboard_seen_hashes';
// 最多保留的哈希条数，防止无限增长
const MAX_SEEN_HASHES = 200;
// 防抖窗口：同一内容短时间内不重复触发
const DEBOUNCE_MS = 60 * 1000;

export const getSeenHashesKey = (account: string) => `${SEEN_HASHES_PREFIX}:${account}`;

/**
 * 轻量字符串哈希（djb2），用于账单原文去重
 */
export function hashText(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    // eslint-disable-next-line no-bitwise
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  // eslint-disable-next-line no-bitwise
  return `${text.length}_${(hash >>> 0).toString(36)}`;
}

async function getSeenHashes(account: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(getSeenHashesKey(account));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load seen hashes', error);
    return [];
  }
}

async function markHashSeen(account: string, hash: string): Promise<void> {
  try {
    const seen = await getSeenHashes(account);
    if (seen.includes(hash)) return;
    seen.unshift(hash);
    await AsyncStorage.setItem(
      getSeenHashesKey(account),
      JSON.stringify(seen.slice(0, MAX_SEEN_HASHES))
    );
  } catch (error) {
    console.error('Failed to save seen hash', error);
  }
}

export function useAutoBookkeeping() {
  const [detectedBill, setDetectedBill] = useState<ParsedBill | null>(null);
  // 防抖：记录上次触发检测的内容与时间
  const lastDetectedRef = useRef<{ content: string; time: number } | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', checkClipboard);

    // 首次加载检查一次
    checkClipboard(AppState.currentState);

    return () => {
      subscription.remove();
    };
  }, []);

  const checkClipboard = async (state: AppStateStatus) => {
    if (state !== 'active') return;

    try {
      const hasString = await Clipboard.hasStringAsync();
      if (!hasString) return;

      const content = await Clipboard.getStringAsync();
      if (!content || !content.trim()) return;

      // 防抖：同一内容在窗口期内不重复触发
      const last = lastDetectedRef.current;
      if (last && last.content === content && Date.now() - last.time < DEBOUNCE_MS) {
        return;
      }

      // 解析
      const result = traceSync('bill.parse', 'clipboard bill parse', () => billParser.parse(content));
      if (!result) return;

      // 去重：已识别/导入过的账单内容不再重复弹窗
      const hash = hashText(result.rawText.trim());
      const account = await getActiveAccount();
      if (account) {
        const seen = await getSeenHashes(account);
        if (seen.includes(hash)) return;
        await markHashSeen(account, hash);
      }

      lastDetectedRef.current = { content, time: Date.now() };
      setDetectedBill(result);
    } catch (e) {
      console.log('Clipboard check failed (module might not be installed)', e);
    }
  };

  const clearDetectedBill = useCallback(() => {
    setDetectedBill(null);
  }, []);

  return {
    detectedBill,
    clearDetectedBill
  };
}
