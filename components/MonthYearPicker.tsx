import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { theme } from '@/theme';

interface MonthYearPickerProps {
  visible: boolean;
  currentDate: string; // Format: YYYY-MM
  onClose: () => void;
  onConfirm: (year: number, month: number) => void;
}

const MonthYearPicker: React.FC<MonthYearPickerProps> = ({ visible, currentDate, onClose, onConfirm }) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    if (visible && currentDate) {
      const [year, month] = currentDate.split('-').map(Number);
      if (year && month) {
        setSelectedYear(year);
        setSelectedMonth(month);
      }
    }
  }, [visible, currentDate]);

  const changeYear = (increment: number) => {
    setSelectedYear(prev => prev + increment);
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const handleMonthPress = (month: number) => {
    setSelectedMonth(month);
    onConfirm(selectedYear, month);
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.container} onStartShouldSetResponder={() => true}>
          {/* Header with Year Selector */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => changeYear(-1)} style={styles.arrowBtn}>
              <Text style={styles.arrowText}>◀️</Text>
            </TouchableOpacity>
            <Text style={styles.yearText}>{selectedYear}年</Text>
            <TouchableOpacity onPress={() => changeYear(1)} style={styles.arrowBtn}>
              <Text style={styles.arrowText}>▶️</Text>
            </TouchableOpacity>
          </View>

          {/* Month Grid */}
          <View style={styles.monthGrid}>
            {months.map(month => (
              <TouchableOpacity
                key={month}
                style={[
                  styles.monthItem,
                  month === selectedMonth && styles.selectedMonthItem
                ]}
                onPress={() => handleMonthPress(month)}
              >
                <Text style={[
                  styles.monthText,
                  month === selectedMonth && styles.selectedMonthText
                ]}>
                  {month}月
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: 300,
    backgroundColor: theme.colors.background.paper,
    borderRadius: 12,
    padding: 16,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  arrowBtn: {
    padding: 10,
  },
  arrowText: {
    fontSize: 20,
    color: theme.colors.primary,
  },
  yearText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  monthItem: {
    width: '30%',
    aspectRatio: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderRadius: 8,
    backgroundColor: theme.colors.background.neutral,
  },
  selectedMonthItem: {
    backgroundColor: theme.colors.primary,
  },
  monthText: {
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  selectedMonthText: {
    color: theme.colors.text.inverse,
    fontWeight: 'bold',
  },
});

export default MonthYearPicker;
