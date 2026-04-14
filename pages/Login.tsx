import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Image } from 'expo-image';
import request from '../request';
import JSEncrypt from 'jsencrypt';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCategory } from '../context/CategoryContext';
import { useUser } from '../context/UserContext';
import {
  ACTIVE_ACCOUNT_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
  USER_CREDENTIALS_STORAGE_KEY,
  clearUserLocalData,
  // getActiveAccount,
  // getUserPendingBills,
  // removeUserPendingBills,
  // clearAllUserPendingBills,
} from '@/utils/storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { theme } from '@/theme';

import { RootStackParamList } from '../types/navigation';

const LOGIN_URL = 'http://10.242.78.83:4000/api/user/login';
const REGISTER_URL = 'http://10.242.78.83:7009/api/user/register';
const PUBLIC_KEY_URL = 'http://10.242.78.83:4000/api/user/public_key';
const encrypt = new JSEncrypt();

const Login = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { refreshCategories, resetCategories } = useCategory();
  const { refreshUserInfo, resetUserInfo } = useUser();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [publicKeyReady, setPublicKeyReady] = useState(false);
  const [_publicKeyLoading, setPublicKeyLoading] = useState(true);

  const isAccountValid = account.trim().length > 0;
  const isPasswordValid = password.length > 0;
  const isConfirmPasswordValid = !isRegister || password === confirmPassword;
  const isFormValid = isAccountValid && isPasswordValid && isConfirmPasswordValid;

  useEffect(() => {
    let mounted = true;

    const fetchPublicKey = async (retryCount = 0) => {
      const maxRetries = 3;
      setPublicKeyLoading(true);
      
      try {
        const data = await request(PUBLIC_KEY_URL, { method: 'GET' });
        if (data?.msg && mounted) {
          encrypt.setPublicKey(data.msg);
          setPublicKeyReady(true);
          setPublicKeyLoading(false);
        } else if (mounted) {
          throw new Error(data?.message || '未获取到公钥');
        }
      } catch (err) {
        if (!mounted) return;
        
        const errorMsg = err instanceof Error ? err.message : '网络错误';
        console.warn(`获取公钥失败 (尝试 ${retryCount + 1}/${maxRetries}):`, errorMsg);
        
        if (retryCount < maxRetries) {
          // 指数退避重试：1s, 2s, 4s
          const delay = Math.pow(2, retryCount) * 1000;
          setTimeout(() => {
            if (mounted) {
              fetchPublicKey(retryCount + 1);
            }
          }, delay);
        } else {
          setPublicKeyReady(false);
          setPublicKeyLoading(false);
          Alert.alert(
            '获取公钥失败',
            '网络连接异常，无法获取加密密钥。您可以稍后重试，或检查网络后重新登录。',
            [
              { 
                text: '重试', 
                onPress: () => fetchPublicKey(0) 
              },
              { 
                text: '取消', 
                style: 'cancel' 
              }
            ]
          );
        }
      }
    };
    
    fetchPublicKey();

    // Load saved credentials
    const loadCredentials = async () => {
      try {
        const credentials = await AsyncStorage.getItem(USER_CREDENTIALS_STORAGE_KEY);
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

    return () => {
      mounted = false;
    };
  }, []);

  // 确保公钥可用的辅助函数
  const ensurePublicKey = async (): Promise<boolean> => {
    if (publicKeyReady) return true;
    
    return new Promise((resolve) => {
      const fetchWithRetry = async (retryCount = 0) => {
        const maxRetries = 3;
        setPublicKeyLoading(true);
        
        try {
          const data = await request(PUBLIC_KEY_URL, { method: 'GET' });
          if (data?.msg) {
            encrypt.setPublicKey(data.msg);
            setPublicKeyReady(true);
            setPublicKeyLoading(false);
            resolve(true);
          } else {
            throw new Error(data?.message || '未获取到公钥');
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : '网络错误';
          console.warn(`获取公钥失败 (尝试 ${retryCount + 1}/${maxRetries}):`, errorMsg);
          
          if (retryCount < maxRetries) {
            const delay = Math.pow(2, retryCount) * 1000;
            setTimeout(() => fetchWithRetry(retryCount + 1), delay);
          } else {
            setPublicKeyLoading(false);
            Alert.alert('获取公钥失败', errorMsg);
            resolve(false);
          }
        }
      };
      
      fetchWithRetry(0);
    });
  };

  const handleLogin = async () => {
    if (!isFormValid) {
      console.log('Form is not valid')
      return;
    }
    
    // 如果公钥未就绪，先获取公钥
    if (!publicKeyReady) {
      setLoading(true);
      const success = await ensurePublicKey();
      setLoading(false);
      
      if (!success) {
        return; // 公钥获取失败，终止登录流程
      }
      
      // 公钥获取成功，继续登录
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
        const previousAccount = await AsyncStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY);
        const oldToken = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
        const isSwitchingAccount = previousAccount && previousAccount !== account;
        const isFirstLogin = !previousAccount && !!oldToken;
        const shouldClearOldData = isSwitchingAccount || isFirstLogin;

        if (shouldClearOldData) {
          // 如果是切换账号,保留旧用户的离线账单(不删除也不加载)
          // 旧用户的离线数据会在其重新登录时自动恢复
          if (isSwitchingAccount) {
            console.log(`检测到切换账号: ${previousAccount} -> ${account}`);
            console.log('旧用户的离线数据已保留,等待其重新登录时自动恢复');
            
            // 只清除认证相关数据,不清除离线账单
            const keysToRemove = [
              TOKEN_STORAGE_KEY,
              USER_CREDENTIALS_STORAGE_KEY,
              ACTIVE_ACCOUNT_STORAGE_KEY,
            ];
            await AsyncStorage.multiRemove(keysToRemove);
          } else {
            // 首次登录或有旧 token,清除所有数据
            await clearUserLocalData();
          }
          
          resetUserInfo();
          resetCategories();
        }

        await AsyncStorage.setItem(TOKEN_STORAGE_KEY, data.token);
        await AsyncStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, account);

        // Handle Remember Password
        if (rememberPassword) {
          await AsyncStorage.setItem(USER_CREDENTIALS_STORAGE_KEY, JSON.stringify({ account, password }));
        } else {
          await AsyncStorage.removeItem(USER_CREDENTIALS_STORAGE_KEY);
        }

        await refreshCategories();
        await refreshUserInfo();
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

  const handleRegister = async () => {
    if (!isFormValid) {
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('注册', '两次密码输入不一致');
      return;
    }
    
    // 如果公钥未就绪，先获取公钥
    if (!publicKeyReady) {
      setLoading(true);
      const success = await ensurePublicKey();
      setLoading(false);
      
      if (!success) {
        return; // 公钥获取失败，终止注册流程
      }
      
      // 公钥获取成功，继续注册
    }
    
    setLoading(true);
    try {
      const res: { data: { user_id: string; msg: string } } = await request(REGISTER_URL, {
        method: 'POST',
        body: JSON.stringify({
          username: account,
          password: encrypt.encrypt(password),
        }),
      });
      if (res?.data?.user_id) {
        Alert.alert('注册成功');
        handleLogin();
      } else {
        Alert.alert('注册', res?.data?.msg || '注册失败');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '网络错误';
      Alert.alert('注册', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (isRegister) {
      handleRegister();
    } else {
      handleLogin();
    }
  };

  const handleToggleMode = () => {
    setIsRegister(!isRegister);
    setConfirmPassword('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.content}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <Image
        source={require('../assets/login-title-icon.png')}
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
        <View style={[
          styles.passwordInputContainer,
          focusedInput === 'password' && styles.passwordInputContainerFocused
        ]}>
          <TextInput
            style={styles.inputWithIcon}
            placeholder="请输入密码"
            placeholderTextColor={theme.colors.text.placeholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            editable={!loading}
            onFocus={() => setFocusedInput('password')}
            onBlur={() => setFocusedInput(null)}
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setShowPassword(!showPassword)}
            disabled={!password}
          >
            <Icon
              name={showPassword ? 'visibility' : 'visibility-off'}
              size={24}
              color={password ? theme.colors.text.secondary : theme.colors.text.disabled}
            />
          </TouchableOpacity>
        </View>

        {isRegister && (
          <>
            <Text style={styles.label}>确认密码</Text>
            <View style={[
              styles.passwordInputContainer,
              focusedInput === 'confirmPassword' && styles.passwordInputContainerFocused
            ]}>
              <TextInput
                style={styles.inputWithIcon}
                placeholder="请再次输入密码"
                placeholderTextColor={theme.colors.text.placeholder}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                editable={!loading}
                onFocus={() => setFocusedInput('confirmPassword')}
                onBlur={() => setFocusedInput(null)}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={!confirmPassword}
              >
                <Icon
                  name={showConfirmPassword ? 'visibility' : 'visibility-off'}
                  size={24}
                  color={confirmPassword ? theme.colors.text.secondary : theme.colors.text.disabled}
                />
              </TouchableOpacity>
            </View>
          </>
        )}
      
        {!isRegister && (
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
        )}
      
        <TouchableOpacity
          style={[styles.button, (!isFormValid || loading) && styles.buttonDisabled]}
          onPress={handleSubmit}
          activeOpacity={isFormValid && !loading ? 0.7 : 1}
          disabled={!isFormValid || loading}
        >
          <Text style={styles.buttonText}>
            {loading 
              ? (isRegister ? '注册中...' : '登录中...') 
              : (isRegister ? '注册' : '登录')}
          </Text>
        </TouchableOpacity>
      
        <TouchableOpacity
          style={styles.switchButton}
          onPress={handleToggleMode}
          activeOpacity={0.7}
        >
          <Text style={styles.switchButtonText}>
            {isRegister ? '已有账号？返回登录' : '没有账号？立即注册'}
          </Text>
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
  passwordInputContainer: {
    width: '100%',
    height: 50,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: theme.colors.background.neutral,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  inputWithIcon: {
    flex: 1,
    height: 50,
    paddingHorizontal: 4,
    fontSize: 16,
    color: theme.colors.text.primary,
    borderWidth: 0,
  },
  eyeIcon: {
    padding: 8,
    marginLeft: 4,
  },
  inputFocused: {
    borderColor: theme.colors.primary, // Highlight color
    backgroundColor: theme.colors.background.paper,
  },
  passwordInputContainerFocused: {
    borderColor: theme.colors.primary,
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
  switchButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchButtonText: {
    fontSize: 15,
    color: theme.colors.primary,
    fontWeight: '500',
  },
});

export default Login;
