import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import TabBar from './TabBar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';

const Account = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleLogout = async () => {
    try {
      // 清除 Storage 中的 token
      await AsyncStorage.removeItem('token');
      // 清除所有路由栈并跳转至登录页
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('清除 token 失败', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text>Account</Text>
      <Button title="退出登录" onPress={handleLogout} />
      <TabBar />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Account;