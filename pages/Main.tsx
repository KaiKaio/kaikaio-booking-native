import React, { useEffect } from 'react';
import { Alert, Platform, ToastAndroid } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import TabBar from './TabBar';
import List from './List';
import Account from './Account';
import Statistics from './Statistics';
import { MainTabParamList } from '../types/navigation';
import { useAutoBookkeeping } from '../hooks/useAutoBookkeeping';
import { useRecurringBillRunner } from '../hooks/useRecurringBillRunner';
import { useMissedRecordReminder } from '../hooks/useMissedRecordReminder';
import { useConfigSync } from '../hooks/useConfigSync';
import { CYCLE_LABELS } from '../services/recurringBills';
import { navigate } from '../utils/navigationRef';

const Tab = createBottomTabNavigator<MainTabParamList>();

const renderTabBar = (props: BottomTabBarProps) => <TabBar {...props} />;

const showToast = (message: string) => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert('提示', message);
  }
};

const Main = () => {
  // P3 本地配置云端同步：周期账单/模板/提醒设置（启动/回前台/变更时同步）
  useConfigSync();
  const { detectedBill, clearDetectedBill } = useAutoBookkeeping();
  const {
    pendingConfirms,
    confirmAll,
    skipAll,
    silentToast,
    clearSilentToast,
  } = useRecurringBillRunner();
  const { missedHintVisible, dismissMissedHint } = useMissedRecordReminder();

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

  // 周期账单（确认模式）：到期账单询问用户是否记账
  useEffect(() => {
    if (pendingConfirms.length === 0) return;

    const lines = pendingConfirms
      .slice(0, 5)
      .map(item => `· ${item.bill.name} ¥${item.bill.amount.toFixed(2)}（${CYCLE_LABELS[item.bill.cycle]}，账期 ${item.dueDate}）`);
    const moreLine = pendingConfirms.length > 5 ? `\n等共 ${pendingConfirms.length} 笔` : '';

    Alert.alert(
      '周期账单到期',
      `以下周期账单已到期，是否记账？\n${lines.join('\n')}${moreLine}`,
      [
        { text: '本次跳过', style: 'cancel', onPress: skipAll },
        {
          text: '确认记账',
          onPress: async () => {
            await confirmAll();
            showToast('周期账单已记账');
          },
        },
      ]
    );
  }, [pendingConfirms, confirmAll, skipAll]);

  // 周期账单（静默模式）：自动生成后的轻提示
  useEffect(() => {
    if (!silentToast) return;
    showToast(silentToast);
    const timer = setTimeout(clearSilentToast, 4000);
    return () => clearTimeout(timer);
  }, [silentToast, clearSilentToast]);

  // 漏记轻提示：当天零记录且有记账习惯
  useEffect(() => {
    if (!missedHintVisible) return;

    Alert.alert(
      '今天还没记账',
      '今天还没有账单记录，要不要补一笔？',
      [
        { text: '不用了', style: 'cancel', onPress: dismissMissedHint },
        {
          text: '记一笔',
          onPress: () => {
            dismissMissedHint();
            navigate('Main', {
              screen: 'List',
              params: { openForm: true },
            });
          },
        },
      ]
    );
  }, [missedHintVisible, dismissMissedHint]);

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
