package com.anonymous.kaikaio

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONArray
import org.json.JSONObject

/**
 * 支付通知自动记账原生模块：
 * - 查询/引导授予「通知使用权」
 * - 接收 PaymentNotificationListener 转发的支付通知，实时 emit 给 JS
 * - 同时持久化缓冲事件，JS 挂载/回前台时通过 getPendingEvents 拉取兜底
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
   * 拉取并清空缓冲的支付通知（JS 挂载后 / 每次回前台调用兜底）
   */
  @ReactMethod
  fun getPendingEvents(promise: Promise) {
    val result: WritableArray = Arguments.createArray()
    for (event in PaymentNotificationStore.drain(reactApplicationContext)) {
      result.pushMap(PaymentNotificationStore.toWritableMap(event))
    }
    promise.resolve(result)
  }

  /**
   * JS 已处理完某条通知后回执，把它从持久化缓冲里移除。
   * 否则「前台实时 emit 已处理 + 进程随后被杀」的情况下，下次启动会重复补记同一笔。
   */
  @ReactMethod
  fun ackEvent(source: String, title: String, text: String, time: Double) {
    PaymentNotificationStore.remove(
      reactApplicationContext,
      source,
      title,
      text,
      time.toLong()
    )
  }

  // RN 事件监听需要保持模块存活
  @ReactMethod
  fun addListener(eventName: String) {}

  @ReactMethod
  fun removeListeners(count: Int) {}

  companion object {
    const val EVENT_NAME = "PaymentNotificationDetected"
    private const val TAG = "PaymentNotif"

    @Volatile
    private var instance: PaymentNotificationModule? = null

    /**
     * 由 PaymentNotificationListener 调用：持久化缓冲事件并尝试实时 emit 给 JS。
     *
     * 事件先落 SharedPreferences 再 emit：App 进程被系统回收 / RN 未就绪时，
     * 通知不会因为内存队列丢失，用户下次打开 App 或回前台即可补记。
     * JS 侧按「事件 ID + 短窗口文案」去重，重复送达不会重复弹窗。
     */
    fun handlePaymentNotification(
      context: Context,
      source: String,
      title: String,
      text: String,
      time: Long
    ) {
      val event = PaymentNotificationStore.append(context, source, title, text, time)

      val module = instance ?: run {
        Log.d(TAG, "event persisted only (RN module not mounted)")
        return
      }
      val reactContext = module.reactApplicationContext ?: return
      if (!reactContext.hasActiveReactInstance()) {
        Log.d(TAG, "event persisted only (react instance not active)")
        return
      }
      try {
        reactContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit(EVENT_NAME, PaymentNotificationStore.toWritableMap(event))
        Log.i(TAG, "event emitted to JS: $source")
      } catch (e: Exception) {
        // RN 未就绪时忽略，事件已持久化，等待 getPendingEvents 拉取
        Log.w(TAG, "emit failed, event persisted: ${e.message}")
      }
    }
  }
}

/**
 * 支付通知待处理队列（持久化）。
 *
 * 之所以不用内存队列：通知监听服务与 App 同进程，国产 ROM 在后台极易回收进程，
 * 内存队列会连带丢失，用户表现为「通知明明来了但没记账」。
 * 这里用 SharedPreferences 落盘，进程重启后仍可通过 getPendingEvents 取回。
 */
internal object PaymentNotificationStore {
  private const val PREFS_NAME = "payment_notification_pending"
  private const val KEY_EVENTS = "events"
  private const val MAX_PENDING_EVENTS = 20
  private const val KEY_SOURCE = "source"
  private const val KEY_TITLE = "title"
  private const val KEY_TEXT = "text"
  private const val KEY_TIME = "time"

  private val lock = Any()

  private fun prefs(context: Context): SharedPreferences =
    context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  private fun read(context: Context): JSONArray {
    val raw = prefs(context).getString(KEY_EVENTS, null) ?: return JSONArray()
    return try {
      JSONArray(raw)
    } catch (e: Exception) {
      Log.w("PaymentNotif", "pending events corrupted, reset: ${e.message}")
      JSONArray()
    }
  }

  private fun write(context: Context, array: JSONArray) {
    prefs(context).edit().putString(KEY_EVENTS, array.toString()).apply()
  }

  /** 追加一条事件（超过上限时丢弃最旧的），返回该事件 */
  fun append(
    context: Context,
    source: String,
    title: String,
    text: String,
    time: Long
  ): JSONObject {
    val event = JSONObject().apply {
      put(KEY_SOURCE, source)
      put(KEY_TITLE, title)
      put(KEY_TEXT, text)
      put(KEY_TIME, time)
    }
    synchronized(lock) {
      val list = read(context)
      list.put(event)
      while (list.length() > MAX_PENDING_EVENTS) {
        list.remove(0)
      }
      write(context, list)
    }
    return event
  }

  /** 取出全部待处理事件并清空缓冲 */
  fun drain(context: Context): List<JSONObject> {
    synchronized(lock) {
      val list = read(context)
      write(context, JSONArray())
      return (0 until list.length()).mapNotNull { list.optJSONObject(it) }
    }
  }

  /** 移除一条已由 JS 处理完成的事件（只移除第一条完全匹配的记录） */
  fun remove(context: Context, source: String, title: String, text: String, time: Long) {
    synchronized(lock) {
      val list = read(context)
      val kept = JSONArray()
      var removed = false
      for (i in 0 until list.length()) {
        val item = list.optJSONObject(i) ?: continue
        val isTarget = !removed &&
          item.optString(KEY_SOURCE) == source &&
          item.optString(KEY_TITLE) == title &&
          item.optString(KEY_TEXT) == text &&
          item.optLong(KEY_TIME) == time
        if (isTarget) {
          removed = true
        } else {
          kept.put(item)
        }
      }
      if (removed) write(context, kept)
    }
  }

  fun toWritableMap(event: JSONObject): WritableMap = Arguments.createMap().apply {
    putString(KEY_SOURCE, event.optString(KEY_SOURCE))
    putString(KEY_TITLE, event.optString(KEY_TITLE))
    putString(KEY_TEXT, event.optString(KEY_TEXT))
    putDouble(KEY_TIME, event.optDouble(KEY_TIME, 0.0))
  }
}
