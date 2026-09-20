import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform, ToastAndroid } from 'react-native';
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
import ConfirmDialog, { ConfirmDialogConfig } from '../components/ConfirmDialog';

const Tab = createBottomTabNavigator<MainTabParamList>();

const renderTabBar = (props: BottomTabBarProps) => <TabBar {...props} />;

// 后台连续收到多笔支付通知时，最多排队展示的弹窗数量
const MAX_PENDING_BILL_DIALOGS = 10;

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
  const { detectedBill, clearDetectedBill, notificationPermissionWarning, dismissNotificationPermissionWarning } = useAutoBookkeeping();
  const {
    pendingConfirms,
    confirmAll,
    skipAll,
    silentToast,
    clearSilentToast,
  } = useRecurringBillRunner();
  const { missedHintVisible, dismissMissedHint } = useMissedRecordReminder();

  // 自动记账弹窗：支付通知常在 App 后台时到达，Android 在后台不显示对话框，
  // 故这里用 Modal 自绘（不依赖原生 Alert），并做「回前台才弹窗」的门控。
  // 后台可能连续到达多笔通知，用队列逐笔展示，避免后一笔把前一笔覆盖掉导致漏记。
  const [billDialog, setBillDialog] = useState<ConfirmDialogConfig | null>(null);
  const pendingBillDialogsRef = useRef<ConfirmDialogConfig[]>([]);
  const billDialogOpenRef = useRef(false);
  const isAppActiveRef = useRef(AppState.currentState === 'active');

  const flushBillDialogQueue = useCallback(() => {
    if (!isAppActiveRef.current) return;
    if (billDialogOpenRef.current) return;
    const next = pendingBillDialogsRef.current.shift();
    if (!next) return;
    billDialogOpenRef.current = true;
    setBillDialog(next);
  }, []);

  const closeBillDialog = useCallback(() => {
    billDialogOpenRef.current = false;
    setBillDialog(null);
    // 关闭当前弹窗后立即展示队列中的下一笔
    flushBillDialogQueue();
  }, [flushBillDialogQueue]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      isAppActiveRef.current = state === 'active';
      // 回到前台时，补弹在后台期间检测到的账单
      if (state === 'active') flushBillDialogQueue();
    });
    return () => sub.remove();
  }, [flushBillDialogQueue]);

  // 通知使用权丢失告警：每天轻提示一次（授权被系统回收后开关会一直显示为开启）
  useEffect(() => {
    if (!notificationPermissionWarning) return;
    showToast('通知使用权已失效，支付通知自动记账暂不可用。请到系统设置 → 通知使用权中重新开启 Kaikaio。');
    dismissNotificationPermissionWarning();
  }, [notificationPermissionWarning, dismissNotificationPermissionWarning]);

  useEffect(() => {
    if (!detectedBill) return;

    const categoryLine = detectedBill.category ? `\n分类：${detectedBill.category}` : '';
    const config: ConfirmDialogConfig = {
      title: '发现新账单',
      message: `检测到 ${detectedBill.source} ${detectedBill.type === 'income' ? '收入' : '消费'} ${detectedBill.amount} 元\n商户：${detectedBill.merchant || '未知'}${categoryLine}\n是否立即记账？`,
      cancelText: '忽略',
      confirmText: '记一笔',
      onCancel: () => {
        closeBillDialog();
        clearDetectedBill();
      },
      onConfirm: () => {
        console.log('[Main] 记一笔 clicked, navigate to List, autoBill =', detectedBill.amount);
        closeBillDialog();
        // 序列化后导航，避免把 Date 等不可序列化对象塞进导航参数（会触发 non-serializable 警告）
        const autoBill = {
          ...detectedBill,
          date: detectedBill.date ? detectedBill.date.toISOString() : undefined,
        };
        navigate('Main', {
          screen: 'List',
          params: { autoBill }
        });
        clearDetectedBill();
      }
    };

    // 入队后由 flushBillDialogQueue 决定：前台立即弹窗，后台等回前台再弹
    pendingBillDialogsRef.current.push(config);
    if (pendingBillDialogsRef.current.length > MAX_PENDING_BILL_DIALOGS) {
      pendingBillDialogsRef.current.splice(
        0,
        pendingBillDialogsRef.current.length - MAX_PENDING_BILL_DIALOGS
      );
    }
    flushBillDialogQueue();
  }, [detectedBill, clearDetectedBill, closeBillDialog, flushBillDialogQueue]);

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
    <>
      <Tab.Navigator
        tabBar={renderTabBar}
        screenOptions={{ headerShown: false }}
        initialRouteName="List"
      >
        <Tab.Screen name="List" component={List} />
        <Tab.Screen name="Statistics" component={Statistics} />
        <Tab.Screen name="Account" component={Account} />
      </Tab.Navigator>
      {billDialog && (
        <ConfirmDialog
          visible
          {...billDialog}
          onRequestClose={closeBillDialog}
        />
      )}
    </>
  );
};

export default Main;
