import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Image } from 'expo-image';
import request from '../request';
import JSEncrypt from 'jsencrypt';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCategory } from '../context/CategoryContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { theme } from '@/theme';

import { RootStackParamList } from '../types/navigation';

const LOGIN_URL = 'http://10.242.78.83:4000/api/user/login';
const PUBLIC_KEY_URL = 'http://10.242.78.83:4000/api/user/public_key';
const encrypt = new JSEncrypt();

const Login = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { refreshCategories } = useCategory();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [rememberPassword, setRememberPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const isAccountValid = account.trim().length > 0;
  const isPasswordValid = password.length > 0;
  const isFormValid = isAccountValid && isPasswordValid;

  useEffect(() => {
    const fetchPublicKey = async () => {
      try {
        const data = await request(PUBLIC_KEY_URL, { method: 'GET' });
        if (data?.msg) {
          encrypt.setPublicKey(data.msg);
        } else {
          Alert.alert('获取公钥失败', data?.message || '未获取到公钥');
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '网络错误';
        Alert.alert('获取公钥失败', errorMsg);
      }
    };
    fetchPublicKey();

    // Load saved credentials
    const loadCredentials = async () => {
      try {
        const credentials = await AsyncStorage.getItem('user_credentials');
        if (credentials) {
          const { account: savedAccount, password: savedPassword } = JSON.parse(credentials);
          setAccount(savedAccount);
          setPassword(savedPassword);
          setRememberPassword(true);
        }
      } catch (error) {
        console.error('Failed to load credentials', error);
      }
    };
    loadCredentials();
  }, []);

  const handleLogin = async () => {
    if (!isFormValid) {
      return;
    }
    setLoading(true);
    try {
      const data = await request(LOGIN_URL, {
        method: 'POST',
        body: JSON.stringify({
          userName: account,
          password: encrypt.encrypt(password),
        }),
      });
      if (data.token) {
        await AsyncStorage.setItem('token', data.token); // 存储 token
        
        // Handle Remember Password
        if (rememberPassword) {
            await AsyncStorage.setItem('user_credentials', JSON.stringify({ account, password }));
        } else {
            await AsyncStorage.removeItem('user_credentials');
        }

        await refreshCategories();
        navigation.replace('Main', { screen: 'List' });
      } else {
        Alert.alert('登录', data.message || '未获取到Token');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '网络错误';
      Alert.alert('登录', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.content}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <Image
        source={require('../assets/login-title-icon.webp')}
        style={styles.logo}
        contentFit="contain"
        transition={1000}
      />
      
      <View style={styles.formContainer}>
        <Text style={styles.label}>账号</Text>
        <TextInput
          style={[
            styles.input, 
            focusedInput === 'account' && styles.inputFocused
          ]}
          placeholder="请输入账号"
          placeholderTextColor={theme.colors.text.placeholder}
          value={account}
          onChangeText={setAccount}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
          onFocus={() => setFocusedInput('account')}
          onBlur={() => setFocusedInput(null)}
        />

        <Text style={styles.label}>密码</Text>
        <TextInput
          style={[
            styles.input,
            focusedInput === 'password' && styles.inputFocused
          ]}
          placeholder="请输入密码"
          placeholderTextColor={theme.colors.text.placeholder}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
          onFocus={() => setFocusedInput('password')}
          onBlur={() => setFocusedInput(null)}
        />

        <TouchableOpacity 
          style={styles.checkboxContainer} 
          onPress={() => setRememberPassword(!rememberPassword)}
          activeOpacity={0.7}
        >
            <Icon 
              name={rememberPassword ? 'check-box' : 'check-box-outline-blank'} 
              size={24} 
              color={theme.colors.primary} 
            />
            <Text style={styles.checkboxLabel}>记住密码</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, (!isFormValid || loading) && styles.buttonDisabled]}
          onPress={handleLogin}
          activeOpacity={isFormValid && !loading ? 0.7 : 1}
          disabled={!isFormValid || loading}
        >
          <Text style={styles.buttonText}>{loading ? '登录中...' : '登录'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center', // Changed to center for better vertical alignment
    backgroundColor: theme.colors.background.default, // Added light background color
    paddingHorizontal: 20,
  },
  logo: {
    width: 280, // Slightly smaller
    height: 240,
    marginBottom: 40,
    borderRadius: 12,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: theme.colors.background.paper,
    borderRadius: 16,
    padding: 24,
    shadowColor: theme.colors.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: theme.colors.background.neutral,
    marginBottom: 20,
    paddingHorizontal: 16,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  inputFocused: {
    borderColor: theme.colors.primary, // Highlight color
    backgroundColor: theme.colors.background.paper,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    marginLeft: 4,
  },
  checkboxLabel: {
    marginLeft: 8,
    fontSize: 15,
    color: theme.colors.text.secondary,
  },
  button: {
    width: '100%',
    height: 54,
    borderRadius: 8,
    backgroundColor: theme.colors.primary, // Solid primary color
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
    backgroundColor: theme.colors.text.disabled,
    shadowOpacity: 0,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.inverse,
    letterSpacing: 1,
  },
});

export default Login;
