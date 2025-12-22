import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
// 注意：你需要安装 expo-clipboard: npx expo install expo-clipboard
import * as Clipboard from 'expo-clipboard';
import { billParser } from '../services/parser';
import { ParsedBill } from '../services/parser/types';

export function useAutoBookkeeping() {
  const [detectedBill, setDetectedBill] = useState<ParsedBill | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', checkClipboard);
    
    // 首次加载检查一次
    checkClipboard(AppState.currentState);

    return () => {
      subscription.remove();
    };
  }, []);

  const checkClipboard = async (state: AppStateStatus) => {
    if (state === 'active') {
      try {
        const hasString = await Clipboard.hasStringAsync();
        if (hasString) {
          const content = await Clipboard.getStringAsync();
          // 解析
          const result = billParser.parse(content);
          if (result) {
            // 这里可以加一个简单的防抖或去重逻辑，比如比较上次解析的内容
            setDetectedBill(result);
          }
        }
      } catch (e) {
        console.log('Clipboard check failed (module might not be installed)', e);
      }
    }
  };

  const clearDetectedBill = () => {
    setDetectedBill(null);
  };

  return {
    detectedBill,
    clearDetectedBill
  };
}
