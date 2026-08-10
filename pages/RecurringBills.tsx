import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/theme';
import { RootStackParamList } from '../types/navigation';
import { useCategory } from '../context/CategoryContext';
import CategoryIcon from '../components/CategoryIcon';
import DatePicker from '../components/DatePicker';
import { getActiveAccount } from '../utils/storage';
import {
  RecurringBill,
  RecurringCycle,
  RecurringMode,
  CYCLE_LABELS,
  MODE_LABELS,
  loadRecurringBills,
  upsertRecurringBill,
  deleteRecurringBill,
  generateRecurringId,
  formatDateStr,
  parseDateStr,
  todayStr,
} from '../services/recurringBills';

const CYCLE_OPTIONS: RecurringCycle[] = ['weekly', 'monthly', 'yearly'];
const MODE_OPTIONS: RecurringMode[] = ['silent', 'confirm'];

interface FormState {
  editingId: string | null;
  name: string;
  amount: string;
  type: '1' | '2';
  categoryId: number | null;
  cycle: RecurringCycle;
  mode: RecurringMode;
  startDate: string;
}

const EMPTY_FORM: FormState = {
  editingId: null,
  name: '',
  amount: '',
  type: '1',
  categoryId: null,
  cycle: 'monthly',
  mode: 'silent',
  startDate: todayStr(),
};

