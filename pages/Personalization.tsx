import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RootStackParamList } from '../types/navigation';
import { theme } from '@/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getKeepLastDate, setKeepLastDate, getActiveAccount } from '@/utils/storage';
import {
  ReminderSettings,
  loadReminderSettings,
  saveReminderSettings,
} from '../services/reminderSettings';
import { triggerReminderResync } from '../hooks/useReminderScheduler';

// 可选的提醒时点（小时）
const REMINDER_HOURS = [18, 19, 20, 21, 22, 23];

const Personalization = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [keepLastDate, setKeepLastDateState] = useState(true);
  const [reminder, setReminder] = useState<ReminderSettings | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const value = await getKeepLastDate();
      setKeepLastDateState(value);

      const account = await getActiveAccount();
      if (account) {
        const settings = await loadReminderSettings(account);
        setReminder(settings);
      }
    };
    loadSettings();
  }, []);

  const handleToggleKeepLastDate = async (value: boolean) => {
    setKeepLastDateState(value);
    await setKeepLastDate(value);
  };

  // 更新提醒设置并重新调度本地通知（先落盘再触发重调度，避免竞态）
  const updateReminder = useCallback(async (patch: Partial<ReminderSettings>) => {
    const account = await getActiveAccount();
    if (!account) return;

    const current = await loadReminderSettings(account);
    const next = { ...current, ...patch };
    setReminder(next);
    await saveReminderSettings(account, next);
    triggerReminderResync();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>个性化</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>退出保留日期</Text>
              <Text style={styles.settingDescription}>
                打开 App 时首次记账使用上次记账的日期
              </Text>
            </View>
            <Switch
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.background.paper}
              ios_backgroundColor={theme.colors.border}
              onValueChange={handleToggleKeepLastDate}
              value={keepLastDate}
            />
          </View>
        </View>

        {/* 漏记提醒与补账 */}
        {reminder && (
          <View style={styles.card}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>每晚记账提醒</Text>
                <Text style={styles.settingDescription}>
                  每天固定时间推送本地通知，提醒记录当天收支
                </Text>
              </View>
              <Switch
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.background.paper}
                ios_backgroundColor={theme.colors.border}
                onValueChange={value => updateReminder({ enabled: value })}
                value={reminder.enabled}
              />
            </View>

            {reminder.enabled && (
              <View style={styles.hourRow}>
                {REMINDER_HOURS.map(hour => (
                  <TouchableOpacity
                    key={hour}
                    style={[
                      styles.hourChip,
                      reminder.hour === hour && styles.hourChipActive,
                    ]}
                    onPress={() => updateReminder({ hour, minute: 0 })}
                  >
                    <Text
                      style={[
                        styles.hourChipText,
                        reminder.hour === hour && styles.hourChipTextActive,
                      ]}
                    >
                      {hour}:00
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={[styles.settingItem, styles.settingItemDivider]}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>漏记检测</Text>
                <Text style={styles.settingDescription}>
                  晚上打开 App 时，若当天零记录且你有记账习惯，轻提示一次
                </Text>
              </View>
              <Switch
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.background.paper}
                ios_backgroundColor={theme.colors.border}
                onValueChange={value => updateReminder({ missedDetectEnabled: value })}
                value={reminder.missedDetectEnabled}
              />
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background.default,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.background.paper,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: theme.colors.background.paper,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingItemDivider: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: theme.colors.text.placeholder,
    lineHeight: 18,
  },
  hourRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  hourChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: theme.colors.background.neutral,
    marginRight: 8,
    marginBottom: 8,
  },
  hourChipActive: {
    backgroundColor: theme.colors.primary,
  },
  hourChipText: {
    fontSize: 13,
    color: theme.colors.text.secondary,
  },
  hourChipTextActive: {
    color: theme.colors.text.inverse,
    fontWeight: '600',
  },
});

export default Personalization;
