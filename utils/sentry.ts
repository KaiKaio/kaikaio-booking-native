import * as Sentry from '@sentry/react-native';
import * as ImagePicker from 'expo-image-picker';

// ===== Sentry 崩溃监控初始化 =====
//
// 覆盖原生层崩溃、ANR、JS 异常上报与面包屑轨迹，与本地 crashLogger 并存：
// Sentry 负责线上聚合分析，本地日志作为离线兜底（「我的 → Debug Tools → 崩溃日志」）。
// EXPO_PUBLIC_SENTRY_DSN 未配置时跳过初始化，Sentry 调用自动降级为 no-op。

// 导航面包屑集成：需传入 Sentry.init，并在 App 的 NavigationContainer onReady 时绑定
export const sentryNavigationIntegration = Sentry.reactNavigationIntegration();

// 用户反馈集成：「我的 → 意见反馈」唤起官方反馈表单，
// 提交后自动关联当前 scope 的错误事件、面包屑与 tags，出现在 Sentry Feedback 页面
const sentryFeedbackIntegration = Sentry.feedbackIntegration({
  // 关闭 Sentry 品牌露出，保持 App 内视觉统一
  showBranding: false,
  // 姓名走 Sentry.setUser 的用户上下文，不再让用户手填；邮箱保留为可选联系方式
  showName: false,
  isEmailRequired: false,
  useSentryUser: {
    email: 'email',
    name: 'username',
  },
  // 支持从相册添加截图，复用已有的 expo-image-picker；
  // 适配一层规避 expo-image-picker 17 与 SDK 类型定义的 fileName 可空差异
  enableScreenshot: true,
  imagePicker: {
    launchImageLibraryAsync: async (options: unknown) => {
      const result = await ImagePicker.launchImageLibraryAsync(
        options as Parameters<typeof ImagePicker.launchImageLibraryAsync>[0],
      );
      return result as never;
    },
  },
  // 中文文案
  formTitle: '意见反馈',
  nameLabel: '姓名',
  namePlaceholder: '您的称呼',
  emailLabel: '邮箱',
  emailPlaceholder: 'your@email.com（选填，便于回复您）',
  messageLabel: '问题描述',
  messagePlaceholder: '遇到了什么问题，或者有什么建议？',
  cancelButtonLabel: '取消',
  submitButtonLabel: '提交反馈',
  successMessageText: '感谢您的反馈，我们会尽快处理！',
  isRequiredLabel: '必填',
  addScreenshotButtonLabel: '添加截图',
  removeScreenshotButtonLabel: '移除截图',
  errorTitle: '出错了',
  formError: '请填写完整信息',
  emailError: '邮箱格式不正确',
  captureScreenshotError: '截图获取失败，请重试',
  genericError: '提交失败，请稍后重试',
});

// Sentry 是否可用（DSN 已配置），用于控制反馈入口的显隐
export function isSentryEnabled(): boolean {
  return !!process.env.EXPO_PUBLIC_SENTRY_DSN;
}

// 唤起 Sentry 官方反馈表单；需 App 根节点已挂载 FeedbackWidgetProvider
export function showSentryFeedback(): void {
  if (!isSentryEnabled()) return;
  Sentry.showFeedbackWidget();
}

export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    // 性能事务采样率：基线积累期临时调高，线上数据稳定后回落至 0.1~0.2
    tracesSampleRate: 0.5,
    // Profile 采样率（相对 traces）：0.5 × 0.2 = 10% 的事务携带 profile，用于慢事务函数级定位；
    // 额度紧张时优先保 tracesSampleRate，将本项下调至 0
    profilesSampleRate: 0.2,
    // 以下三项默认即为 true，显式声明以固化性能监控能力，避免后续误改关闭：
    // App Start span（TTID/TTFD）自动挂到首个路由事务
    enableAppStartTracking: true,
    // 慢帧/冻帧 measurements 挂到所有根事务
    enableNativeFramesTracking: true,
    // JS 事件循环 stall 检测，stall 时长作为 measurement 上报
    enableStallTracking: true,
    integrations: [sentryNavigationIntegration, sentryFeedbackIntegration],
  });
}
