import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import TabBar from './TabBar';

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

const bills: BillItem[] = [
  {
    date: '2024-07-31',
    total: 67.94,
    income: 0,
    items: [
      { id: 1, type: '用餐', icon: '🍽️', remark: '晚饭', amount: -16.66 },
      { id: 2, type: '买烟', icon: '🚬', remark: '', amount: -14 },
      { id: 3, type: '娱乐', icon: '🎳', remark: '打保龄球', amount: -27.28 },
      { id: 4, type: '用餐', icon: '🍽️', remark: '早餐', amount: -10 },
    ],
  },
  {
    date: '2024-07-30',
    total: 134,
    income: 0,
    items: [
      { id: 5, type: '用餐', icon: '🍽️', remark: '晚饭', amount: -17 },
      { id: 6, type: '用餐', icon: '🍽️', remark: '打车买鸡腿堡贴子', amount: -9 },
      { id: 7, type: '用餐', icon: '🍽️', remark: '', amount: -50 },
      { id: 8, type: '买烟', icon: '🚬', remark: '', amount: -13 },
      { id: 9, type: '娱乐', icon: '🎳', remark: '小央美由喜', amount: -45 },
    ],
  },
  {
    date: '2024-07-29',
    total: 402.89,
    income: 0,
    items: [
      { id: 10, type: '家居', icon: '🛋️', remark: '京东蓝控', amount: -332.11 },
    ],
  },
];

const List = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [data] = useState(bills);

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
          <Text style={styles.itemAmount}>{subItem.amount}</Text>
        </View>
      ))}
    </View>
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // 模拟网络请求
      await new Promise(resolve => setTimeout(resolve, 2000));
      // 这里可添加实际的加载新数据逻辑
      // 例如：从 API 获取新数据
      // const newData = await fetchNewBills();
      // setData([...newData, ...data]);
    } catch (error) {
      console.error('刷新失败:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* 顶部统计栏 */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerLabel}>总支出：</Text>
          <Text style={styles.headerValue}>6542.44</Text>
          <Text style={styles.headerLabel}>总收入：</Text>
          <Text style={styles.headerValue}>1.00</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn}><Text style={styles.headerBtnText}>倒序</Text></TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}><Text style={styles.headerBtnText}>全部类型</Text></TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}><Text style={styles.headerBtnText}>2024-07</Text></TouchableOpacity>
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
  headerBtn: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 4, marginLeft: 8 },
  headerBtnText: { color: '#0090FF', fontSize: 14 },
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