const RecurringBills = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { categories } = useCategory();

  const [bills, setBills] = useState<RecurringBill[]>([]);
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);

  const reload = useCallback(async () => {
    const account = await getActiveAccount();
    if (!account) return;
    const list = await loadRecurringBills(account);
    setBills(list);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const typeCategories = categories.filter(c => c.type === form.type);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setShowStartDatePicker(false);
    setFormVisible(true);
  };

  const openEdit = (bill: RecurringBill) => {
    setForm({
      editingId: bill.id,
      name: bill.name,
      amount: String(bill.amount),
      type: bill.type,
      categoryId: bill.categoryId,
      cycle: bill.cycle,
      mode: bill.mode,
      startDate: bill.startDate,
    });
    setShowStartDatePicker(false);
    setFormVisible(true);
  };

  const handleSave = async () => {
    const account = await getActiveAccount();
    if (!account) return;

    const name = form.name.trim();
    const amount = parseFloat(form.amount);
    if (!name) {
      Alert.alert('提示', '请输入名称（如：房租）');
      return;
    }
    if (!(amount > 0)) {
      Alert.alert('提示', '请输入有效金额');
      return;
    }
    if (!form.categoryId) {
      Alert.alert('提示', '请选择分类');
      return;
    }
    if (!parseDateStr(form.startDate)) {
      Alert.alert('提示', '起始日格式不正确');
      return;
    }

    const category = categories.find(c => c.id === form.categoryId);
    const editingBill = form.editingId
      ? bills.find(b => b.id === form.editingId)
      : null;

    const bill: RecurringBill = {
      id: form.editingId || generateRecurringId(),
      name,
      amount,
      categoryId: form.categoryId,
      categoryName: category?.name || '',
      categoryIcon: category?.icon,
      type: form.type,
      cycle: form.cycle,
      mode: form.mode,
      startDate: form.startDate,
      paused: editingBill?.paused ?? false,
      // 编辑起始日/周期时从新起始日重新计算；新建则首期为起始日当天
      nextDueDate:
        !editingBill ||
        editingBill.startDate !== form.startDate ||
        editingBill.cycle !== form.cycle
          ? form.startDate
          : editingBill.nextDueDate,
      createdAt: editingBill?.createdAt ?? Date.now(),
    };

    await upsertRecurringBill(account, bill);
    setFormVisible(false);
    reload();
  };

  const handleTogglePause = async (bill: RecurringBill) => {
    const account = await getActiveAccount();
    if (!account) return;
    await upsertRecurringBill(account, { ...bill, paused: !bill.paused });
    reload();
  };

  const handleDelete = (bill: RecurringBill) => {
    Alert.alert('删除周期账单', `确定删除「${bill.name}」吗？已生成的账单不受影响。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          const account = await getActiveAccount();
          if (!account) return;
          await deleteRecurringBill(account, bill.id);
          reload();
        },
      },
    ]);
  };

  const renderBillCard = (bill: RecurringBill) => (
    <TouchableOpacity
      key={bill.id}
      style={[styles.billCard, bill.paused && styles.billCardPaused]}
      onPress={() => openEdit(bill)}
      activeOpacity={0.8}
    >
      <View style={styles.billCardLeft}>
        <View style={styles.billIconWrap}>
          <CategoryIcon
            icon={bill.categoryIcon || 'icon-qianming'}
            size={20}
            color={theme.colors.text.inverse}
          />
        </View>
        <View style={styles.billInfo}>
          <View style={styles.billNameRow}>
            <Text style={styles.billName}>{bill.name}</Text>
            {bill.paused && <Text style={styles.pausedBadge}>已暂停</Text>}
            <Text style={styles.modeBadge}>{MODE_LABELS[bill.mode]}</Text>
          </View>
          <Text style={styles.billMeta}>
            {CYCLE_LABELS[bill.cycle]} · {bill.categoryName} · 下次 {bill.nextDueDate}
          </Text>
        </View>
      </View>
      <View style={styles.billCardRight}>
        <Text style={styles.billAmount}>
          {bill.type === '1' ? '-' : '+'}¥{bill.amount.toFixed(2)}
        </Text>
        <View style={styles.billActions}>
          <TouchableOpacity
            style={styles.billActionBtn}
            onPress={() => handleTogglePause(bill)}
          >
            <Icon
              name={bill.paused ? 'play-arrow' : 'pause'}
              size={18}
              color={theme.colors.text.secondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.billActionBtn}
            onPress={() => handleDelete(bill)}
          >
            <Icon name="delete-outline" size={18} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
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
        <Text style={styles.headerTitle}>周期账单</Text>
        <TouchableOpacity style={styles.backButton} onPress={openCreate}>
          <Icon name="add" size={26} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {bills.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              暂无周期账单{'\n'}添加房租、会员订阅、话费等，到期自动记账
            </Text>
          </View>
        ) : (
          bills.map(renderBillCard)
        )}
      </ScrollView>

      {/* 新建 / 编辑弹窗 */}
      <Modal
        animationType="slide"
        transparent
        visible={formVisible}
        onRequestClose={() => setFormVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalPanel}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setFormVisible(false)}>
                <Text style={styles.modalCancel}>取消</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {form.editingId ? '编辑周期账单' : '新建周期账单'}
              </Text>
              <TouchableOpacity onPress={handleSave}>
                <Text style={styles.modalSave}>保存</Text>
              </TouchableOpacity>
            </View>

            {showStartDatePicker ? (
              <View style={styles.datePickerWrap}>
                <DatePicker
                  date={parseDateStr(form.startDate) || new Date()}
                  onChange={d => setForm(prev => ({ ...prev, startDate: formatDateStr(d) }))}
                  onClose={() => setShowStartDatePicker(false)}
                  onSwitchToKeypad={() => setShowStartDatePicker(false)}
                />
              </View>
            ) : (
              <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>名称</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="如：房租、话费"
                    placeholderTextColor={theme.colors.text.placeholder}
                    value={form.name}
                    onChangeText={text => setForm(prev => ({ ...prev, name: text }))}
                    maxLength={20}
                  />
                </View>

                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>金额</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.text.placeholder}
                    keyboardType="decimal-pad"
                    value={form.amount}
                    onChangeText={text => setForm(prev => ({ ...prev, amount: text }))}
                  />
                </View>

                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>类型</Text>
                  <View style={styles.segmentRow}>
                    {(['1', '2'] as const).map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.segmentItem, form.type === t && styles.segmentItemActive]}
                        onPress={() =>
                          setForm(prev => ({ ...prev, type: t, categoryId: null }))
                        }
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            form.type === t && styles.segmentTextActive,
                          ]}
                        >
                          {t === '1' ? '支出' : '收入'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.formBlock}>
                  <Text style={styles.formLabel}>分类</Text>
                  <View style={styles.categoryGrid}>
                    {typeCategories.map(cat => (
                      <TouchableOpacity
                        key={cat.id}
                        style={styles.categoryItem}
                        onPress={() =>
                          setForm(prev => ({ ...prev, categoryId: cat.id }))
                        }
                      >
                        <View
                          style={[
                            styles.categoryIconWrap,
                            form.categoryId === cat.id && styles.categoryIconWrapActive,
                          ]}
                        >
                          <CategoryIcon
                            icon={cat.icon}
                            size={18}
                            color={theme.colors.text.inverse}
                          />
                        </View>
                        <Text
                          style={[
                            styles.categoryName,
                            form.categoryId === cat.id && styles.categoryNameActive,
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>周期</Text>
                  <View style={styles.segmentRow}>
                    {CYCLE_OPTIONS.map(cycle => (
                      <TouchableOpacity
                        key={cycle}
                        style={[styles.segmentItem, form.cycle === cycle && styles.segmentItemActive]}
                        onPress={() => setForm(prev => ({ ...prev, cycle }))}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            form.cycle === cycle && styles.segmentTextActive,
                          ]}
                        >
                          {CYCLE_LABELS[cycle]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>起始日</Text>
                  <TouchableOpacity
                    style={styles.dateValue}
                    onPress={() => setShowStartDatePicker(true)}
                  >
                    <Text style={styles.dateValueText}>{form.startDate}</Text>
                    <Icon name="chevron-right" size={20} color={theme.colors.text.placeholder} />
                  </TouchableOpacity>
                </View>

                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>生成方式</Text>
                  <View style={styles.segmentRow}>
                    {MODE_OPTIONS.map(mode => (
                      <TouchableOpacity
                        key={mode}
                        style={[styles.segmentItem, form.mode === mode && styles.segmentItemActive]}
                        onPress={() => setForm(prev => ({ ...prev, mode }))}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            form.mode === mode && styles.segmentTextActive,
                          ]}
                        >
                          {mode === 'silent' ? '静默生成' : '确认后生成'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.formHint}>
                    静默：到期自动记账；确认：到期时询问你是否记账
                  </Text>
                </View>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
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
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.text.placeholder,
    textAlign: 'center',
    lineHeight: 22,
  },
  billCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background.paper,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  billCardPaused: {
    opacity: 0.6,
  },
  billCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  billIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  billInfo: {
    flex: 1,
  },
  billNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  billName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginRight: 6,
  },
  pausedBadge: {
    fontSize: 10,
    color: theme.colors.text.inverse,
    backgroundColor: theme.colors.text.placeholder,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
    marginRight: 4,
  },
  modeBadge: {
    fontSize: 10,
    color: theme.colors.primary,
    backgroundColor: theme.colors.background.primaryLight,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  billMeta: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  billCardRight: {
    alignItems: 'flex-end',
  },
  billAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 6,
  },
  billActions: {
    flexDirection: 'row',
  },
  billActionBtn: {
    padding: 4,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalPanel: {
    backgroundColor: theme.colors.background.paper,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalCancel: {
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  formScroll: {
    paddingHorizontal: 16,
  },
  formRow: {
    marginTop: 16,
  },
  formBlock: {
    marginTop: 16,
  },
  formLabel: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginBottom: 8,
  },
  formInput: {
    height: 44,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.background.neutral,
  },
  formHint: {
    fontSize: 12,
    color: theme.colors.text.placeholder,
    marginTop: 8,
  },
  segmentRow: {
    flexDirection: 'row',
  },
  segmentItem: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.background.neutral,
    marginRight: 8,
  },
  segmentItemActive: {
    backgroundColor: theme.colors.primary,
  },
  segmentText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  segmentTextActive: {
    color: theme.colors.text.inverse,
    fontWeight: '600',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoryItem: {
    alignItems: 'center',
    width: '16.666666%',
    marginBottom: 12,
  },
  categoryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.background.default,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryIconWrapActive: {
    backgroundColor: theme.colors.background.primaryLight,
  },
  categoryName: {
    fontSize: 11,
    color: theme.colors.text.secondary,
  },
  categoryNameActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  dateValue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.background.neutral,
  },
  dateValueText: {
    fontSize: 15,
    color: theme.colors.text.primary,
  },
  datePickerWrap: {
    height: 360,
  },
});

export default RecurringBills;
