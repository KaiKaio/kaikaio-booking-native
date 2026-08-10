import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import TabBar from './TabBar';
import List from './List';
import Account from './Account';
import Statistics from './Statistics';
import { MainTabParamList } from '../types/navigation';
import { useAutoBookkeeping } from '../hooks/useAutoBookkeeping';
import { navigate } from '../utils/navigationRef';

const Tab = createBottomTabNavigator<MainTabParamList>();

const renderTabBar = (props: BottomTabBarProps) => <TabBar {...props} />;

const Main = () => {
  const { detectedBill, clearDetectedBill } = useAutoBookkeeping();

  useEffect(() => {
    if (!detectedBill) return;

    const categoryLine = detectedBill.category ? `\n分类：${detectedBill.category}` : '';
    Alert.alert(
      '发现新账单',
      `检测到 ${detectedBill.source} ${detectedBill.type === 'income' ? '收入' : '消费'} ${detectedBill.amount} 元\n商户：${detectedBill.merchant || '未知'}${categoryLine}\n是否立即记账？`,
      [
        { text: '忽略', style: 'cancel', onPress: clearDetectedBill },
        {
          text: '记一笔',
          onPress: () => {
            // 导航到 List 页面并带上参数
            navigate('Main', {
              screen: 'List',
              params: {
                autoBill: detectedBill
              }
            });
            clearDetectedBill();
          }
        }
      ]
    );
  }, [detectedBill, clearDetectedBill]);

  return (
    <Tab.Navigator
      tabBar={renderTabBar}
      screenOptions={{ headerShown: false }}
      initialRouteName="List"
    >
      <Tab.Screen name="List" component={List} />
      <Tab.Screen name="Statistics" component={Statistics} />
      <Tab.Screen name="Account" component={Account} />
    </Tab.Navigator>
  );
};

export default Main;
