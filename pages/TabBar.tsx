import React from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import IconFont from '@/components/IconFont';
import { RootStackParamList } from '../types/navigation';

interface TabItem {
  name: string;
  label: string;
  icon: string;
  route: keyof RootStackParamList | 'Statistics';
}

const TabBar = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const currentRouteName = route.name;

  const tabs: TabItem[] = [
    { name: 'List', label: '账单', icon: 'wj-zd', route: 'List' },
    { name: 'Statistics', label: '统计', icon: 'tongji', route: 'Statistics' as any },
    { name: 'Account', label: '我的', icon: 'wode', route: 'Account' },
  ];

  const activeColor = '#1BC47D';
  const inactiveColor = '#000';

  const handlePress = (tab: TabItem) => {
    // 2. 点击行为控制：阻止默认的路由切换行为
    if (currentRouteName === tab.route) {
      return;
    }

    // TODO: Remove this check once Statistics page is implemented
    if (tab.route === 'Statistics') {
      console.warn('Statistics page not implemented');
      return;
    }

    navigation.replace(tab.route as keyof RootStackParamList);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          // 1. 路由高亮功能：将对应路由的 TabBar 项高亮显示
          const isFocused = currentRouteName === tab.route;
          const color = isFocused ? activeColor : inactiveColor;

          return (
            <TouchableOpacity 
              key={tab.name} 
              style={styles.tabItem} 
              onPress={() => handlePress(tab)}
              activeOpacity={0.8}
            >
              <IconFont 
                style={styles.tabIcon} 
                name={tab.icon} 
                size={30} 
                color={color} 
              />
              <Text style={[styles.tabLabel, { color }]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
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
  tabLabel: { fontSize: 12, marginTop: 2 },
});

export default TabBar;