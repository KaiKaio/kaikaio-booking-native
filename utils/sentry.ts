import * as Sentry from '@sentry/react-native';

// ===== Sentry 崩溃监控初始化 =====
//
// 覆盖原生层崩溃、ANR、JS 异常上报与面包屑轨迹，与本地 crashLogger 并存：
// Sentry 负责线上聚合分析，本地日志作为离线兜底（「我的 → Debug Tools → 崩溃日志」）。
// EXPO_PUBLIC_SENTRY_DSN 未配置时跳过初始化，Sentry 调用自动降级为 no-op。

// 导航面包屑集成：需传入 Sentry.init，并在 App 的 NavigationContainer onReady 时绑定
export const sentryNavigationIntegration = Sentry.reactNavigationIntegration();

export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    // 性能事务采样率：当前体量先保守采样，额度紧张可继续调低
    tracesSampleRate: 0.2,
    integrations: [sentryNavigationIntegration],
  });
}
