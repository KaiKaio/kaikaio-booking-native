import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute, RouteProp } from '@react-navigation/native';
import MonthYearPicker from '../components/MonthYearPicker';
import BillForm, { BillData, BillFormRef } from '../components/BillForm';
import BillItem from '../components/BillItem';
import { useBillStore, transformBillData } from '../stores/billStore';
import { useCategory } from '../context/CategoryContext';
import { theme } from '@/theme';
import { MainTabParamList } from '../types/navigation';

const List = () => {
  const insets = useSafeAreaInsets();
  const { getCategoryIcon } = useCategory();
  const route = useRoute<RouteProp<MainTabParamList, 'List'>>();

  // 本地 UI 状态（不需要持久化的）
  const [showPicker, setShowPicker] = useState(false);
  const billFormRef = useRef<BillFormRef>(null);

  // 使用 Zustand store
  const {
    rawData,
    currentDate,
    orderBy,
    summary,
    isLoading,
    isRefreshing,
    error,
    editingId,
    isSubmitting,

    // Actions
    setCurrentDate,
    toggleOrderBy,
    fetchBills,
    refreshBills,
    startEdit,
    cancelEdit,
    submitBill,
    clearError,
  } = useBillStore();

  // ===== 数据转换（使用 useMemo 优化性能） =====

  const data = useMemo(() => {
    return transformBillData(rawData, getCategoryIcon);
  }, [rawData, getCategoryIcon]);

  // ===== 初始化时加载数据 =====

  useEffect(() => {
    const init = async () => {
      try {
        const savedDate = await AsyncStorage.getItem('lastSelectedDate');
        if (savedDate) {
          await setCurrentDate(savedDate);
        } else {
          fetchBills();
        }
      } catch (e) {
        console.error('Failed to load date', e);
        fetchBills();
      }
    };
    init();
  }, []);

  // ===== 处理自动记账参数 =====

  useEffect(() => {
    if (route.params?.autoBill) {
      const { autoBill } = route.params;
      setTimeout(() => {
        billFormRef.current?.open({
          amount: autoBill.amount,
          category: '1',
          categoryName: '餐饮',
          date: new Date().toISOString().split('T')[0],
          remark: `[自动识别] ${autoBill.merchant || ''} - ${autoBill.rawText.substring(0, 10)}...`,
          type: autoBill.type === 'expense' ? 1 : 2,
        });
      }, 500);
    }
  }, [route.params]);

  // ===== 事件处理 =====

  const handleDateConfirm = async (year: number, month: number) => {
    const formattedMonth = month.toString().padStart(2, '0');
    const newDate = `${year}-${formattedMonth}`;
    setShowPicker(false);
    await setCurrentDate(newDate);
  };

  const handleAdd = () => {
    cancelEdit();
    billFormRef.current?.open();
  };

  const handleEdit = (id: number) => {
    const item = startEdit(id);
    if (item) {
      // Handle date parsing (supports timestamp string or date string)
      let dateObj: Date;
      const dateVal = String(item.date);
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
        amount: item.rawAmount,
        category: item.typeId,
        categoryName: item.type,
        date: dateStr,
        remark: item.remark,
        type: item.payType,
      });
    }
  };

  const handleBillSubmit = async (billData: BillData) => {
    try {
      await submitBill(billData);
    } catch (error: any) {
      Alert.alert('错误', error.message || (editingId ? '修改失败' : '记账失败'));
    }
  };

  const renderBillItem = ({ item }: { item: any }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionDate}>{item.date}</Text>
        <Text style={styles.sectionStat}>
          支出: ￥{item.total.toFixed(2)} 收入: ￥{item.income.toFixed(2)}
        </Text>
      </View>
      {item.items.map((subItem: any, index: number) => (
        <BillItem
          key={subItem.id}
          {...subItem}
          onDeleteSuccess={refreshBills}
          onEdit={handleEdit}
          isLast={index === item.items.length - 1}
        />
      ))}
    </View>
  );

  // ===== 显示错误提示 =====

  useEffect(() => {
    if (error) {
      Alert.alert('错误', error);
      clearError();
    }
  }, [error]);

  return (
    <View style={styles.root}>
      {/* 顶部统计栏 */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerLabel}>总支出：</Text>
          <Text style={styles.headerValue}>{summary.totalExpense.toFixed(2)}</Text>
          <Text style={styles.headerLabel}>总收入：</Text>
          <Text style={styles.headerValue}>{summary.totalIncome.toFixed(2)}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={toggleOrderBy}>
            <Text style={styles.headerBtnText}>{orderBy === 'ASC' ? '倒序' : '正序'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>全部类型</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowPicker(true)}>
            <Text style={styles.headerBtnText}>{currentDate}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 账单列表 */}
      <FlatList
        style={styles.scroll}
        contentContainerStyle={[styles.flatListContent, { paddingBottom: 80 + insets.bottom }]}
        data={data}
        renderItem={renderBillItem}
        keyExtractor={(item) => item.date}
        showsVerticalScrollIndicator={false}
        onRefresh={refreshBills}
        refreshing={isRefreshing}
        ListFooterComponent={
          isLoading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#0090FF" />
            </View>
          ) : null
        }
      />

      {/* 底部菜单栏 */}
      <MonthYearPicker
        visible={showPicker}
        currentDate={currentDate}
        onClose={() => setShowPicker(false)}
        onConfirm={handleDateConfirm}
      />

      <View style={[styles.fabContainer, { bottom: 80 + insets.bottom }]}>
        <TouchableOpacity style={styles.fab} onPress={handleAdd}>
          <Text style={styles.fabIcon}>✏️</Text>
        </TouchableOpacity>
        <BillForm ref={billFormRef} onSubmit={handleBillSubmit} />
      </View>

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
  root: { flex: 1, backgroundColor: theme.colors.background.neutral },
  fabContainer: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    zIndex: 100,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  fabIcon: {
    fontSize: 24,
    color: theme.colors.text.inverse,
  },
  header: {
    backgroundColor: theme.colors.primary,
    paddingBottom: 14,
    paddingHorizontal: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 8,
  },
  headerLabel: { color: theme.colors.text.inverse, fontSize: theme.typography.size.md },
  headerValue: {
    color: theme.colors.text.inverse,
    fontSize: theme.typography.size.xl,
    fontWeight: 'bold',
    marginRight: 24,
  },
  headerActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  headerBtn: {
    backgroundColor: theme.colors.primaryDark,
    borderRadius: 8,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    marginLeft: 8,
  },
  headerBtnText: { color: theme.colors.text.inverse, fontSize: theme.typography.size.md },
  flatListContent: { paddingBottom: 80 },
  scroll: { flex: 1, marginTop: 0 },
  section: {
    backgroundColor: theme.colors.background.paper,
    borderRadius: 12,
    marginHorizontal: theme.spacing.md,
    marginTop: 16,
    paddingBottom: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionDate: { fontWeight: 'bold', fontSize: 16, color: theme.colors.text.primary },
  sectionStat: { fontSize: 12, color: theme.colors.text.secondary },
  loaderContainer: { paddingVertical: 20 },
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

export default List;
