import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBillStatistics } from '../services/bill';
import { StatisticsResponseData } from '../types/bill';
import Composition from '../components/Composition';

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
          <ActivityIndicator size="large" color="#0090FF" style={styles.loader} />
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
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
    paddingVertical: 10,
    marginTop: 6,
  },
  monthList: {
    alignItems: 'center',
  },
  monthItem: {
    marginRight: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  monthItemSelected: {
    backgroundColor: '#0090FF',
    borderColor: '#0090FF',
    shadowColor: '#0090FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  monthText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  monthTextSelected: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
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
