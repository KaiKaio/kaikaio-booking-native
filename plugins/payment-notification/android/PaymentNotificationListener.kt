package com.anonymous.kaikaio

import android.app.Notification
import android.content.ComponentName
import android.os.Build
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

/**
 * 监听支付宝/微信的支付通知，转发给 RN 层用于自动记账。
 * 需要用户在系统设置中授予「通知使用权」。
 *
 * 注意：本文件是 config plugin 模板源，由 plugins/payment-notification 在 prebuild 时
 * 拷贝进 android/ 目录。修改请改这里，然后重新执行 npm run prebuild:android。
 */
class PaymentNotificationListener : NotificationListenerService() {

  override fun onListenerConnected() {
    super.onListenerConnected()
    Log.i(TAG, "listener connected")
  }

  /**
   * 部分 ROM 在内存回收/权限抖动后会解绑监听服务，这里主动请求重绑，
   * 否则监听会静默失效（表现为「通知有，App 没反应」）。
   */
  override fun onListenerDisconnected() {
    super.onListenerDisconnected()
    Log.w(TAG, "listener disconnected, requesting rebind")
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      try {
        requestRebind(ComponentName(this, PaymentNotificationListener::class.java))
      } catch (e: Exception) {
        Log.w(TAG, "requestRebind failed: ${e.message}")
      }
    }
  }

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    super.onNotificationPosted(sbn)
    if (sbn == null) return

    val source = when (sbn.packageName) {
      PKG_ALIPAY -> "Alipay"
      PKG_WECHAT -> "WeChat"
      else -> return
    }

    val extras: Bundle = sbn.notification?.extras ?: return
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim().orEmpty()
    val body = pickBody(extras)

    val content = listOf(title, body).filter { it.isNotBlank() }.joinToString("\n")
    // 只关注包含支付语义的通知，过滤聊天/推广等噪音（最终是否记账由 JS 侧解析决定）
    if (!PAYMENT_KEYWORDS.any { content.contains(it) }) {
      Log.d(TAG, "notification from $source skipped (no payment keyword): $content")
      return
    }

    Log.i(TAG, "payment notification from $source forwarded: $content")
    PaymentNotificationModule.handlePaymentNotification(
      applicationContext,
      source,
      title,
      body,
      sbn.postTime
    )
  }

  /**
   * 提取通知正文。
   *
   * 支付宝/微信的支付通知正文位置并不固定：单条消息通常在 EXTRA_TEXT，
   * 长文本/换行内容在 EXTRA_BIG_TEXT，多条聚合（如「[2条]微信支付」）只在
   * EXTRA_TEXT_LINES 里，且 EXTRA_TEXT 可能被系统截断成不含金额的摘要。
   * 这里按「含金额优先、其次更完整」的顺序挑选，避免因取错字段而漏记。
   */
  private fun pickBody(extras: Bundle): String {
    val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
    val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
    val subText = extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString()
    val lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)
      ?.mapNotNull { it?.toString() }
      .orEmpty()

    val candidates = buildList {
      if (!text.isNullOrBlank()) add(text)
      if (!bigText.isNullOrBlank()) add(bigText)
      addAll(lines.filter { it.isNotBlank() })
      if (!subText.isNullOrBlank()) add(subText)
    }.map { it.replace(Regex("[\\r\\n]+"), "\n").trim() }
      .filter { it.isNotBlank() }
      .distinct()

    if (candidates.isEmpty()) return ""

    // 1) 优先取带金额的候选；多个时取第一个（EXTRA_TEXT 一般是「最新一条」）
    val withAmount = candidates.filter { AMOUNT_REGEX.containsMatchIn(it) }
    if (withAmount.isNotEmpty()) return withAmount.first()

    // 2) 没有金额时退回最长的候选，交给 JS 解析（可能是无金额的凭证类通知）
    return candidates.maxByOrNull { it.length } ?: ""
  }

  companion object {
    private const val TAG = "PaymentNotif"

    const val PKG_ALIPAY = "com.eg.android.AlipayGphone"
    const val PKG_WECHAT = "com.tencent.mm"

    // 金额形态：￥/¥12.50、12.50元、纯 12.50（含千分位）
    private val AMOUNT_REGEX = Regex("[￥¥]\\s*\\d|\\d+(?:,\\d{3})*(?:\\.\\d{1,2})?\\s*元|\\d+\\.\\d{2}")

    private val PAYMENT_KEYWORDS = listOf(
      "支付", "付款", "收款", "转账", "消费", "到账", "入账", "扣款", "扣费",
      "支出", "退款", "还款", "缴费", "充值", "已付", "已收"
    )
  }
}
