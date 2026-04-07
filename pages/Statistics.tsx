import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildStatisticsFromDailyBills, getBillStatistics, getEarliestItemDate, loadBillMonthCache } from '../services/bill';
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
  const [dataState, setDataState] = useState<'online' | 'offline-cached' | 'empty' | 'error'>('online');

  const [earliestDate, setEarliestDate] = useState<string>('');

  // 根据 earliestDate 计算出到当前月的月份列表
  const months = React.useMemo(() => {
    if (!earliestDate) return [];

    const monthList = [];
    const startDate = new Date(earliestDate);
    const endDate = new Date();

    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();
    const endYear = endDate.getFullYear();
    const endMonth = endDate.getMonth();

    for (let year = startYear; year <= endYear; year++) {
      const monthStart = year === startYear ? startMonth : 0;
      const monthEnd = year === endYear ? endMonth : 11;

      for (let month = monthStart; month <= monthEnd; month++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}`;
        monthList.push(dateStr);
      }
    }

    return monthList;
  }, [earliestDate]);

  const handleFetchEarliestItemDate = async () => {
    try {
      const res = await getEarliestItemDate();
      
      if (res.code !== 200 || !res?.data) {
        throw new Error(`Failed to fetch earliest item date: ${res.msg}`);
      }
      // 处理日期字符串，例如 "2020-11-10T12:16:59.000Z"，转换为 YYYY-MM-DD 格式
      const formattedDate = new Date(res.data).toISOString().split('T')[0];
      setEarliestDate(formattedDate);
      // Scroll to end (current month) on mount
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (error) {
      console.error('Error fetching earliest item dates:', error);  
    }
  };

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    handleFetchEarliestItemDate();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      let hasCache = false;
      let finalDataState: 'online' | 'offline-cached' | 'empty' | 'error' = 'online';

      try {
        const monthCache = await loadBillMonthCache(currentMonth);
        if (monthCache) {
          hasCache = true;
          setData(buildStatisticsFromDailyBills(monthCache.list));
          finalDataState = 'offline-cached';
        }

        // currentMonth 格式为 YYYY-MM
        const [year, month] = currentMonth.split('-');
        const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
        const start = `${year}-${month}-01 00:00:00`;
        const end = `${year}-${month}-${lastDay} 23:59:59`;

        const res = await getBillStatistics(start, end);
        if (res.code === 200) {
          setData(res.data);
          finalDataState = res.data.total_data.length === 0 ? 'empty' : 'online';
        } else if (!hasCache) {
          finalDataState = 'error';
        }
      } catch (error) {
        console.error('Fetch statistics failed', error);
        if (!hasCache) {
          finalDataState = 'error';
        }
      } finally {
        setDataState(finalDataState);
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

      {dataState === 'offline-cached' && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>当前离线，展示缓存统计</Text>
        </View>
      )}

      {dataState === 'error' && !loading && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>统计加载失败，请稍后重试</Text>
        </View>
      )}
      
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
    shadowColor: theme.colors.shadow,
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
  offlineBanner: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: '#FFF4E5',
    borderRadius: theme.spacing.radius.sm,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  offlineText: {
    color: '#8A4B00',
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.weight.medium,
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