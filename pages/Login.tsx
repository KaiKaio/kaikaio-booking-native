import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import request from '../request';
import JSEncrypt from 'jsencrypt';
import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCategory } from '../context/CategoryContext';

import { RootStackParamList } from '../types/navigation';

const LOGIN_URL = 'http://10.242.78.83:4000/api/user/login';
const PUBLIC_KEY_URL = 'http://10.242.78.83:4000/api/user/public_key';
const encrypt = new JSEncrypt();

const Login = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { refreshCategories } = useCategory();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
        await refreshCategories();
        navigation.replace('Main');
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
    // 使用 KeyboardAvoidingView 包裹内容
    <KeyboardAvoidingView
      style={styles.content}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} // 根据平台设置行为
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0} // iOS 导航栏高度
    >
      <Image
        source={require('../assets/login-title-icon.webp')}
        style={styles.logo}
        contentFit="contain"
        transition={1000}
      />
      <TextInput
        style={styles.input}
        placeholder="请输入账号"
        value={account}
        onChangeText={setAccount}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
      />
      <TextInput
        style={styles.input}
        placeholder="请输入密码"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
      />
      <TouchableOpacity
        style={[styles.button, (!isFormValid || loading) && styles.buttonDisabled]}
        onPress={handleLogin}
        activeOpacity={isFormValid && !loading ? 0.7 : 1}
        disabled={!isFormValid || loading}
      >
        <Text style={styles.buttonText}>{loading ? '登录中...' : '登录'}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 60,
  },
  logo: {
    width: 300,
    height: 260,
    marginBottom: 60,
    borderRadius: 12,
  },
  input: {
    width: '80%',
    maxWidth: 400,
    height: 44,
    borderWidth: 1,
    borderColor: '#B0B0B0',
    borderRadius: 6,
    backgroundColor: '#fff',
    marginBottom: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  button: {
    width: '80%',
    maxWidth: 400,
    height: 48,
    borderWidth: 1,
    borderColor: '#3A4A4A',
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 16,
    color: '#3A4A4A',
    letterSpacing: 4,
  },
});

export default Login; 