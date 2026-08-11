import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBillStatistics, loadBillMonthCache, saveBillMonthCache } from '../services/bill';
import { StatisticsResponseData } from '../types/bill';
import Composition from '../components/Composition';
import MonthSelector from '../components/MonthSelector';
import { theme } from '../theme';
import { getActiveAccount } from '../utils/storage';
import {
  StreakData,
  isMotivationEnabled,
  loadStreakWithCache,
} from '../services/bookkeepingStreak';
import {
  BUDGET_WARN_RATIO,
  BudgetProgressData,
  fetchBudgetProgress,
  loadBudgetProgressCache,
  saveBudgetProgressCache,
} from '../services/budgets';

// 预算进度条颜色：正常 / 接近上限（≥80%）/ 超支
const budgetBarColor = (ratio: number) => {
  if (ratio >= 1) return '#E53935';
  if (ratio >= BUDGET_WARN_RATIO) return '#F5A623';
  return theme.colors.primary;
};

// 单条预算进度（总预算与分类预算复用）
const BudgetProgressRow: React.FC<{
  label: string;
  amount: number;
  used: number;
  ratio: number;
}> = ({ label, amount, used, ratio }) => {
  const percent = Math.min(ratio, 1);
  return (
    <View style={styles.budgetRow}>
      <View style={styles.budgetRowHeader}>
        <Text style={styles.budgetLabel}>{label}</Text>
        <Text style={[styles.budgetValue, ratio >= 1 && styles.budgetValueOver]}>
          ¥{used.toFixed(2)} / ¥{amount.toFixed(2)}
        </Text>
      </View>
      <View style={styles.budgetTrack}>
        <View
          style={[
            styles.budgetFill,
            { width: `${percent * 100}%`, backgroundColor: budgetBarColor(ratio) },
          ]}
        />
      </View>
    </View>
  );
};

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
  // P3：连续记账天数（激励开关开启时展示）
  const [streak, setStreak] = useState<StreakData | null>(null);
  // P3：当月预算进度（未设置任何预算时为 null）
  const [budgetProgress, setBudgetProgress] = useState<BudgetProgressData | null>(null);

  // 拉取 streak（服务端权威，本地缓存兑底）
  const loadStreak = React.useCallback(async () => {
    const account = await getActiveAccount();
    if (!account) return;
    if (!(await isMotivationEnabled(account))) {
      setStreak(null);
      return;
    }
    const result = await loadStreakWithCache(account);
    setStreak(result);
  }, []);

  // 拉取指定月份的预算进度（失败时回退本地缓存）
  const loadBudgetProgress = React.useCallback(async (month: string) => {
    const account = await getActiveAccount();
    if (!account) return;
    let progress = await fetchBudgetProgress(month);
    if (progress) {
      await saveBudgetProgressCache(account, progress);
    } else {
      progress = await loadBudgetProgressCache(account, month);
    }
    const hasBudget =
      !!progress && (!!progress.totalBudget || progress.categoryBudgets.length > 0);
    setBudgetProgress(hasBudget ? progress : null);
  }, []);

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
      if (monthCache && monthCache.statistics) {
        hasCache = true;
        setData(monthCache.statistics);
        finalDataState = monthCache.statistics.total_data.length === 0 ? 'empty' : 'offline-cached';
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
        
        // 缓存统计数据
        const currentCache = await loadBillMonthCache(monthToFetch);
        await saveBillMonthCache(
          monthToFetch,
          currentCache?.list || [],
          currentCache?.summary || { totalExpense: 0, totalIncome: 0 },
          res.data
        );
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
    loadStreak();
    loadBudgetProgress(currentMonth);
  }, [currentMonth, fetchData, loadStreak, loadBudgetProgress]);

  const handleRefresh = React.useCallback(() => {
    fetchData(currentMonth, true);
    loadStreak();
    loadBudgetProgress(currentMonth);
  }, [currentMonth, fetchData, loadStreak, loadBudgetProgress]);

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
        {!!streak && streak.currentStreak > 0 && (
          <Text style={styles.streakText}>
            🔥 已连续记账 {streak.currentStreak} 天
            {streak.longestStreak > streak.currentStreak
              ? ` · 最长 ${streak.longestStreak} 天`
              : ''}
          </Text>
        )}
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

      {/* P3：预算进度卡片（设置了预算才展示，接近上限变色预警） */}
      {!!budgetProgress && (
        <View style={styles.budgetCard}>
          <Text style={styles.budgetCardTitle}>{budgetProgress.month} 预算</Text>
          {budgetProgress.totalBudget && (
            <BudgetProgressRow
              label="总预算"
              amount={budgetProgress.totalBudget.amount}
              used={budgetProgress.totalBudget.used}
              ratio={budgetProgress.totalBudget.ratio}
            />
          )}
          {budgetProgress.categoryBudgets.map(item => (
            <BudgetProgressRow
              key={item.categoryId}
              label={item.categoryName}
              amount={item.amount}
              used={item.used}
              ratio={item.ratio}
            />
          ))}
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
  streakText: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.size.sm,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.weight.medium,
  },
  budgetCard: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background.paper,
    borderRadius: theme.spacing.radius.md,
    padding: theme.spacing.md,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  budgetCardTitle: {
    fontSize: theme.typography.size.md,
    fontWeight: theme.typography.weight.medium,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  budgetRow: {
    marginBottom: theme.spacing.sm,
  },
  budgetRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  budgetLabel: {
    fontSize: theme.typography.size.sm,
    color: theme.colors.text.secondary,
  },
  budgetValue: {
    fontSize: theme.typography.size.sm,
    color: theme.colors.text.secondary,
  },
  budgetValueOver: {
    color: '#E53935',
    fontWeight: theme.typography.weight.medium,
  },
  budgetTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.background.neutral,
    overflow: 'hidden',
  },
  budgetFill: {
    height: 6,
    borderRadius: 3,
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