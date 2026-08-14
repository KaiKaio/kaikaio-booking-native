import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Switch,
  Modal,
  TextInput,
  ScrollView,
  Alert,
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
import * as Notifications from 'expo-notifications';
import { isMotivationEnabled, setMotivationEnabled } from '../services/bookkeepingStreak';
import {
  BudgetListData,
  BudgetScope,
  deleteBudget,
  fetchBudgetList,
  saveBudget,
  saveBudgetListCache,
} from '../services/budgets';
import { useCategory } from '../context/CategoryContext';

// 可选的提醒时点（小时）
const REMINDER_HOURS = [18, 19, 20, 21, 22, 23];

const Personalization = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { categories } = useCategory();
  const [keepLastDate, setKeepLastDateState] = useState(true);
  const [reminder, setReminder] = useState<ReminderSettings | null>(null);
  // P3：习惯激励开关
  const [motivationEnabled, setMotivationEnabledState] = useState(true);
  // P3：预算配置（云端同步）
  const [budgetList, setBudgetList] = useState<BudgetListData | null>(null);
  // 预算编辑弹窗
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [budgetScope, setBudgetScope] = useState<BudgetScope>('total');
  const [budgetCategoryId, setBudgetCategoryId] = useState<number | undefined>(undefined);
  const [budgetAmountInput, setBudgetAmountInput] = useState('');
  const [budgetSaving, setBudgetSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const value = await getKeepLastDate();
      setKeepLastDateState(value);

      const account = await getActiveAccount();
      if (account) {
        const settings = await loadReminderSettings(account);
        setReminder(settings);
        setMotivationEnabledState(await isMotivationEnabled(account));
      }

      // 预算配置（接口失败时不影响其他设置展示）
      const list = await fetchBudgetList();
      setBudgetList(list);
      if (list) {
        const currentAccount = await getActiveAccount();
        if (currentAccount) {
          await saveBudgetListCache(currentAccount, list);
        }
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

  // 提醒总开关：开启的那一刻主动请求一次通知权限（用户明确动作，不会成环；
  // 后台重调度链路只静默查询权限，绝不重复弹窗）。关闭不请求。
  const handleToggleReminder = useCallback(
    async (value: boolean) => {
      if (value) {
        try {
          const permission = await Notifications.requestPermissionsAsync();
          if (permission.status !== 'granted') {
            Alert.alert(
              '未获得通知权限',
              '提醒开关已开启，但通知权限未授权，提醒可能无法送达。可前往系统设置开启通知权限。'
            );
          }
        } catch (error) {
          console.error('Failed to request notification permission', error);
        }
      }
      updateReminder({ enabled: value });
    },
    [updateReminder]
  );

  // P3：切换习惯激励开关
  const handleToggleMotivation = useCallback(async (value: boolean) => {
    setMotivationEnabledState(value);
    const account = await getActiveAccount();
    if (account) {
      await setMotivationEnabled(account, value);
    }
  }, []);

  // P3：打开预算编辑弹窗
  const openBudgetModal = useCallback((scope: BudgetScope, categoryId?: number, currentAmount?: number) => {
    setBudgetScope(scope);
    setBudgetCategoryId(categoryId);
    setBudgetAmountInput(currentAmount ? String(currentAmount) : '');
    setBudgetModalVisible(true);
  }, []);

  // P3：保存预算（新增/更新）
  const handleSaveBudget = useCallback(async () => {
    const amount = parseFloat(budgetAmountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('提示', '请输入大于 0 的预算金额');
      return;
    }
    if (budgetScope === 'category' && !budgetCategoryId) {
      Alert.alert('提示', '请选择预算分类');
      return;
    }
    setBudgetSaving(true);
    const ok = await saveBudget({
      scope: budgetScope,
      categoryId: budgetScope === 'category' ? budgetCategoryId : undefined,
      amount,
    });
    setBudgetSaving(false);
    if (!ok) {
      Alert.alert('提示', '预算保存失败，请稍后重试');
      return;
    }
    setBudgetModalVisible(false);
    const list = await fetchBudgetList();
    setBudgetList(list);
    if (list) {
      const account = await getActiveAccount();
      if (account) await saveBudgetListCache(account, list);
    }
  }, [budgetAmountInput, budgetCategoryId, budgetScope]);

  // P3：删除预算
  const handleDeleteBudget = useCallback(async () => {
    setBudgetSaving(true);
    const ok = await deleteBudget({
      scope: budgetScope,
      categoryId: budgetScope === 'category' ? budgetCategoryId : undefined,
    });
    setBudgetSaving(false);
    if (!ok) {
      Alert.alert('提示', '预算删除失败，请稍后重试');
      return;
    }
    setBudgetModalVisible(false);
    const list = await fetchBudgetList();
    setBudgetList(list);
    if (list) {
      const account = await getActiveAccount();
      if (account) await saveBudgetListCache(account, list);
    }
  }, [budgetCategoryId, budgetScope]);

  // 预算弹窗可选分类：仅支出类
  const expenseCategories = categories.filter(cat => cat.type === '1');
  // 已设分类预算的分类 id，新增时避免重复
  const budgetedCategoryIds = new Set(
    (budgetList?.categoryBudgets || []).map(item => item.categoryId)
  );

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

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
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
                onValueChange={handleToggleReminder}
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

            <View style={[styles.settingItem, styles.settingItemDivider]}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>预算超支提醒</Text>
                <Text style={styles.settingDescription}>
                  记账后若预算达到 80% 或超支，轻提示一次（同档位每月只提示一次）
                </Text>
              </View>
              <Switch
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.background.paper}
                ios_backgroundColor={theme.colors.border}
                onValueChange={value => updateReminder({ budgetHintEnabled: value })}
                value={reminder.budgetHintEnabled !== false}
              />
            </View>
          </View>
        )}

        {/* P3：习惯激励 */}
        <View style={styles.card}>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>习惯激励</Text>
              <Text style={styles.settingDescription}>
                展示连续记账天数，连记达 7/30/100/365 天时轻祝贺一次
              </Text>
            </View>
            <Switch
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.background.paper}
              ios_backgroundColor={theme.colors.border}
              onValueChange={handleToggleMotivation}
              value={motivationEnabled}
            />
          </View>
        </View>

        {/* P3：预算辅助（配置随账号云端同步） */}
        <View style={styles.card}>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>月度总预算</Text>
              <Text style={styles.settingDescription}>
                统计页展示进度，接近上限时变色预警
              </Text>
            </View>
            <TouchableOpacity onPress={() => openBudgetModal('total', undefined, budgetList?.totalBudget?.amount)}>
              <View style={styles.infoRight}>
                <Text style={styles.budgetAmountText}>
                  {budgetList?.totalBudget ? `¥${budgetList.totalBudget.amount}` : '未设置'}
                </Text>
                <Icon name="chevron-right" size={20} color={theme.colors.text.placeholder} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={[styles.settingItem, styles.settingItemDivider]}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>分类预算</Text>
              <Text style={styles.settingDescription}>
                为高频分类单独设预算（如餐饮/交通）
              </Text>
            </View>
            <TouchableOpacity onPress={() => openBudgetModal('category')}>
              <View style={styles.infoRight}>
                <Icon name="add" size={20} color={theme.colors.primary} />
              </View>
            </TouchableOpacity>
          </View>

          {(budgetList?.categoryBudgets || []).map(item => (
            <TouchableOpacity
              key={item.categoryId}
              style={[styles.settingItem, styles.settingItemDivider, styles.categoryBudgetRow]}
              onPress={() => openBudgetModal('category', item.categoryId, item.amount)}
            >
              <Text style={styles.categoryBudgetName}>{item.categoryName}</Text>
              <View style={styles.infoRight}>
                <Text style={styles.budgetAmountText}>¥{item.amount}</Text>
                <Icon name="chevron-right" size={20} color={theme.colors.text.placeholder} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* P3：预算编辑弹窗 */}
      <Modal
        transparent
        visible={budgetModalVisible}
        animationType="fade"
        onRequestClose={() => setBudgetModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.budgetModalOverlay}
          activeOpacity={1}
          onPress={() => setBudgetModalVisible(false)}
        >
          <View style={styles.budgetModalPanel}>
            <Text style={styles.budgetModalTitle}>
              {budgetScope === 'total' ? '月度总预算' : '分类预算'}
            </Text>

            {budgetScope === 'category' && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.budgetCategoryScroll}
              >
                {expenseCategories.map(cat => {
                  const selected = budgetCategoryId === cat.id;
                  const disabled = !selected && budgetedCategoryIds.has(cat.id);
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.budgetCategoryChip,
                        selected && styles.budgetCategoryChipActive,
                        disabled && styles.budgetCategoryChipDisabled,
                      ]}
                      disabled={disabled}
                      onPress={() => setBudgetCategoryId(cat.id)}
                    >
                      <Text
                        style={[
                          styles.budgetCategoryChipText,
                          selected && styles.budgetCategoryChipTextActive,
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.budgetAmountRow}>
              <Text style={styles.budgetAmountSymbol}>¥</Text>
              <TextInput
                style={styles.budgetAmountInput}
                value={budgetAmountInput}
                onChangeText={setBudgetAmountInput}
                placeholder="输入每月预算金额"
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>

            <View style={styles.budgetModalActions}>
              {budgetScope === 'total' && budgetList?.totalBudget ? (
                <TouchableOpacity
                  style={[styles.budgetModalBtn, styles.budgetModalBtnDanger]}
                  onPress={handleDeleteBudget}
                  disabled={budgetSaving}
                >
                  <Text style={styles.budgetModalBtnDangerText}>删除</Text>
                </TouchableOpacity>
              ) : null}
              {budgetScope === 'category' && budgetCategoryId && budgetedCategoryIds.has(budgetCategoryId) ? (
                <TouchableOpacity
                  style={[styles.budgetModalBtn, styles.budgetModalBtnDanger]}
                  onPress={handleDeleteBudget}
                  disabled={budgetSaving}
                >
                  <Text style={styles.budgetModalBtnDangerText}>删除</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[styles.budgetModalBtn, styles.budgetModalBtnPrimary]}
                onPress={handleSaveBudget}
                disabled={budgetSaving}
              >
                <Text style={styles.budgetModalBtnPrimaryText}>
                  {budgetSaving ? '保存中…' : '保存'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
  infoRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  budgetAmountText: {
    fontSize: 15,
    color: theme.colors.text.primary,
    marginRight: 4,
  },
  categoryBudgetRow: {
    paddingVertical: 4,
  },
  categoryBudgetName: {
    fontSize: 15,
    color: theme.colors.text.secondary,
  },
  budgetModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  budgetModalPanel: {
    backgroundColor: theme.colors.background.paper,
    borderRadius: 16,
    padding: 20,
  },
  budgetModalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  budgetCategoryScroll: {
    marginBottom: 12,
  },
  budgetCategoryChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: theme.colors.background.neutral,
    marginRight: 8,
  },
  budgetCategoryChipActive: {
    backgroundColor: theme.colors.primary,
  },
  budgetCategoryChipDisabled: {
    opacity: 0.4,
  },
  budgetCategoryChipText: {
    fontSize: 13,
    color: theme.colors.text.secondary,
  },
  budgetCategoryChipTextActive: {
    color: theme.colors.text.inverse,
    fontWeight: '600',
  },
  budgetAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: 20,
  },
  budgetAmountSymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginRight: 6,
  },
  budgetAmountInput: {
    flex: 1,
    fontSize: 18,
    color: theme.colors.text.primary,
    paddingVertical: 8,
  },
  budgetModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  budgetModalBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 12,
  },
  budgetModalBtnDanger: {
    backgroundColor: 'rgba(229, 57, 53, 0.1)',
  },
  budgetModalBtnDangerText: {
    color: '#E53935',
    fontSize: 14,
    fontWeight: '600',
  },
  budgetModalBtnPrimary: {
    backgroundColor: theme.colors.primary,
  },
  budgetModalBtnPrimaryText: {
    color: theme.colors.text.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default Personalization;
