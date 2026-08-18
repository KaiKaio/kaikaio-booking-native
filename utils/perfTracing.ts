import * as Sentry from '@sentry/react-native';

// ===== 性能埋点工具（P0-2 关键链路自定义埋点） =====
//
// 统一封装 Sentry span，供关键链路调用；Sentry 未初始化（DSN 缺失）时 SDK 自动降级为
// no-op，不产生上报开销。Span 命名约定：op 用小写「领域.动作」，详见 性能优化与监控.md。
//
// 注意：span 只有挂在被采样命中的根事务（如导航路由事务）下才会上报，
// 无根事务的独立 span 会被 SDK 丢弃，不必担心高频调用点（如 fetchBills）撑爆配额。

export type SpanAttributes = Record<string, string | number | boolean>;

// JS bundle 求值起点：本模块经 index.js 依赖链同步 require，作为 JS 侧启动时间基准
export const APP_LAUNCH_TIMESTAMP_MS = Date.now();

/**
 * 包裹一段异步逻辑：span 随 Promise 落定自动结束，返回原结果。
 */
export function traceAsync<T>(op: string, name: string, fn: () => Promise<T>): Promise<T> {
  return Sentry.startSpan({ op, name }, fn);
}

/**
 * 包裹一段同步逻辑：span 随返回值自动结束。
 */
export function traceSync<T>(op: string, name: string, fn: () => T): T {
  return Sentry.startSpan({ op, name }, fn);
}

/**
 * 手动 span：适用于跨多个代码块的长流程，调用方在流程终点自行 `span?.end()`。
 * Sentry 未初始化时返回 undefined，调用侧用可选链即可。
 */
export function startManualSpan(op: string, name: string, attributes?: SpanAttributes) {
  return Sentry.startInactiveSpan({ op, name, attributes });
}

// 首屏完成只上报一次（bundle 加载 → List 首次数据渲染完成），
// span 以启动时刻为起点、立即结束，挂到当前激活的首个路由事务上
let firstScreenReported = false;

export function reportFirstScreen(attributes?: SpanAttributes): void {
  if (firstScreenReported) return;
  firstScreenReported = true;
  const span = Sentry.startInactiveSpan({
    op: 'ui.first-screen',
    name: 'First Screen Ready',
    startTime: APP_LAUNCH_TIMESTAMP_MS / 1000,
    attributes,
  });
  span?.end();
}
