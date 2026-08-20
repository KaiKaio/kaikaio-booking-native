package com.anonymous.kaikaio

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * 注意：本文件是 config plugin 模板源，由 plugins/payment-notification 在 prebuild 时
 * 拷贝进 android/ 目录。修改请改这里，然后重新执行 npm run prebuild:android。
 */
class PaymentNotificationPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(PaymentNotificationModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
