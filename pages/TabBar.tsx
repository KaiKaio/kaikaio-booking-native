import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import IconFont from '@/components/IconFont'; // 请根据实际路径调整引入
// 导入公共类型定义
import { RootStackParamList } from '../types/navigation';

const TabBar = () => {
  // 指定 useNavigation 的类型
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.replace('List')}>
          <IconFont style={styles.tabIcon} name="wj-zd" size={30} color="#000" />
          <Text style={styles.tabLabel}>账单</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <IconFont style={styles.tabIcon} name="tongji" size={30} color="#000" />
          <Text style={styles.tabLabel}>统计</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => navigation.replace('Account')}>
          <IconFont style={styles.tabIcon} name="wode" size={30} color="#000" />
          <Text style={styles.tabLabel}>我的</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabBar: { 
    flexDirection: 'row', 
    height: 60, 
    borderTopWidth: 1, 
    borderTopColor: '#eee', 
    backgroundColor: '#fff', 
    alignItems: 'center', 
    justifyContent: 'space-around' 
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 12, color: '#222', marginTop: 2 },
});

export default TabBar;