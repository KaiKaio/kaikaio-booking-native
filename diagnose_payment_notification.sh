#!/bin/bash
# ============================================================
# 支付通知自动记账诊断脚本
# 用法: 真机 USB 连接 + ADB 调试开启后执行
#       bash diagnose_payment_notification.sh
# ============================================================

set -e

echo "╔══════════════════════════════════════════╗"
echo "║   支付通知自动记账 - 全链路诊断工具     ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. 检查 ADB 连接 ──────────────────────────────────────
echo ">>> [1/5] 检查 ADB 连接状态..."
DEVICES=$(adb devices 2>/dev/null | grep -v "List" | grep -v "^$" | wc -l)
if [ "$DEVICES" -eq 0 ]; then
  echo "  ✗ 未检测到设备，请确认 USB 已连接且开启了 USB 调试"
  exit 1
fi
echo "  ✓ 设备已连接"
echo ""

# ── 2. 检查通知使用权 ────────────────────────────────────
echo ">>> [2/5] 检查通知使用权 (enabled_notification_listeners)..."
LISTENERS=$(adb shell settings get secure enabled_notification_listeners 2>/dev/null)
echo "  $LISTENERS"
if echo "$LISTENERS" | grep -q "kaikaio"; then
  echo "  ✓ Kaikaio 通知使用权已授权"
else
  echo "  ✗ Kaikaio 通知使用权未授权! (最常见原因)"
  echo "    解决: 设置 → 特殊权限 → 通知使用权 → 开启 Kaikaio"
fi
echo ""

# ── 3. 检查服务进程是否存活 ──────────────────────────────
echo ">>> [3/5] 检查 NotificationListenerService 进程..."
SERVICE_PID=$(adb shell pidof com.anonymous.kaikaio 2>/dev/null || echo "")
if [ -n "$SERVICE_PID" ]; then
  echo "  ✓ 应用进程 PID: $SERVICE_PID"
else
  echo "  ⚠ 应用进程未运行"
fi

# 检查服务具体状态
SERVICE_DUMP=$(adb shell dumpsys notification 2>/dev/null | grep -A5 "com.anonymous.kaikaio" | head -10 || echo "")
if [ -n "$SERVICE_DUMP" ]; then
  echo "  ✓ 通知监听服务在系统注册列表中"
else
  echo "  ✗ 通知监听服务未在系统注册! 服务可能已被系统杀死"
  echo "    解决: 重装 App 或重启设备后重新授权通知使用权"
fi
echo ""

# ── 4. 查看历史 PaymentNotif 日志 ────────────────────────
echo ">>> [4/5] 最近 PaymentNotif 日志 (最近30条)..."
adb logcat -d -s PaymentNotif:* 2>/dev/null | tail -30 || echo "  (无日志输出)"
echo ""

# ── 5. 实时监控 (持续30秒) ────────────────────────────────
echo ">>> [5/5] 实时监控 30 秒 (请现在做一笔支付宝/微信支付)..."
echo "    按 Ctrl+C 可提前退出"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if command -v timeout >/dev/null 2>&1; then
  timeout 30 adb logcat -s PaymentNotif:* ReactNativeJS:* 2>/dev/null || true
else
  # macOS 默认不带 GNU timeout（需 coreutils 的 gtimeout），退化为后台运行 + 定时 kill
  adb logcat -s PaymentNotif:* ReactNativeJS:* 2>/dev/null &
  LOGCAT_PID=$!
  sleep 30
  kill "$LOGCAT_PID" 2>/dev/null || true
  wait "$LOGCAT_PID" 2>/dev/null || true
fi
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo ">>> 诊断完成。请对照上方日志判断问题层级:"
echo ""
echo "  无任何 PaymentNotif 输出 → 服务未运行 (权限未授予/被回收/被ROM杀)"
echo "  有 'listener connected' 但无 'forwarded' → 支付宝/微信未发通知或关键词未命中"
echo "  有 'forwarded' 但无 'event emitted' → RN 模块未就绪"
echo "  有 'event emitted' 但无 [AutoBookkeeping] → JS 监听未注册"
echo "  [AutoBookkeeping] skipped:* → 检查具体 skip 原因"