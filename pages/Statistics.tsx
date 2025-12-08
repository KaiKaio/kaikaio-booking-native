import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBillStatistics } from '../services/bill';
import { StatisticsResponseData } from '../types/bill';

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
            // const [y, mo] = m.split('-');
            // Format to match prototype "2025-10" vs "2025-11"
            // Prototype shows full YYYY-MM
            return (
              <TouchableOpacity 
                key={m} 
                style={styles.monthItem} 
                onPress={() => setCurrentMonth(m)}
              >
                <Text style={[
                  styles.monthText, 
                  isSelected && styles.selectedMonthText
                ]}>
                  {m}
                </Text>
                {isSelected && <View style={styles.indicator} />}
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
          <ActivityIndicator size="large" color="#0090FF" style={styles.loader} />
        ) : (
          <ScrollView style={styles.detailsScroll}>
            {/* Placeholder for future detailed list */}
            {/* The user didn't ask for the list UI yet, but we have the data in `data.total_data` */}
            {/* We can iterate and show them if needed, but keeping it clean for now based on request */}
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
    backgroundColor: '#fff',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 14,
    color: '#0090FF',
    marginBottom: 10,
    fontWeight: '500',
  },
  totalExpense: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#0090FF',
    marginBottom: 10,
  },
  totalIncome: {
    fontSize: 14,
    color: '#999',
  },
  monthSelectorContainer: {
    height: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  monthList: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  monthItem: {
    marginRight: 24,
    justifyContent: 'center',
    height: '100%',
    position: 'relative',
  },
  monthText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  selectedMonthText: {
    color: '#0090FF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  indicator: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    height: 0, 
    // The prototype doesn't show an underline, just bold blue text. 
    // But usually there might be one. I'll hide it for now to match the text-only focus style more closely or keep it subtle.
    // Let's remove it to match the "clean text" look of the prototype if implied, but typically "selected" implies some state.
    // The prototype shows "2025-10" in blue and larger.
  },
  content: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  detailsScroll: {
    flex: 1,
  },
  loader: {
    marginTop: 20,
  },
  spacer: {
    height: 20,
  },
});

export default Statistics;
