package com.anonymous.kaikaio

import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * 支付通知自动记账原生模块：
 * - 查询/引导授予「通知使用权」
 * - 接收 PaymentNotificationListener 转发的支付通知，实时 emit 给 JS
 * - 同时缓冲事件，JS 挂载后通过 getPendingEvents 拉取兜底（App 在后台时收到的通知）
 *
 * 注意：本文件是 config plugin 模板源，由 plugins/payment-notification 在 prebuild 时
 * 拷贝进 android/ 目录。修改请改这里，然后重新执行 npm run prebuild:android。
 */
class PaymentNotificationModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "PaymentNotificationModule"

  override fun initialize() {
    super.initialize()
    instance = this
  }

  override fun invalidate() {
    instance = null
    super.invalidate()
  }

  @ReactMethod
  fun isPermissionGranted(promise: Promise) {
    val flat = Settings.Secure.getString(
      reactApplicationContext.contentResolver,
      "enabled_notification_listeners"
    )
    val granted = flat != null && flat.split(":").any {
      val cn = ComponentName.unflattenFromString(it)
      cn != null && cn.packageName == reactApplicationContext.packageName
    }
    promise.resolve(granted)
  }

  @ReactMethod
  fun openNotificationSettings() {
    try {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactApplicationContext.startActivity(intent)
    } catch (e: Exception) {
      // 部分定制 ROM 可能没有该设置页，忽略即可
    }
  }

  /**
   * 拉取并清空缓冲的支付通知（JS 挂载后调用兜底）
   */
  @ReactMethod
  fun getPendingEvents(promise: Promise) {
    val result: WritableArray = Arguments.createArray()
    synchronized(pendingEvents) {
      for (event in pendingEvents) {
        result.pushMap(event)
      }
      pendingEvents.clear()
    }
    promise.resolve(result)
  }

  // RN 事件监听需要保持模块存活
  @ReactMethod
  fun addListener(eventName: String) {}

  @ReactMethod
  fun removeListeners(count: Int) {}

  companion object {
    const val EVENT_NAME = "PaymentNotificationDetected"
    private const val MAX_PENDING_EVENTS = 20

    @Volatile
    private var instance: PaymentNotificationModule? = null

    private val pendingEvents = mutableListOf<WritableMap>()

    /**
     * 由 PaymentNotificationListener 调用：缓冲事件并尝试实时 emit 给 JS。
     * JS 侧通过哈希去重，缓冲兜底与实时事件重复送达不会产生重复记账。
     */
    fun handlePaymentNotification(source: String, title: String, text: String, time: Long) {
      val event = Arguments.createMap().apply {
        putString("source", source)
        putString("title", title)
        putString("text", text)
        putDouble("time", time.toDouble())
      }

      synchronized(pendingEvents) {
        pendingEvents.add(event)
        while (pendingEvents.size > MAX_PENDING_EVENTS) {
          pendingEvents.removeAt(0)
        }
      }

      val module = instance ?: return
      val context = module.reactApplicationContext ?: return
      if (!context.hasActiveReactInstance()) return
      try {
        context
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit(EVENT_NAME, event)
      } catch (e: Exception) {
        // RN 未就绪时忽略，事件已缓冲，等待 getPendingEvents 拉取
      }
    }
  }
}
