import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import TabBar from './TabBar';
import MonthYearPicker from '../components/MonthYearPicker';
import { getBillList } from '../services/bill';
import { BillDetail, DailyBill } from '../types/bill';

// 定义 SubItem 类型
type SubItem = {
  id: number;
  type: string;
  icon: string;
  remark: string;
  amount: number;
};

// 定义 BillItem 类型
type BillItem = {
  date: string;
  total: number;
  income: number;
  items: SubItem[];
};

const iconMap: { [key: string]: string } = {
  '用餐': '🍽️',
  '买烟': '🚬',
  '娱乐': '🎳',
  '交通': '🚗',
  '日用品': '🧴',
  '家居': '🛋️',
  '医疗': '💊',
  '学习': '📚',
  '其他': '❓',
};

const getIcon = (typeName: string) => {
  return iconMap[typeName] || '💰';
};

const List = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<BillItem[]>([]);
  const [currentDate, setCurrentDate] = useState('2025-11'); // Default to current month or based on today
  const [showPicker, setShowPicker] = useState(false);
  const loadingRef = useRef(false);
  const [summary, setSummary] = useState({ totalExpense: 0, totalIncome: 0 });

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

        const transformedData: BillItem[] = res.data.list.map((daily: DailyBill) => {
          let dailyTotal = 0;
          let dailyIncome = 0;
          
          const items: SubItem[] = daily.bills.map((bill: BillDetail) => {
            const amount = parseFloat(bill.amount);
            // Assuming pay_type "1" is expense (negative in UI?), "2" is income
            // The mock data had negative amounts for expenses. 
            // The API returns positive numbers.
            // Let's check the API example. 
            // "pay_type": "1", "amount": "6.19", "type_name": "娱乐" -> This is likely expense.
            // "pay_type": "2" -> Income?
            
            // Current UI expects negative numbers for expenses to display properly?
            // Wait, looking at renderBillItem: 
            // <Text style={styles.itemAmount}>{subItem.amount}</Text>
            // It just displays the number. Mock data has -16.66.
            // If I pass positive numbers, it will display positive.
            // I should probably follow the mock data convention or update UI logic.
            // Let's assume pay_type 1 is expense, 2 is income.
            
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
              icon: getIcon(bill.type_name),
              remark: bill.remark,
              amount: displayAmount
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
  }, [currentDate]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const handleDateConfirm = (year: number, month: number) => {
    const formattedMonth = month.toString().padStart(2, '0');
    setCurrentDate(`${year}-${formattedMonth}`);
    setShowPicker(false);
  };

  const renderBillItem = ({ item }: { item: BillItem }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionDate}>{item.date}</Text>
        <Text style={styles.sectionStat}>支出: ￥{item.total.toFixed(2)} 收入: ￥{item.income.toFixed(2)}</Text>
      </View>
      {item.items.map((subItem: SubItem) => (
        <View key={subItem.id} style={styles.item}>
          <View style={styles.itemIconWrap}><Text style={styles.itemIcon}>{subItem.icon}</Text></View>
          <View style={styles.itemInfo}>
            <Text style={styles.itemType}>{subItem.type}</Text>
            {subItem.remark ? <Text style={styles.itemRemark}>{subItem.remark}</Text> : null}
          </View>
          <Text style={styles.itemAmount}>{subItem.amount.toFixed(2)}</Text>
        </View>
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
      <View style={styles.header}>
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
      {/* 底部菜单栏 */}
      <TabBar />

      <MonthYearPicker
        visible={showPicker}
        currentDate={currentDate}
        onClose={() => setShowPicker(false)}
        onConfirm={handleDateConfirm}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F6F8FA' },
  header: {
    backgroundColor: '#0090FF',
    paddingTop: 24,
    paddingBottom: 16,
    paddingHorizontal: 16,
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
  scroll: { flex: 1, marginTop: 8 },
  section: { backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 12, marginTop: 16, paddingBottom: 8, elevation: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  sectionDate: { fontWeight: 'bold', fontSize: 16, color: '#222' },
  sectionStat: { fontSize: 12, color: '#888' },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F6F8FA' },
  itemIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0F6FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  itemIcon: { fontSize: 22 },
  itemInfo: { flex: 1 },
  itemType: { fontSize: 16, color: '#222', fontWeight: 'bold' },
  itemRemark: { fontSize: 12, color: '#888', marginTop: 2 },
  itemAmount: { fontSize: 16, color: '#1BC47D', fontWeight: 'bold', minWidth: 60, textAlign: 'right' },
  loaderContainer: {
    paddingVertical: 20
  }
});

export default List;