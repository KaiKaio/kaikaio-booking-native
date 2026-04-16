import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import { getEarliestItemDate } from '@/services/bill';
import { theme } from '@/theme';

interface MonthSelectorProps {
  currentMonth: string;
  onCurrentMonthChange: (month: string) => void;
  type_id?: number;
}

const MonthSelector: React.FC<MonthSelectorProps> = ({
  currentMonth,
  onCurrentMonthChange,
  type_id,
}) => {
  const [earliestDate, setEarliestDate] = useState<string>('');
  const scrollViewRef = useRef<ScrollView>(null);

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

  useEffect(() => {
    const handleFetchEarliestItemDate = async () => {
    try {
      const res = await getEarliestItemDate(type_id);

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

    handleFetchEarliestItemDate();
  }, [type_id]);

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
              style={[styles.monthItem, isSelected && styles.monthItemSelected]}
              onPress={() => onCurrentMonthChange(m)}
            >
              <Text
                style={[
                  styles.monthText,
                  isSelected && styles.monthTextSelected,
                ]}
              >
                {m}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
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
});

export default MonthSelector;
