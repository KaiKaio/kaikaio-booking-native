import React, { useState, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Keyboard,
  Platform,
  Alert,
  Animated,
  Dimensions
} from 'react-native';
import type { KeyboardEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCategory } from '../context/CategoryContext';
import CategoryIcon from './CategoryIcon';
import DatePicker from './DatePicker';
import Keypad from './Keypad';
import { theme } from '@/theme';
import { navigate } from '../utils/navigationRef';

export interface BillFormRef {
  open: (data?: BillData) => void;
}

interface BillFormProps {
  onSubmit?: (data: BillData) => void;
}

export interface BillData {
  amount: number;
  category: number; // id
  categoryName: string;
  date: string; // YYYY-MM-DD
  remark: string;
  type: '1' | '2'; // '1': expense, '2': income
}

const BillForm = forwardRef<BillFormRef, BillFormProps>(({ onSubmit }, ref) => {
  const insets = useSafeAreaInsets();
  const { categories } = useCategory();
  const [visible, setVisible] = useState(false);
  const [editData, setEditData] = useState<BillData | undefined>(undefined);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  // Form State
  const [amountStr, setAmountStr] = useState('0');
  const [category, setCategory] = useState(categories[0]);
  const [date, setDate] = useState(new Date());
  const [remark, setRemark] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeType, setActiveType] = useState<'1' | '2'>('1'); // '1': expense, '2': income

  const [isRemarkInputFocused, setIsRemarkInputFocused] = useState(false);
  
  // 防抖：防止重复提交
  const isSubmittingRef = React.useRef(false);

  useImperativeHandle(ref, () => ({
    open: (data?: BillData) => {
      setEditData(data);
      setVisible(true);
    }
  }));

  // Animation Logic
  const [modalVisible, setModalVisible] = useState(visible);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const remarkInputRef = React.useRef<TextInput | null>(null);

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: Dimensions.get('window').height,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => setModalVisible(false));
    }
  }, [visible, fadeAnim, slideAnim]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e: KeyboardEvent) => {
        setKeyboardVisible(true);
        // On Android, determine whether the app is running in full-screen (immersive)
        // mode by comparing screen and window heights. If full-screen, use the
        // original keyboard height; otherwise treat as no keyboard space adjustment.
        if (Platform.OS === 'android') {
          try {
            const screenH = Dimensions.get('screen').height;
            const windowH = Dimensions.get('window').height;
            const isFullScreen = Math.abs(screenH - windowH) < 1;
            setKeyboardHeight(isFullScreen ? (e.endCoordinates?.height ?? 0) : 0);
            return;
          } catch (err) {
            // Fallback to original behavior on any unexpected error
            setKeyboardHeight(e.endCoordinates?.height ?? 0);
            return;
          }
        }

        setKeyboardHeight(e.endCoordinates?.height ?? 0);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        // 键盘隐藏时，手动让输入框失去焦点
        remarkInputRef.current?.blur();
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Filter categories by active type
  const filteredCategories = categories.filter(cat => cat.type === activeType);

  // Reset form when opening
  useEffect(() => {
    if (visible) {
      if (editData) {
        setAmountStr(editData.amount.toString());
        // Find category by ID if possible, otherwise name
        const cat = categories.find(c => c.id === editData.category || c.name === editData.categoryName) || categories[0];
        setCategory(cat);
        setActiveType(cat.type);
        setDate(new Date(editData.date));
        setRemark(editData.remark);
      } else {
        setAmountStr('0');
        // Set default category based on active type
        const defaultCat = categories.find(c => c.type === activeType) || categories[0];
        setCategory(defaultCat);
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
  }, [visible, editData, categories, activeType]);

  const handleSubmit = () => {
    // 防抖检查：如果正在提交，直接返回
    if (isSubmittingRef.current) {
      return;
    }
    
    const amount = parseFloat(amountStr);
    if (amount <= 0) {
      Alert.alert('提示', '是不是忘了输入金额？');
      return;
    }
    
    // 标记为正在提交
    isSubmittingRef.current = true;
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Save last used date（保存本次使用日期，便于下次再次打开Form时快速填写）
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
    
    // 延迟重置提交状态，防止快速重复点击
    setTimeout(() => {
      isSubmittingRef.current = false;
    }, 1000);
  };

  // Date picker was extracted to components/DatePicker.tsx

  const keyboardOffset = Platform.OS === 'ios'
    ? Math.max(0, keyboardHeight - insets.bottom)
    : Math.max(0, keyboardHeight + 8);

  const overlayAnimatedStyle = useMemo(() => ({
    opacity: fadeAnim
  }), [fadeAnim]);

  const panelDynamicStyle = useMemo(() => ({
    paddingBottom: Math.max(20, insets.bottom),
    bottom: isRemarkInputFocused && keyboardVisible
      ? keyboardOffset
      : 0,
    transform: [{ translateY: slideAnim }]
  }), [insets.bottom, isRemarkInputFocused, keyboardVisible, keyboardOffset, slideAnim]);

  return (
    <Modal
      transparent
      visible={modalVisible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => setVisible(false)}
    >
      <View style={styles.avoidView}>
        <Animated.View 
          style={[styles.overlay, overlayAnimatedStyle]}
        >
          <TouchableOpacity
            style={styles.avoidView}
            activeOpacity={1} 
            onPress={() => {
              setVisible(false);
              Keyboard.dismiss();
            }}
          />
        </Animated.View>


        <Animated.View style={[
          styles.panel,
          panelDynamicStyle
        ]}>
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

          <View style={styles.mainHeader}>
            {/* Amount Display */}
            <View style={styles.amountContainer}>
              <Text style={styles.currency}>￥</Text>
              <Text style={styles.amount}>{amountStr}</Text>
            </View>

            {/* Type Tab */}
            <View style={styles.typeTabContainer}>
              <TouchableOpacity 
                style={[styles.typeTab, activeType === '1' && styles.typeTabActive]}
                onPress={() => {
                  Keyboard.dismiss()
                  setActiveType('1');
                  const firstExpense = categories.find(c => c.type === '1');
                  if (firstExpense) setCategory(firstExpense);
                }}
              >
                <Text style={[styles.typeTabText, activeType === '1' && styles.typeTabTextActive]}>支出</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.typeTab, activeType === '2' && styles.typeTabActive]}
                onPress={() => {
                  Keyboard.dismiss()
                  setActiveType('2');
                  const firstIncome = categories.find(c => c.type === '2');
                  if (firstIncome) setCategory(firstIncome);
                }}
              >
                <Text style={[styles.typeTabText, activeType === '2' && styles.typeTabTextActive]}>收入</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Category Selection */}
          <View style={styles.categoryContainer}>
            <ScrollView 
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.categoryScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {filteredCategories.map(cat => (
                <TouchableOpacity 
                  key={cat.id} 
                  style={[styles.catItem, category?.id === cat.id && styles.selectedCat]}
                  onPress={() => {
                    Keyboard.dismiss();
                    setCategory(cat);
                  }}
                >
                  <View style={[
                    styles.catIconWrap,
                    cat?.background_color && { backgroundColor: cat.background_color },
                    category?.id === cat.id && styles.selectedCatIconWrap
                  ]}>
                    <CategoryIcon icon={cat.icon} size={22} color={theme.colors.text.inverse} />
                  </View>
                  <Text style={[styles.catName, category?.id === cat.id && styles.selectedCatName]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
              {/* Add Category Button */}
              <TouchableOpacity 
                style={styles.catItem}
                onPress={() => {
                  Keyboard.dismiss();
                  setVisible(false);
                  setTimeout(() => {
                    navigate('CategoryEdit', { type: activeType });
                  }, 300);
                }}
              >
                <View style={styles.addCatIconWrap}>
                  <Text style={styles.addCatIcon}>+</Text>
                </View>
                <Text style={styles.catName}>管理</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Inputs Row */}
          <View style={styles.inputsRow}>
              <TouchableOpacity 
                style={styles.dateInput} 
                onPress={() => {
                  Keyboard.dismiss()
                  setShowDatePicker(!showDatePicker)
                }}
              >
                <Text style={styles.label}>日期</Text>
                <Text style={styles.value}>{date.getFullYear()}-{String(date.getMonth() + 1).padStart(2, '0')}-{String(date.getDate()).padStart(2, '0')}</Text>
              </TouchableOpacity>
              
              <View style={styles.remarkInputContainer}>
                <Text style={styles.label}>备注</Text>
                <TextInput
                  style={styles.remarkInput}
                  ref={remarkInputRef}
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
            {showDatePicker ? (
              <DatePicker
                date={date}
                onChange={(d) => setDate(d)}
                onClose={() => setShowDatePicker(false)}
                onSwitchToKeypad={() => setShowDatePicker(false)}
              />
            ) : (
              <Keypad amountStr={amountStr} onChange={setAmountStr} />
            )}
          </View>

        </Animated.View>
      </View>
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
    backgroundColor: theme.colors.background.paper,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20, // safe area
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
    borderBottomColor: theme.colors.border,
  },
  cancelBtn: { color: theme.colors.text.secondary, fontSize: 16 },
  submitBtn: { color: theme.colors.primary, fontSize: 16, fontWeight: 'bold' },
  title: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text.primary },

  mainHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginVertical: 18
  },
  
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currency: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text.primary, marginRight: 4 },
  amount: { fontSize: 24, fontWeight: 'bold', color: theme.colors.text.primary },

  categoryContainer: {
    height: 200,
    paddingVertical: 0,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  typeTabContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  typeTab: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: 4, // inner radius can be smaller
    backgroundColor: theme.colors.background.default
  },
  typeTabActive: {
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  typeTabText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },
  typeTabTextActive: {
    color: theme.colors.text.inverse,
    fontWeight: '600',
  },
  categoryScrollContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: 20,
  },
  catItem: {
    alignItems: 'center',
    width: '16.66%',
    marginBottom: 16,
  },
  selectedCat: {
    // Highlight style
  },
  catIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background.default,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  selectedCatIconWrap: {
    backgroundColor: theme.colors.background.primaryLight,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1, 
    shadowRadius: 3,
  },
  catIcon: { fontSize: 24 },
  catName: { fontSize: 12, color: theme.colors.text.secondary },
  selectedCatName: { color: theme.colors.primary, fontWeight: 'bold' },
  addCatIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  addCatIcon: {
    fontSize: 24,
    lineHeight: 24,
    color: theme.colors.text.placeholder,
    fontWeight: '300',
  },

  inputsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dateInput: {
    marginRight: 16,
    justifyContent: 'center',
  },
  remarkInputContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  label: { fontSize: 12, color: theme.colors.text.placeholder, marginBottom: 4 },
  value: { fontSize: 14, color: theme.colors.text.primary },
  remarkInput: {
    fontSize: 14,
    color: theme.colors.text.primary,
    padding: 0,
    height: 20, // Single line height visually, but logic handles text
  },

  bottomArea: {
    height: 210,
    backgroundColor: theme.colors.background.neutral,
  },
  bottomAreaFocused: {
    display: 'none',
  },

  // Date Picker Styles
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
  arrow: { fontSize: 20, paddingHorizontal: 20 },
  numText: { fontSize: 12, color: theme.colors.text.primary },
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
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
  },
  dayText: { fontSize: 14, color: theme.colors.text.primary },
  selectedDayText: { color: theme.colors.text.inverse },
});

export default BillForm;
