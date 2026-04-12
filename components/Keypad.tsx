import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '@/theme';
import IconFont from '../components/IconFont';

interface KeypadProps {
  amountStr: string;
  onChange: (value: string | ((prev: string) => string)) => void;
}

const Keypad: React.FC<KeypadProps> = ({ amountStr, onChange }) => {
  const [pendingValue, setPendingValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [displayValue, setDisplayValue] = useState<string>('0');
  const [isNewInput, setIsNewInput] = useState<boolean>(false);

  const pendingValueRef = useRef(pendingValue);
  const operatorRef = useRef(operator);
  const isNewInputRef = useRef(isNewInput);

  useEffect(() => {
    pendingValueRef.current = pendingValue;
  }, [pendingValue]);

  useEffect(() => {
    operatorRef.current = operator;
  }, [operator]);

  useEffect(() => {
    isNewInputRef.current = isNewInput;
  }, [isNewInput]);

  // 同步外部 amountStr 变化
  useEffect(() => {
    setDisplayValue(amountStr);
    setIsNewInput(false);
  }, [amountStr]);

  const updateDisplay = (value: string | ((prev: string) => string)) => {
    const newValue = typeof value === 'function' ? value(displayValue) : value;
    setDisplayValue(newValue);
    onChange(newValue);
  };

  const handlePressKey = (key: string) => {
    if (key === 'delete') {
      updateDisplay((prev: string) => {
        if (prev.length <= 1) return '0';
        return prev.slice(0, -1);
      });
      return;
    }

    if (key === '.') {
      if (displayValue.includes('.')) return;
      updateDisplay((prev: string) => prev + '.');
      return;
    }

    // Handle operators: +, -, =
    if (key === '+' || key === '-' || key === '=') {
      const currentValue = parseFloat(displayValue);

      if (key === '=') {
        // Calculate result if there's a pending operation
        if (pendingValueRef.current !== null && operatorRef.current) {
          let result = 0;
          if (operatorRef.current === '+') {
            result = pendingValueRef.current + currentValue;
          } else if (operatorRef.current === '-') {
            result = pendingValueRef.current - currentValue;
          }
          // Round to 2 decimal places
          result = Math.round(result * 100) / 100;
          updateDisplay(result.toString());
          setPendingValue(null);
          setOperator(null);
          setIsNewInput(false);
        }
        return;
      }

      // For + or -, store current value and operator
      if (pendingValueRef.current !== null && operatorRef.current) {
        // If there's already a pending operation, calculate it first
        let result = 0;
        if (operatorRef.current === '+') {
          result = pendingValueRef.current + currentValue;
        } else if (operatorRef.current === '-') {
          result = pendingValueRef.current - currentValue;
        }
        // Round to 2 decimal places
        result = Math.round(result * 100) / 100;
        updateDisplay(result.toString());
        setPendingValue(result);
      } else {
        setPendingValue(currentValue);
      }
      setOperator(key);
      setIsNewInput(true);
      return;
    }

    // Number
    if (isNewInputRef.current) {
      // 如果刚按过运算符，重新开始输入
      updateDisplay(key);
      setIsNewInput(false);
    } else {
      updateDisplay((prev: string) => {
        if (prev === '0') return key;
        // Limit decimal places to 2
        if (prev.includes('.')) {
          const [, decimal] = prev.split('.');
          if (decimal && decimal.length >= 2) return prev;
        }
        return prev + key;
      });
    }
  };

  const keys = [
    ['1', '2', '3', '+'],
    ['4', '5', '6', '-'],
    ['7', '8', '9', '='],
    ['.', '0', 'delete', '']
  ];

  return (
    <View style={styles.keypad}>
      {keys.flat().map((key, index) => {
        if (key === '') {
          return <View key={`empty-${index}`} style={styles.key} />;
        }

        const isOperator = key === '+' || key === '-' || key === '=';
        return (
          <TouchableOpacity
            key={key + index}
            style={[styles.key, isOperator && styles.operatorKey]}
            onPress={() => handlePressKey(key)}
          >
            <Text style={[styles.keyText, isOperator && styles.operatorKeyText]}>
              {key === 'delete' ? <IconFont name="Backspace" size={30} color="#000" /> : key}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  keypad: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  key: {
    width: '25%',
    height: '25%', // 4 rows
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background.paper,
  },
  operatorKey: {
    backgroundColor: theme.colors.background.neutral,
  },
  keyText: { fontSize: 24, color: theme.colors.text.primary },
  operatorKeyText: {
    color: theme.colors.primary,
    fontWeight: 'bold',
    fontSize: 28
  },
});

export default Keypad;
