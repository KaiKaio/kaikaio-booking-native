import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { theme } from '@/theme';

type Props = {
  date: Date;
  onChange: (d: Date) => void;
  onClose?: () => void; // close the picker UI
  onSwitchToKeypad?: () => void; // switch back to numeric keypad
};

const DatePicker: React.FC<Props> = ({ date, onChange, onClose, onSwitchToKeypad }) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0=周日, 1=周一, ...
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptySlots = Array.from({ length: firstDayOfWeek }, (_, i) => i);

  const getSafeDate = (targetYear: number, targetMonthIndex: number, targetDay: number) => {
    const maxDay = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
    return new Date(targetYear, targetMonthIndex, Math.min(targetDay, maxDay));
  };

  const handleMonthChange = (offset: number) => {
    const target = new Date(year, month - 1 + offset, 1);
    onChange(getSafeDate(target.getFullYear(), target.getMonth(), day));
  };

  const handleYearChange = (offset: number) => {
    onChange(getSafeDate(year + offset, month - 1, day));
  };

  return (
    <View style={styles.datePickerContainer}>
      <View style={styles.dateHeader}>
        <TouchableOpacity style={styles.numBtn} onPress={() => onSwitchToKeypad?.() }>
          <Text style={styles.numText}>数字键盘</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleYearChange(-1)}>
          <Text style={styles.arrow}>«</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleMonthChange(-1)}>
          <Text style={styles.arrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.dateTitle}>{year}年 {month}月</Text>
        <TouchableOpacity onPress={() => handleMonthChange(1)}>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleYearChange(1)}>
          <Text style={styles.arrow}>»</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.todayBtn}
          onPress={() => {
            onChange(new Date());
            onClose?.();
          }}
        >
          <Text style={styles.todayText}>今日</Text>
        </TouchableOpacity>
      </View>
      {/* Weekday header */}
      <View style={styles.weekdaysRow}>
        {['日','一','二','三','四','五','六'].map(w => (
          <View key={w} style={styles.weekdayItem}>
            <Text style={styles.weekdayText}>{w}</Text>
          </View>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.daysGrid}>
        {/* 空白占位，让1日对齐到正确的星期 */}
        {emptySlots.map(i => (
          <View key={`empty-${i}`} style={styles.dayItem} />
        ))}
        {days.map(d => (
          <TouchableOpacity
            key={d}
            style={[styles.dayItem, d === day && styles.selectedDay]}
            onPress={() => {
              onChange(new Date(year, month - 1, d));
              onClose?.();
            }}
          >
            <Text style={[styles.dayText, d === day && styles.selectedDayText]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  datePickerContainer: {
    flex: 1,
    backgroundColor: theme.colors.background.paper,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    position: 'relative',
  },
  numBtn: {
    position: 'absolute',
    left: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.background.neutral,
    borderRadius: 14,
  },
  todayBtn: {
    position: 'absolute',
    right: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.background.neutral,
    borderRadius: 14,
  },
  todayText: {
    fontSize: 12,
    color: theme.colors.text.primary,
  },
  arrow: { fontSize: 20, paddingHorizontal: 8, color: theme.colors.text.primary },
  numText: { fontSize: 12, color: theme.colors.text.primary },
  dateTitle: { fontSize: 16, fontWeight: 'bold', marginHorizontal: 4 },
  weekdaysRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    backgroundColor: theme.colors.background.paper,
  },
  weekdayItem: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: 6,
  },
  weekdayText: {
    fontSize: 12,
    color: theme.colors.text.placeholder,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  dayItem: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  selectedDay: {
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
  },
  dayText: { fontSize: 14, color: theme.colors.text.primary },
  selectedDayText: { color: theme.colors.text.inverse },
});

export default DatePicker;
