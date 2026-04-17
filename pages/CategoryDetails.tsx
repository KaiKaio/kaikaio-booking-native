import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import CategoryIcon from '@/components/CategoryIcon.tsx';
import { RootStackParamList } from '@/types/navigation';
import { useCategory } from '../context/CategoryContext';
import MonthSelector from '@/components/MonthSelector';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/theme';
import { getBillList, deleteBill, updateBill } from '../services/bill';
import { DailyBill, BillDetail } from '../types/bill';
import BillGroupItem, { DailyBillGroup, SubItem } from '@/components/BillGroupItem';
import BillForm, { BillData, BillFormRef } from '@/components/BillForm';

type CategoryDetailsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CategoryDetails'>;
type CategoryDetailsRouteProp = RouteProp<RootStackParamList, 'CategoryDetails'>;

interface CategoryDetailsProps {
  navigation: CategoryDetailsNavigationProp;
  route: CategoryDetailsRouteProp;
}

const CategoryDetails: React.FC<CategoryDetailsProps> = ({ navigation, route }) => {
  const { type_id, type_name } = route.params;
  const insets = useSafeAreaInsets();
  const { getCategoryItem, getCategoryIcon, categories } = useCategory();

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [data, setData] = useState<DailyBillGroup[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState({ totalExpense: 0, totalIncome: 0 });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const billFormRef = useRef<BillFormRef>(null);

  const getCategoryItemMemo = React.useMemo(() => {
    return getCategoryItem(type_id);
  }, [type_id, getCategoryItem]);

  const handleGoBack = () => {
    navigation.goBack();
  };

  // 转换数据格式
  const transformDailyBills = useCallback((list: DailyBill[]): DailyBillGroup[] => {
    return list.map((daily: DailyBill) => {
      let dailyTotal = 0;
      let dailyIncome = 0;

      const items: SubItem[] = daily.bills.map((bill: BillDetail) => {
        const amount = parseFloat(bill.amount);
        const isExpense = bill.pay_type === '1';
        const displayAmount = isExpense ? -amount : amount;

        if (isExpense) {
          dailyTotal += amount;
        } else {
          dailyIncome += amount;
        }

        return {
          id: bill.id,
          type: bill.type_name,
          icon: getCategoryIcon(bill.type_name),
          remark: bill.remark,
          amount: displayAmount,
          typeId: bill.type_id,
          payType: bill.pay_type,
          date: bill.date,
          rawAmount: amount,
        };
      });

      return {
        date: daily.date,
        total: dailyTotal,
        income: dailyIncome,
        items,
      };
    });
  }, [getCategoryIcon]);

  // 获取账单数据
  const fetchBills = useCallback(async () => {
    if (!currentMonth) return;

    setRefreshing(true);

    try {
      const [year, month] = currentMonth.split('-');
      const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();

      const start = `${currentMonth}-01 00:00:00`;
      const end = `${currentMonth}-${lastDay} 23:59:59`;

      const res = await getBillList({
        start,
        end,
        page: 1,
        page_size: 1000,
        orderBy: 'DESC',
        type_id,
      });

      if (res.code === 200) {
        const transformedData = transformDailyBills(res.data.list);
        setData(transformedData);
        setSummary({
          totalExpense: res.data.totalExpense,
          totalIncome: res.data.totalIncome,
        });
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [currentMonth, type_id, transformDailyBills]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const onRefresh = async () => {
    await fetchBills();
  };

  // 编辑账单
  const handleEdit = (id: number) => {
    let targetItem: SubItem | undefined;
    for (const group of data) {
      const item = group.items.find(i => i.id === id);
      if (item) {
        targetItem = item;
        break;
      }
    }

    if (targetItem) {
      setEditingId(id);
      // 解析日期
      let dateObj: Date;
      const dateVal = String(targetItem.date);
      if (/^\d+$/.test(dateVal)) {
        dateObj = new Date(parseInt(dateVal, 10));
      } else {
        dateObj = new Date(dateVal);
      }

      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      billFormRef.current?.open({
        amount: targetItem.rawAmount,
        category: targetItem.typeId,
        categoryName: targetItem.type,
        date: dateStr,
        remark: targetItem.remark,
        type: targetItem.payType
      });
    }
  };

  // 提交编辑
  const handleBillSubmit = async (billData: BillData) => {
    if (isSubmitting || !editingId) return;

    const timestamp = new Date(billData.date).getTime();
    const params = {
      id: editingId,
      amount: billData.amount.toFixed(2),
      type_id: billData.category,
      type_name: billData.categoryName,
      date: timestamp,
      pay_type: billData.type,
      remark: billData.remark || ''
    };

    setIsSubmitting(true);
    try {
      const res = await updateBill(params);
      if (res.code !== 200) {
        throw new Error(res.msg || '修改失败');
      }
      Alert.alert('成功', '账单修改成功');
      setEditingId(null);
      await onRefresh();
    } catch (error: any) {
      Alert.alert('错误', error.message || '修改失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 删除账单
  const handleDelete = async ({ id }: { id: number; localId?: string }) => {
    Alert.alert(
      '确认删除',
      '确定要删除这条账单吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deleteBill(id);
              if (res.code === 200) {
                Alert.alert('成功', '账单已删除');
                await onRefresh();
              } else {
                throw new Error(res.msg || '删除失败');
              }
            } catch (error: any) {
              Alert.alert('错误', error.message || '删除失败');
            }
          }
        }
      ]
    );
  };

  // 重试同步（CategoryDetails 不支持离线账单，提供空实现）
  const handleRetry = async (localId: string) => {
    Alert.alert('提示', '此页面不支持重试同步操作');
  };

  // 渲染账单项
  const renderBillItem = ({ item }: { item: DailyBillGroup }) => (
    <BillGroupItem
      item={item}
      highlightedLocalId={null}
      onDeleteSuccess={onRefresh}
      onDelete={handleDelete}
      onEdit={handleEdit}
      onRetry={handleRetry}
    />
  );

  return (
    <View style={styles.container}>
      {/* Safe Area Background */}
      <View style={{ height: insets.top, backgroundColor: theme.colors.background.paper }} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <MaterialIcons name="arrow-back-ios" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>明细</Text>
        <View style={styles.placeholder} />
      </View>

      {/* 主内容 */}
      <View style={styles.content}>
        <View style={styles.infoCard}>
          <View style={[styles.iconWrapper, getCategoryItemMemo?.background_color && { backgroundColor: getCategoryItemMemo.background_color }]}>
            <CategoryIcon icon={getCategoryItemMemo?.icon || 'question'} size={22} />
          </View>
          <Text style={styles.value}>{type_name}</Text>
        </View>

        <MonthSelector
          type_id={type_id}
          currentMonth={currentMonth}
          onCurrentMonthChange={setCurrentMonth}
        />

        {/* 统计信息 */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>总支出：</Text>
            <Text style={styles.summaryValue}>¥{summary.totalExpense.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>总收入：</Text>
            <Text style={styles.summaryValue}>¥{summary.totalIncome.toFixed(2)}</Text>
          </View>
        </View>

        {/* 账单列表 */}
        <FlatList
          style={styles.list}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom }]}
          data={data}
          renderItem={renderBillItem}
          keyExtractor={(item) => item.date}
          showsVerticalScrollIndicator={false}
          onRefresh={onRefresh}
          refreshing={refreshing}
          ListEmptyComponent={!refreshing ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>暂无账单数据</Text>
            </View>
          ) : null}
          ListFooterComponent={refreshing ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : null}
        />
      </View>

      {/* 编辑表单 */}
      <BillForm ref={billFormRef} onSubmit={handleBillSubmit} />

      {/* 提交中遮罩 */}
      {isSubmitting && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>正在提交...</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
    borderBottomColor: theme.colors.border
  },
  backButton: {
    padding: theme.spacing.sm,
  },
  headerTitle: {
    fontSize: theme.typography.size.lg,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.text.primary,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: theme.spacing.md,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.paper,
    borderRadius: theme.spacing.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  value: {
    fontSize: theme.typography.size.md,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.weight.bold,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  summaryCard: {
    backgroundColor: theme.colors.background.paper,
    borderRadius: theme.spacing.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  summaryLabel: {
    fontSize: theme.typography.size.md,
    color: theme.colors.text.secondary,
  },
  summaryValue: {
    fontSize: theme.typography.size.lg,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.weight.bold,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    color: theme.colors.text.secondary,
    fontSize: 14,
  },
  loaderContainer: {
    paddingVertical: 20,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingBox: {
    backgroundColor: theme.colors.background.paper,
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 5,
  },
  loadingText: {
    marginTop: 10,
    color: theme.colors.text.primary,
    fontSize: 14,
  },
});

export default CategoryDetails;
