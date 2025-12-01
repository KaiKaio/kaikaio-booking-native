import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Keyboard
} from 'react-native';
import { useCategory } from '../context/CategoryContext';
import IconFont from '../components/IconFont'; // 根据实际路径引入

interface BillItemProps {
  onSubmit?: (data: BillData) => void;
  initialData?: BillData;
}

export interface BillData {
  amount: number;
  category: string; // id
  categoryName: string;
  date: string; // YYYY-MM-DD
  remark: string;
  type: number; // 1: expense, 2: income
}

const BillItem: React.FC<BillItemProps> = ({ onSubmit, initialData }) => {
  const { categories } = useCategory();
  const [visible, setVisible] = useState(false);
  
  // Form State
  const [amountStr, setAmountStr] = useState('0');
  const [category, setCategory] = useState(categories[0]);
  const [date, setDate] = useState(new Date());
  const [remark, setRemark] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [isRemarkInputFocused, setIsRemarkInputFocused] = useState(false);

  // Reset form when opening
  useEffect(() => {
    if (visible) {
      if (initialData) {
        setAmountStr(initialData.amount.toString());
        const cat = categories.find(c => c.name === initialData.category) || categories[0];
        setCategory(cat);
        setDate(new Date(initialData.date));
        setRemark(initialData.remark);
      } else {
        setAmountStr('0');
        setCategory(categories[0]);
        setDate(new Date());
        setRemark('');
      }
      setShowDatePicker(false);
    }
  }, [visible, initialData, categories]);

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
    <>
      <TouchableOpacity style={styles.triggerBtn} onPress={() => setVisible(true)}>
        <Text style={styles.triggerIcon}>✏️</Text>
        {/* <Text style={styles.triggerText}>记一笔</Text> */}
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity 
            style={styles.overlay} 
            activeOpacity={1} 
            onPress={() => setVisible(false)}
        >
           {/* Close on overlay tap */}
        </TouchableOpacity>

        <View style={styles.panel}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setVisible(false)}>
              <Text style={styles.cancelBtn}>取消</Text>
            </TouchableOpacity>
            <Text style={styles.title}>记一笔</Text>
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
                      <Text style={styles.catIcon}>{cat.icon}</Text>
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
                />
             </View>
          </View>

          {/* Bottom Area: Keypad or DatePicker */}
          <View style={[styles.bottomArea, isRemarkInputFocused && styles.bottomAreaFocused]}>
            {showDatePicker ? renderDatePicker() : renderKeypad()}
          </View>

        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  triggerBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0090FF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    // Position handled by parent or absolute here?
    // The requirement says "Display as a button".
    // I'll make it a self-contained button, but styling might need adjustment based on placement.
  },
  triggerIcon: {
    fontSize: 24,
    color: '#fff',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
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

export default BillItem;
