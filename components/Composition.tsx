import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { StatisticsData } from '../types/bill';
import CategoryIcon from './CategoryIcon';
import { useCategory } from '../context/CategoryContext';

interface CompositionProps {
  data: StatisticsData[];
}

const Composition: React.FC<CompositionProps> = ({ data }) => {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const { getCategoryIcon } = useCategory();

  // 1 for expense, 2 for income
  const targetType = type === 'expense' ? '1' : '2';
  
  const filteredData = data.filter(item => String(item.pay_type) === targetType);
  
  // Calculate total for the current list to show percentage relative to this list
  const totalAmount = filteredData.reduce((sum, item) => sum + Number(item.number), 0);

  // Sort by amount descending
  const sortedData = [...filteredData].sort((a, b) => Number(b.number) - Number(a.number));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>收支构成</Text>
        <View style={styles.tabs}>
          <TouchableOpacity 
            style={[styles.tab, type === 'expense' && styles.activeTab]}
            onPress={() => setType('expense')}
          >
            <Text style={[styles.tabText, type === 'expense' && styles.activeTabText]}>支出</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, type === 'income' && styles.activeTab]}
            onPress={() => setType('income')}
          >
            <Text style={[styles.tabText, type === 'income' && styles.activeTabText]}>收入</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.list}>
        {sortedData.map((item) => {
          const amount = Number(item.number);
          const percentage = totalAmount > 0 ? (amount / totalAmount * 100) : 0;
          const icon = getCategoryIcon(item.type_name);

          // Bar width calculation: simple scaling
          // Scale factor 1.5 ensures 100% -> 150dp, which fits most screens
          const barWidth = Math.max(percentage * 1.5, 4);

          return (
            <View key={`${item.pay_type}-${item.type_id}`} style={styles.item}>
              <View style={styles.iconWrapper}>
                 <CategoryIcon icon={icon} size={20} />
              </View>
              
              <Text style={styles.categoryName}>{item.type_name}</Text>
              <Text style={styles.amountText}>¥ {amount.toFixed(2)}</Text>
              
              <View style={[styles.bar, { width: barWidth }]} />
              
              <View style={styles.spacer} />
              
              <Text style={styles.percentageText}>{percentage.toFixed(2)}%</Text>
            </View>
          );
        })}
        
        {sortedData.length === 0 && (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>暂无数据</Text>
            </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    padding: 2,
  },
  tab: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  activeTab: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  tabText: {
    fontSize: 12,
    color: '#666',
  },
  activeTabText: {
    color: '#0090FF',
    fontWeight: '500',
  },
  list: {
    gap: 20,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F6FF', // Prototype has blue background for icons? 
    // Wait, prototype icons are blue on white/light-blue bg? 
    // Actually the prototype icons are white on blue circle.
    // But `CategoryIcon` might handle color?
    // Let's assume CategoryIcon handles it or we wrap it.
    // Existing code uses `CategoryIcon` which returns IconFont or Text.
    // I'll stick to a simple wrapper.
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryName: {
    width: 60,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    marginRight: 8
  },
  amountText: {
    width: 80,
    fontSize: 14,
    color: '#333',
    marginRight: 12,
  },
  bar: {
    height: 6,
    backgroundColor: '#0090FF',
    borderRadius: 3,
  },
  spacer: {
    flex: 1,
  },
  percentageText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  emptyContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  }
});

export default Composition;
