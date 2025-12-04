import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MonthYearPicker from '../components/MonthYearPicker';
import BillForm, { BillData, BillFormRef } from '../components/BillForm';
import BillItem from '../components/BillItem';
import { getBillList, addBill, updateBill } from '../services/bill';
import { BillDetail, DailyBill } from '../types/bill';
import { useCategory } from '../context/CategoryContext';

// 定义 SubItem 类型
type SubItem = {
  id: number;
  type: string;
  icon: string;
  remark: string;
  amount: number;
  // Extended fields for editing
  typeId: string;
  date: string;
  payType: number;
  rawAmount: number;
};

// 定义 BillItem 类型
type DailyBillGroup = {
  date: string;
  total: number;
  income: number;
  items: SubItem[];
};

const List = () => {
  const insets = useSafeAreaInsets();
  const { getCategoryIcon } = useCategory();
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DailyBillGroup[]>([]);
  const [currentDate, setCurrentDate] = useState('2025-11'); // Default to current month or based on today
  const [showPicker, setShowPicker] = useState(false);
  const loadingRef = useRef(false);
  const [summary, setSummary] = useState({ totalExpense: 0, totalIncome: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const billFormRef = useRef<BillFormRef>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const fetchBills = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const [year, month] = currentDate.split('-');
      const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
      
      const start = `${currentDate}-01 00:00:00`;
      const end = `${currentDate}-${lastDay} 23:59:59`;

      const res = await getBillList({ start, end, page: 1, page_size: 1000, orderBy: 'DESC' });
      
      if (res.code === 200) {
        setSummary({
          totalExpense: res.data.totalExpense,
          totalIncome: res.data.totalIncome,
        });

        const transformedData: DailyBillGroup[] = res.data.list.map((daily: DailyBill) => {
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
              payType: parseInt(bill.pay_type, 10),
              date: bill.date,
              rawAmount: amount
            };
          });

          return {
            date: daily.date,
            total: dailyTotal,
            income: dailyIncome,
            items: items
          };
        });
        
        setData(transformedData);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      loadingRef.current = false;
      setRefreshing(false);
    }
  }, [currentDate, getCategoryIcon]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const handleDateConfirm = (year: number, month: number) => {
    const formattedMonth = month.toString().padStart(2, '0');
    setCurrentDate(`${year}-${formattedMonth}`);
    setShowPicker(false);
  };

  const handleAdd = () => {
    setEditingId(null);
    billFormRef.current?.open();
  };

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
      // Handle date parsing (supports timestamp string or date string)
      let dateObj: Date;
      const dateVal = String(targetItem.date);
      // If it's a timestamp (all digits)
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

  const handleBillSubmit = async (billData: BillData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const timestamp = new Date(billData.date).getTime();
      const params = {
        amount: billData.amount.toFixed(2),
        type_id: parseInt(billData.category, 10),
        type_name: billData.categoryName,
        date: timestamp,
        pay_type: billData.type,
        remark: billData.remark || ''
      };

      if (editingId) {
        await updateBill({ ...params, id: editingId });
        Alert.alert('提示', '修改成功');
      } else {
        await addBill(params);
        Alert.alert('提示', '记账成功');
      }
      
      fetchBills(); // Refresh list
    } catch (error: any) {
      Alert.alert('错误', error.message || (editingId ? '修改失败' : '记账失败'));
    } finally {
      setIsSubmitting(false);
      setEditingId(null);
    }
  };

  const renderBillItem = ({ item }: { item: DailyBillGroup }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionDate}>{item.date}</Text>
        <Text style={styles.sectionStat}>支出: ￥{item.total.toFixed(2)} 收入: ￥{item.income.toFixed(2)}</Text>
      </View>
      {item.items.map((subItem: SubItem, index: number) => (
        <BillItem
          key={subItem.id}
          {...subItem}
          onDeleteSuccess={onRefresh}
          onEdit={handleEdit}
          isLast={index === item.items.length - 1}
        />
      ))}
    </View>
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBills();
  };

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
          <TouchableOpacity style={styles.headerBtn}><Text style={styles.headerBtnText}>倒序</Text></TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}><Text style={styles.headerBtnText}>全部类型</Text></TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowPicker(true)}>
            <Text style={styles.headerBtnText}>{currentDate}</Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* 账单列表 */}
      <FlatList
        style={styles.scroll}
        contentContainerStyle={styles.flatListContent}
        data={data}
        renderItem={renderBillItem}
        keyExtractor={(item) => item.date}
        showsVerticalScrollIndicator={false}
        onRefresh={onRefresh}
        refreshing={refreshing}
        // 使用三元运算符，refreshing 为 true 时显示加载指示器，否则返回 null
        ListFooterComponent={refreshing ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#0090FF" />
          </View>
        ) : null}
      />
      {/* 底部菜单栏 - 已移动到 Main 组件 */}
      
      <MonthYearPicker
        visible={showPicker}
        currentDate={currentDate}
        onClose={() => setShowPicker(false)}
        onConfirm={handleDateConfirm}
      />

      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fab} onPress={handleAdd}>
          <Text style={styles.fabIcon}>✏️</Text>
        </TouchableOpacity>
        <BillForm ref={billFormRef} onSubmit={handleBillSubmit} />
      </View>

      {isSubmitting && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#0090FF" />
            <Text style={styles.loadingText}>正在提交...</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F6F8FA' },
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
    backgroundColor: '#0090FF',
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
    color: '#fff',
  },
  header: {
    backgroundColor: '#0090FF',
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    marginBottom: 8
  },
  headerLabel: { color: '#fff', fontSize: 14, marginLeft: 12, lineHeight: 32 },
  headerValue: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  headerBtn: { backgroundColor: '#0072e5', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 4, marginLeft: 8 },
  headerBtnText: { color: '#fff', fontSize: 14, lineHeight: 16 },
  flatListContent: { paddingBottom: 80 },
  scroll: { flex: 1, marginTop: 8 },
  section: { backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 12, marginTop: 16, paddingBottom: 8, elevation: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  sectionDate: { fontWeight: 'bold', fontSize: 16, color: '#222' },
  sectionStat: { fontSize: 12, color: '#888' },
  loaderContainer: {
    paddingVertical: 20
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
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 5,
  },
  loadingText: {
    marginTop: 10,
    color: '#333',
    fontSize: 14,
  }
});

export default List;