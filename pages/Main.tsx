import React from 'react';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import TabBar from './TabBar';
import List from './List';
import Account from './Account';
import Statistics from './Statistics';
import { MainTabParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<MainTabParamList>();

const renderTabBar = (props: BottomTabBarProps) => <TabBar {...props} />;

const Main = () => {
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
