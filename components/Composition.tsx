import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { StatisticsData } from '../types/bill';
import CategoryIcon from './CategoryIcon';
import { useCategory } from '../context/CategoryContext';
import { theme } from '../theme';

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
                 <CategoryIcon icon={icon} size={22} />
              </View>
              
              <View style={styles.info}>
                <Text style={styles.categoryName}>{item.type_name}</Text>
                <Text style={styles.amountText}>{amount.toFixed(2)}</Text>
              </View>
              
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
    backgroundColor: theme.colors.background.paper,
    borderRadius: theme.spacing.radius.md,
    padding: theme.spacing.lg,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg, // 16 (was 20)
  },
  title: {
    fontSize: theme.typography.size.lg,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.text.primary,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background.default,
    borderRadius: theme.spacing.radius.md,
    padding: 2,
  },
  tab: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: 4, // inner radius can be smaller
  },
  activeTab: {
    backgroundColor: theme.colors.background.paper,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  tabText: {
    fontSize: theme.typography.size.sm,
    color: theme.colors.text.secondary,
  },
  activeTabText: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weight.medium,
  },
  list: {
    gap: theme.spacing.lg,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background.primaryLight, // Keep specific color
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
  },
  categoryName: {
    width: 60,
    fontSize: theme.typography.size.md,
    fontWeight: theme.typography.weight.bold,
  },
  amountText: {
    marginTop: theme.spacing.xs,
    width: 80,
    fontSize: theme.typography.size.md,
    color: theme.colors.text.primary,
  },
  bar: {
    height: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  spacer: {
    flex: 1,
  },
  percentageText: {
    fontSize: theme.typography.size.md,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.weight.medium,
  },
  emptyContainer: {
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.text.placeholder,
    fontSize: theme.typography.size.md,
  }
});

export default Composition;