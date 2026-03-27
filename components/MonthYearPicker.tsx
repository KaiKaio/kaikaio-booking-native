import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/theme';

interface MonthYearPickerProps {
  visible: boolean;
  currentDate: string; // Format: YYYY-MM
  onClose: () => void;
  onConfirm: (year: number, month: number) => void;
}

const MonthYearPicker: React.FC<MonthYearPickerProps> = ({ visible, currentDate, onClose, onConfirm }) => {
  const insets = useSafeAreaInsets();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

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

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  const handleConfirm = () => {
    onConfirm(selectedYear, selectedMonth);
    onClose();
  };

  const isCurrentMonth = (month: number) => {
    return selectedYear === currentYear && month === currentMonth;
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]} onStartShouldSetResponder={() => true}>
          {/* 拖拽指示器 */}
          <View style={styles.handleBar} />

          {/* Header with Year Selector */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>取消</Text>
            </TouchableOpacity>

            <View style={styles.yearSelector}>
              <TouchableOpacity
                onPress={() => changeYear(-1)}
                style={styles.arrowBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.arrowText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.yearText}>{selectedYear}年</Text>
              <TouchableOpacity
                onPress={() => changeYear(1)}
                style={styles.arrowBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.arrowText}>›</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleConfirm} style={styles.confirmBtn}>
              <Text style={styles.confirmText}>确定</Text>
            </TouchableOpacity>
          </View>

          {/* Month Grid */}
          <View style={styles.monthGrid}>
            {months.map(month => {
              const isSelected = month === selectedMonth;
              const isCurrent = isCurrentMonth(month);
              return (
                <TouchableOpacity
                  key={month}
                  style={[
                    styles.monthItem,
                    isSelected && styles.selectedMonthItem,
                    isCurrent && !isSelected && styles.currentMonthItem,
                  ]}
                  onPress={() => setSelectedMonth(month)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.monthText,
                    isSelected && styles.selectedMonthText,
                    isCurrent && !isSelected && styles.currentMonthText,
                  ]}>
                    {month}
                  </Text>
                  {isCurrent && (
                    <View style={styles.currentDot} />
                  )}
                </TouchableOpacity>
              );
            })}
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
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: theme.colors.background.paper,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  handleBar: {
    width: 36,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 50,
  },
  cancelText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.neutral,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  arrowBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
  },
  arrowText: {
    fontSize: 28,
    fontWeight: '300',
    color: theme.colors.primary,
    lineHeight: 32,
  },
  yearText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginHorizontal: 12,
  },
  confirmBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 50,
    alignItems: 'flex-end',
  },
  confirmText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  monthItem: {
    width: '25%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: theme.colors.background.neutral,
    marginHorizontal: '0%',
  },
  selectedMonthItem: {
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  currentMonthItem: {
    // borderWidth: 1.5,
    backgroundColor: `${theme.colors.primary}10`,
  },
  monthText: {
    fontSize: 18,
    fontWeight: '500',
    color: theme.colors.text.primary,
  },
  selectedMonthText: {
    color: theme.colors.text.inverse,
    fontWeight: '700',
  },
  currentMonthText: {
    color: theme.colors.primary,
  },
  currentDot: {
    position: 'absolute',
    bottom: 8,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
  },
});

export default MonthYearPicker;
