import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Keyboard,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCategory } from '../context/CategoryContext';
import IconFont from '../components/IconFont'; // 根据实际路径引入
import CategoryIcon from './CategoryIcon';

export interface BillFormRef {
  open: (data?: BillData) => void;
}

interface BillFormProps {
  onSubmit?: (data: BillData) => void;
}

export interface BillData {
  amount: number;
  category: string; // id
  categoryName: string;
  date: string; // YYYY-MM-DD
  remark: string;
  type: number; // 1: expense, 2: income
}

const BillForm = forwardRef<BillFormRef, BillFormProps>(({ onSubmit }, ref) => {
  const insets = useSafeAreaInsets();
  const { categories } = useCategory();
  const [visible, setVisible] = useState(false);
  const [editData, setEditData] = useState<BillData | undefined>(undefined);
  
  // Form State
  const [amountStr, setAmountStr] = useState('0');
  const [category, setCategory] = useState(categories[0]);
  const [date, setDate] = useState(new Date());
  const [remark, setRemark] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [isRemarkInputFocused, setIsRemarkInputFocused] = useState(false);

  useImperativeHandle(ref, () => ({
    open: (data?: BillData) => {
      setEditData(data);
      setVisible(true);
    }
  }));

  // Reset form when opening
  useEffect(() => {
    if (visible) {
      if (editData) {
        setAmountStr(editData.amount.toString());
        // Find category by ID if possible, otherwise name
        const cat = categories.find(c => c.id === editData.category || c.name === editData.categoryName) || categories[0];
        setCategory(cat);
        setDate(new Date(editData.date));
        setRemark(editData.remark);
      } else {
        setAmountStr('0');
        setCategory(categories[0]);
        setRemark('');
        
        // Try to load last used date
         AsyncStorage.getItem('LAST_BILL_DATE').then(lastDate => {
           if (lastDate) {
             // Parse YYYY-MM-DD to local date to avoid timezone issues
             const parts = lastDate.split('-');
             if (parts.length === 3) {
               const year = parseInt(parts[0], 10);
               const month = parseInt(parts[1], 10);
               const day = parseInt(parts[2], 10);
               setDate(new Date(year, month - 1, day));
               return;
             }
             
             const d = new Date(lastDate);
             if (!isNaN(d.getTime())) {
               setDate(d);
               return;
             }
           }
           setDate(new Date());
         }).catch(() => {
          setDate(new Date());
        });
      }
      setShowDatePicker(false);
    }
  }, [visible, editData, categories]);

  const handlePressKey = (key: string) => {
    Keyboard.dismiss();
    if (key === 'delete') {
      setAmountStr(prev => {
        if (prev.length <= 1) return '0';
        return prev.slice(0, -1);
      });
      return;
    }

    if (key === '.') {
      if (amountStr.includes('.')) return;
      setAmountStr(prev => prev + '.');
      return;
    }

    // Number
    setAmountStr(prev => {
      if (prev === '0') return key;
      // Limit decimal places to 2
      if (prev.includes('.')) {
        const [, decimal] = prev.split('.');
        if (decimal && decimal.length >= 2) return prev;
      }
      return prev + key;
    });
  };

  const handleSubmit = () => {
    const amount = parseFloat(amountStr);
    if (amount <= 0) {
      // Optionally show alert
      return;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Save last used date
    AsyncStorage.setItem('LAST_BILL_DATE', dateStr).catch(err => console.warn('Failed to save date', err));

    const data: BillData = {
      amount,
      category: category.id,
      categoryName: category.name,
      date: dateStr,
      remark,
      type: category.type
    };
    onSubmit?.(data);
    setVisible(false);
  };

  const renderKeypad = () => {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'delete'];
    return (
      <View style={styles.keypad}>
        {keys.map(key => (
          <TouchableOpacity
            key={key}
            style={styles.key}
            onPress={() => handlePressKey(key)}
          >
            <Text style={styles.keyText}>{key === 'delete' ?  <IconFont name="qianming" size={30} color="#000" /> : key}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Simple Custom Date Picker Implementation
  const renderDatePicker = () => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <View style={styles.datePickerContainer}>
        <View style={styles.dateHeader}>
          <TouchableOpacity onPress={() => setDate(new Date(year, month - 2, day))}>
            <Text style={styles.arrow}>◀️</Text>
          </TouchableOpacity>
          <Text style={styles.dateTitle}>{year}年 {month}月</Text>
          <TouchableOpacity onPress={() => setDate(new Date(year, month, day))}>
            <Text style={styles.arrow}>▶️</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.todayBtn}
            onPress={() => {
              setDate(new Date());
              setShowDatePicker(false);
            }}
          >
            <Text style={styles.todayText}>今日</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.daysGrid}>
          {days.map(d => (
            <TouchableOpacity
              key={d}
              style={[styles.dayItem, d === day && styles.selectedDay]}
              onPress={() => {
                Keyboard.dismiss();
                setDate(new Date(year, month - 1, d));
                setShowDatePicker(false);
              }}
            >
              <Text style={[styles.dayText, d === day && styles.selectedDayText]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={() => setVisible(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.avoidView}
      >
        <TouchableOpacity 
          style={styles.overlay} 
          activeOpacity={1} 
          onPress={() => setVisible(false)}
        >
          {/* Close on overlay tap */}
        </TouchableOpacity>


        <View style={[styles.panel, { paddingBottom: Math.max(20, insets.bottom) }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setVisible(false)}>
            <Text style={styles.cancelBtn}>取消</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{editData ? '编辑账单' : '记一笔'}</Text>
          <TouchableOpacity onPress={handleSubmit}>
            <Text style={styles.submitBtn}>完成</Text>
          </TouchableOpacity>
        </View>

        {/* Amount Display */}
        <View style={styles.amountContainer}>
          <Text style={styles.currency}>￥</Text>
          <Text style={styles.amount}>{amountStr}</Text>
        </View>

        {/* Category Selection */}
        <View style={styles.categoryContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {categories.map(cat => (
                <TouchableOpacity 
                  key={cat.id} 
                  style={[styles.catItem, category.id === cat.id && styles.selectedCat]}
                  onPress={() => {
                    Keyboard.dismiss();
                    setCategory(cat);
                  }}
                >
                  <View style={[styles.catIconWrap, category.id === cat.id && styles.selectedCatIconWrap]}>
                  <CategoryIcon icon={cat.icon} size={24} />
                </View>
                  <Text style={[styles.catName, category.id === cat.id && styles.selectedCatName]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
        </View>

        {/* Inputs Row */}
        <View style={styles.inputsRow}>
            <TouchableOpacity 
              style={styles.dateInput} 
              onPress={() => setShowDatePicker(!showDatePicker)}
            >
              <Text style={styles.label}>日期</Text>
              <Text style={styles.value}>{date.getFullYear()}-{String(date.getMonth() + 1).padStart(2, '0')}-{String(date.getDate()).padStart(2, '0')}</Text>
            </TouchableOpacity>
            
            <View style={styles.remarkInputContainer}>
              <Text style={styles.label}>备注</Text>
              <TextInput
                style={styles.remarkInput}
                placeholder="写点什么..."
                value={remark}
                onChangeText={setRemark}
                onFocus={() => setIsRemarkInputFocused(true)}
                onBlur={() => setIsRemarkInputFocused(false)}
                maxLength={50}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </View>
        </View>

        {/* Bottom Area: Keypad or DatePicker */}
        <View style={[styles.bottomArea, isRemarkInputFocused && styles.bottomAreaFocused]}>
          {showDatePicker ? renderDatePicker() : renderKeypad()}
        </View>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  avoidView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  panel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20, // safe area
    height: '70%', // Occupy significant space
    position: 'absolute',
    bottom: 0,
    width: '100%',
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  cancelBtn: { color: '#888', fontSize: 16 },
  submitBtn: { color: '#0090FF', fontSize: 16, fontWeight: 'bold' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    justifyContent: 'center',
  },
  currency: { fontSize: 24, fontWeight: 'bold', color: '#333', marginRight: 4 },
  amount: { fontSize: 36, fontWeight: 'bold', color: '#333' },

  categoryContainer: {
    height: 90,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  catItem: {
    alignItems: 'center',
    marginHorizontal: 12,
    width: 60,
  },
  selectedCat: {
    // Highlight style
  },
  catIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  selectedCatIconWrap: {
    backgroundColor: '#e6f4ff',
  },
  catIcon: { fontSize: 24 },
  catName: { fontSize: 12, color: '#666' },
  selectedCatName: { color: '#0090FF', fontWeight: 'bold' },

  inputsRow: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  dateInput: {
    marginRight: 16,
    justifyContent: 'center',
  },
  remarkInputContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  label: { fontSize: 12, color: '#999', marginBottom: 4 },
  value: { fontSize: 14, color: '#333' },
  remarkInput: {
    fontSize: 14,
    color: '#333',
    padding: 0,
    height: 20, // Single line height visually, but logic handles text
  },

  bottomArea: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  bottomAreaFocused: {
    display: 'none',
  },
  keypad: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  key: {
    width: '33.33%',
    height: '25%', // 4 rows
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#eee',
    backgroundColor: '#fff',
  },
  keyText: { fontSize: 24, color: '#333' },

  // Date Picker Styles
  datePickerContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    position: 'relative',
  },
  todayBtn: {
    position: 'absolute',
    right: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 14,
  },
  todayText: {
    fontSize: 12,
    color: '#333',
  },
  arrow: { fontSize: 20, paddingHorizontal: 20 },
  dateTitle: { fontSize: 16, fontWeight: 'bold' },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  dayItem: {
    width: '14.28%', // 7 days
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  selectedDay: {
    backgroundColor: '#0090FF',
    borderRadius: 20,
  },
  dayText: { fontSize: 14, color: '#333' },
  selectedDayText: { color: '#fff' },
});

export default BillForm;
