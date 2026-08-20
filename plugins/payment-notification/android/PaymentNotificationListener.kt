package com.anonymous.kaikaio

import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * 监听支付宝/微信的支付通知，转发给 RN 层用于自动记账。
 * 需要用户在系统设置中授予「通知使用权」。
 *
 * 注意：本文件是 config plugin 模板源，由 plugins/payment-notification 在 prebuild 时
 * 拷贝进 android/ 目录。修改请改这里，然后重新执行 npm run prebuild:android。
 */
class PaymentNotificationListener : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    super.onNotificationPosted(sbn)
    if (sbn == null) return

    val source = when (sbn.packageName) {
      PKG_ALIPAY -> "Alipay"
      PKG_WECHAT -> "WeChat"
      else -> return
    }

    val extras: Bundle = sbn.notification?.extras ?: return
    val title = extras.getCharSequence(android.app.Notification.EXTRA_TITLE)?.toString() ?: ""
    val text = extras.getCharSequence(android.app.Notification.EXTRA_TEXT)?.toString()
      ?: extras.getCharSequence(android.app.Notification.EXTRA_BIG_TEXT)?.toString()
      ?: ""

    val content = listOf(title, text).filter { it.isNotBlank() }.joinToString("\n")
    // 只关注包含支付语义的通知，过滤聊天/推广等噪音（最终是否记账由 JS 侧解析决定）
    if (!PAYMENT_KEYWORDS.any { content.contains(it) }) return

    PaymentNotificationModule.handlePaymentNotification(source, title, text, sbn.postTime)
  }

  companion object {
    const val PKG_ALIPAY = "com.eg.android.AlipayGphone"
    const val PKG_WECHAT = "com.tencent.mm"

    private val PAYMENT_KEYWORDS = listOf(
      "支付", "付款", "收款", "转账", "消费", "到账", "入账", "扣款"
    )
  }
}
