import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import { getMonthList } from '@/services/bill';
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
  const [months, setMonths] = useState<string[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const handleFetchMonthList = async () => {
      try {
        const res = await getMonthList(type_id);

        if (res.code !== 200 || !res?.data) {
          throw new Error(`Failed to fetch month list: ${res.msg}`);
        }

        // 将 API 返回的 "YYYY/MM" 格式转换为 "YYYY-MM" 格式
        const monthList = res.data.map(month => month.replace('/', '-'));
        setMonths(monthList);

        // Scroll to end (current month) on mount
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: false });
        }, 100);
      } catch (error) {
        console.error('Error fetching month list:', error);
      }
    };

    handleFetchMonthList();
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
