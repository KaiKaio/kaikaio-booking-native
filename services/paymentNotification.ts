import { NativeEventEmitter, NativeModules, Platform, EmitterSubscription } from 'react-native';

/**
 * Android 支付通知监听原生模块封装。
 * 仅 Android 可用；iOS 上所有方法退化为不可用/空实现。
 */

export interface PaymentNotificationEvent {
  source: 'Alipay' | 'WeChat';
  title: string;
  text: string;
  time: number;
}

const { PaymentNotificationModule } = NativeModules;

export const isPaymentNotificationAvailable =
  Platform.OS === 'android' && !!PaymentNotificationModule;

const emitter = isPaymentNotificationAvailable
  ? new NativeEventEmitter(PaymentNotificationModule)
  : null;

/**
 * 是否已授予「通知使用权」
 */
export async function isNotificationListenerGranted(): Promise<boolean> {
  if (!isPaymentNotificationAvailable) return false;
  try {
    return await PaymentNotificationModule.isPermissionGranted();
  } catch (e) {
    console.error('Failed to check notification listener permission', e);
    return false;
  }
}

/**
 * 跳转系统「通知使用权」设置页
 */
export function openNotificationListenerSettings(): void {
  if (!isPaymentNotificationAvailable) return;
  PaymentNotificationModule.openNotificationSettings();
}

/**
 * 拉取 RN 挂载前缓冲的支付通知（App 在后台期间收到的）
 */
export async function getPendingPaymentNotifications(): Promise<PaymentNotificationEvent[]> {
  if (!isPaymentNotificationAvailable) return [];
  try {
    return await PaymentNotificationModule.getPendingEvents();
  } catch (e) {
    console.error('Failed to get pending payment notifications', e);
    return [];
  }
}

/**
 * 订阅实时支付通知事件
 */
export function addPaymentNotificationListener(
  callback: (event: PaymentNotificationEvent) => void
): EmitterSubscription | null {
  if (!emitter) return null;
  return emitter.addListener('PaymentNotificationDetected', callback);
}
