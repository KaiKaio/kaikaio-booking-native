import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBillStatistics } from '../services/bill';
import { StatisticsResponseData } from '../types/bill';
import Composition from '../components/Composition';
import { theme } from '../theme';

const Statistics = () => {
  const insets = useSafeAreaInsets();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StatisticsResponseData | null>(null);

  // Generate month list (e.g., last 12 months + current month)
  const months = React.useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      list.unshift(`${year}-${month}`);
    }
    return list;
  }, []);

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Scroll to end (current month) on mount
    setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
    }, 100);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [year, month] = currentMonth.split('-');
        const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
        const start = `${currentMonth}-01 00:00:00`;
        const end = `${currentMonth}-${lastDay} 23:59:59`;

        const res = await getBillStatistics(start, end);
        if (res.code === 200) {
          setData(res.data);
        }
      } catch (error) {
        console.error('Fetch statistics failed', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentMonth]);

  const renderHeader = () => {
    return (
      <View style={styles.header}>
        <Text style={styles.headerTitle}>共支出</Text>
        <Text style={styles.totalExpense}>
          ¥{data?.total_expense || '0.00'}
        </Text>
        <Text style={styles.totalIncome}>
          共收入¥{data?.total_income || '0.00'}
        </Text>
      </View>
    );
  };

  const renderMonthSelector = () => {
    return (
      <View style={styles.monthSelectorContainer}>
        <ScrollView 
          ref={scrollViewRef}
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.monthList}
        >
          {months.map((m) => {
            const isSelected = m === currentMonth;
            return (
              <TouchableOpacity 
                key={m} 
                style={[
                  styles.monthItem, 
                  isSelected && styles.monthItemSelected
                ]} 
                onPress={() => setCurrentMonth(m)}
              >
                <Text style={[
                  styles.monthText, 
                  isSelected && styles.monthTextSelected
                ]}>
                  {m}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {renderHeader()}
      {renderMonthSelector()}
      
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
        ) : (
          <ScrollView 
            style={styles.detailsScroll}
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          >
            <Composition data={data?.total_data || []} />
            <View style={styles.spacer} />
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.default,
  },
  header: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    backgroundColor: theme.colors.background.paper,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.lg,
    borderRadius: theme.spacing.radius.md,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerTitle: {
    fontSize: theme.typography.size.md,
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
    fontWeight: theme.typography.weight.medium,
  },
  totalExpense: {
    fontSize: theme.typography.size.display,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
  },
  totalIncome: {
    fontSize: theme.typography.size.md,
    color: theme.colors.text.placeholder,
  },
  monthSelectorContainer: {
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  monthList: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  monthItem: {
    marginRight: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.spacing.radius.xl,
    backgroundColor: theme.colors.background.paper,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  monthItemSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  monthText: {
    fontSize: theme.typography.size.md,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.weight.medium,
  },
  monthTextSelected: {
    color: theme.colors.text.inverse,
    fontWeight: '600',
    fontSize: theme.typography.size.md,
  },
  content: {
    flex: 1,
    backgroundColor: theme.colors.background.default,
  },
  detailsScroll: {
    flex: 1,
  },
  loader: {
    marginTop: theme.spacing.xl,
  },
  spacer: {
    height: theme.spacing.xl,
  },
});

export default Statistics;