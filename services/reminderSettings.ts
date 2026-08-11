import AsyncStorage from '@react-native-async-storage/async-storage';
import { markConfigChanged } from './configSync';

// ===== 漏记提醒设置（本地通知 + 漏记检测） =====

export interface ReminderSettings {
  // 每晚固定时间本地通知提醒
  enabled: boolean;
  hour: number;
  minute: number;
  // 漏记检测：当天零记录且有记账习惯时轻提示
  missedDetectEnabled: boolean;
  // 预算超支轻提醒（P3 预算辅助，默认开）
  budgetHintEnabled?: boolean;
}

// 用户隔离的提醒设置 key 前缀
const REMINDER_SETTINGS_PREFIX = 'reminder_settings_user';

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  hour: 21,
  minute: 0,
  missedDetectEnabled: true,
  budgetHintEnabled: true,
};

export const getReminderSettingsKey = (account: string) =>
  `${REMINDER_SETTINGS_PREFIX}:${account}`;

export async function loadReminderSettings(
  account: string
): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(getReminderSettingsKey(account));
    if (!raw) return { ...DEFAULT_REMINDER_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_REMINDER_SETTINGS, ...parsed };
  } catch (error) {
    console.error('Failed to load reminder settings', error);
    return { ...DEFAULT_REMINDER_SETTINGS };
  }
}

export async function saveReminderSettings(
  account: string,
  settings: ReminderSettings,
  options?: { silent?: boolean }
): Promise<void> {
  await AsyncStorage.setItem(
    getReminderSettingsKey(account),
    JSON.stringify(settings)
  );
  // silent：云端同步拉取落盘时使用，避免触发推送回环
  if (!options?.silent) {
    await markConfigChanged(account, 'reminder_settings', 'default');
  }
}
