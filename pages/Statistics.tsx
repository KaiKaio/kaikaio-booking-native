import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildStatisticsFromDailyBills, getBillStatistics, loadBillMonthCache } from '../services/bill';
import { StatisticsResponseData } from '../types/bill';
import Composition from '../components/Composition';
import MonthSelector from '../components/MonthSelector';
import { theme } from '../theme';

const Statistics = () => {
  const insets = useSafeAreaInsets();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<StatisticsResponseData | null>(null);
  const [dataState, setDataState] = useState<'online' | 'offline-cached' | 'empty' | 'error'>('online');

  const fetchData = React.useCallback(async (monthToFetch: string, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    let hasCache = false;
    let finalDataState: 'online' | 'offline-cached' | 'empty' | 'error' = 'online';

    try {
      const monthCache = await loadBillMonthCache(monthToFetch);
      if (monthCache) {
        hasCache = true;
        setData(buildStatisticsFromDailyBills(monthCache.list));
        finalDataState = 'offline-cached';
      }

      // monthToFetch 格式为 YYYY-MM
      const [year, month] = monthToFetch.split('-');
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
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchData(currentMonth);
  }, [currentMonth, fetchData]);

  const handleRefresh = React.useCallback(() => {
    fetchData(currentMonth, true);
  }, [currentMonth, fetchData]);

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



  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {renderHeader()}
      <MonthSelector 
        currentMonth={currentMonth} 
        onCurrentMonthChange={setCurrentMonth} 
      />

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
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[theme.colors.primary]}
                tintColor={theme.colors.primary}
              />
            }
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