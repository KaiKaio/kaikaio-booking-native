import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigate(name: keyof RootStackParamList, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name as any, params);
  }
}

/**
 * 重置导航栈到登录页（仅保留 Login 一个页面）。
 * 401 退出登录时必须用 reset 而非 navigate：navigate 会把 Login 压在已挂载的
 * Main 之上，旧 Main 不会卸载（其监听器/同步逻辑继续运行），反复 401→重登
 * 会不断叠加页面实例，最终造成请求风暴与内存溢出。
 */
export function resetToLogin() {
  if (navigationRef.isReady()) {
    navigationRef.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  }
}
