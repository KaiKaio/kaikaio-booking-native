import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getActiveAccount } from '../utils/storage';
import { loadReminderSettings } from '../services/reminderSettings';

// 前台时也展示通知横幅
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// 供设置页保存后触发重新调度
const resyncListeners = new Set<() => void>();

export function triggerReminderResync(): void {
  resyncListeners.forEach(listener => listener());
}

/**
 * 每晚固定时间的记账提醒（本地通知）。
 * 根据当前账号的提醒设置同步系统通知计划：开启则调度每日重复通知，
 * 关闭则取消全部已调度通知。
 */
export function useReminderScheduler() {
  // 重入锁：挂载 / 回前台 / 手动 resync 多路都可能触发 syncSchedule，
  // 加锁避免并发执行，尤其防止权限请求在途时被再次发起。
  const syncingRef = useRef(false);

  const syncSchedule = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      // 先清空旧计划，再按最新设置重建，避免重复通知
      await Notifications.cancelAllScheduledNotificationsAsync();

      const account = await getActiveAccount();
      if (!account) return;

      const settings = await loadReminderSettings(account);
      if (!settings.enabled) return;

      // 先静默查询权限，仅在「从未决定(undetermined)」时才主动弹窗请求一次。
      // 绝不能每次回前台都无条件 requestPermissionsAsync：权限未授予时会
      // 反复拉起 GrantPermissionsActivity 把 App 挤到后台，形成
      // 「请求→被挤后台→回前台→再请求」的死循环，最终闪退回桌面。
      let permission = await Notifications.getPermissionsAsync();
      if (permission.status === 'undetermined') {
        permission = await Notifications.requestPermissionsAsync();
      }
      if (permission.status !== 'granted') {
        console.warn('Notification permission not granted');
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '记账提醒',
          body: '别忘了记录今天的收支哦～',
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: settings.hour,
          minute: settings.minute,
        },
      });
    } catch (error) {
      console.error('Failed to sync reminder schedule', error);
    } finally {
      syncingRef.current = false;
    }
  }, []);

  useEffect(() => {
    syncSchedule();
    resyncListeners.add(syncSchedule);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') syncSchedule();
    });
    return () => {
      resyncListeners.delete(syncSchedule);
      subscription.remove();
    };
  }, [syncSchedule]);

  return { syncSchedule };
}
