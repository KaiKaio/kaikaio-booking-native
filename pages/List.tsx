import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

const bills = [
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
  return (
    <View style={styles.root}>
      {/* 顶部统计栏 */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerLabel}>总支出：</Text>
          <Text style={styles.headerValue}>￥6542.44</Text>
          <Text style={styles.headerLabel}>总收入：</Text>
          <Text style={styles.headerValue}>￥1.00</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn}><Text style={styles.headerBtnText}>倒序</Text></TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}><Text style={styles.headerBtnText}>全部类型</Text></TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}><Text style={styles.headerBtnText}>2024-07</Text></TouchableOpacity>
        </View>
      </View>
      {/* 账单列表 */}
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {bills.map((bill) => (
          <View key={bill.date} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionDate}>{bill.date}</Text>
              <Text style={styles.sectionStat}>支出: ￥{bill.total.toFixed(2)} 收入: ￥{bill.income.toFixed(2)}</Text>
            </View>
            {bill.items.map((item) => (
              <View key={item.id} style={styles.item}>
                <View style={styles.itemIconWrap}><Text style={styles.itemIcon}>{item.icon}</Text></View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemType}>{item.type}</Text>
                  {item.remark ? <Text style={styles.itemRemark}>{item.remark}</Text> : null}
                </View>
                <Text style={styles.itemAmount}>{item.amount}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
      {/* 底部菜单栏 */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem}>
          <Text style={styles.tabIcon}>📋</Text>
          <Text style={styles.tabLabel}>账单</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Text style={styles.tabIcon}>📊</Text>
          <Text style={styles.tabLabel}>统计</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Text style={styles.tabIcon}>👤</Text>
          <Text style={styles.tabLabel}>我的</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F6F8FA' },
  header: { backgroundColor: '#0090FF', paddingTop: 24, paddingBottom: 16, paddingHorizontal: 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  headerLabel: { color: '#fff', fontSize: 14, marginHorizontal: 4 },
  headerValue: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginHorizontal: 8 },
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
  tabBar: { flexDirection: 'row', height: 60, borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'space-around' },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 12, color: '#222', marginTop: 2 },
});

export default List; 