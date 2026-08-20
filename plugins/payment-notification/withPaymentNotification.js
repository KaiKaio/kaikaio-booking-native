/**
 * 支付通知自动记账 config plugin
 *
 * 项目使用 `expo prebuild --clean` 重新生成 android/ 目录，手动添加的原生文件会被清除。
 * 本插件在每次 prebuild 时：
 *   1. 将模板 .kt 文件拷贝到应用包目录（withDangerousMod）
 *   2. 向 MainApplication.kt 注入 PaymentNotificationPackage 注册（withMainApplication）
 *   3. 向 AndroidManifest.xml 注入监听 Service 声明（withAndroidManifest）
 *
 * 模板源文件位于 plugins/payment-notification/android/，修改原生逻辑请改模板并重新 prebuild。
 */
const {
  withDangerousMod,
  withMainApplication,
  withAndroidManifest,
  AndroidConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const KT_FILES = [
  'PaymentNotificationListener.kt',
  'PaymentNotificationModule.kt',
  'PaymentNotificationPackage.kt',
];

const SERVICE_NAME = '.PaymentNotificationListener';

function withPaymentNotificationFiles(config) {
  return withDangerousMod(config, [
    'android',
    async cfg => {
      const androidPackage = cfg.android.package;
      const targetDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        ...androidPackage.split('.')
      );
      fs.mkdirSync(targetDir, { recursive: true });

      for (const file of KT_FILES) {
        const source = fs.readFileSync(path.join(__dirname, 'android', file), 'utf8');
        // 同步 package 声明与应用包名
        const rewritten = source.replace(/^package .+$/m, `package ${androidPackage}`);
        fs.writeFileSync(path.join(targetDir, file), rewritten);
      }
      return cfg;
    },
  ]);
}

function withPaymentNotificationPackage(config) {
  return withMainApplication(config, cfg => {
    const anchor = 'PackageList(this).packages.apply {';
    const injection = '\n              add(PaymentNotificationPackage())';
    if (
      cfg.modResults.contents.includes(anchor) &&
      !cfg.modResults.contents.includes('PaymentNotificationPackage()')
    ) {
      cfg.modResults.contents = cfg.modResults.contents.replace(anchor, anchor + injection);
    }
    return cfg;
  });
}

function withPaymentNotificationService(config) {
  return withAndroidManifest(config, cfg => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    mainApplication.service = mainApplication.service || [];
    const exists = mainApplication.service.some(
      service => service.$?.['android:name'] === SERVICE_NAME
    );
    if (!exists) {
      mainApplication.service.push({
        $: {
          'android:name': SERVICE_NAME,
          'android:label': '@string/app_name',
          'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
          'android:exported': 'false',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.service.notification.NotificationListenerService',
                },
              },
            ],
          },
        ],
      });
    }
    return cfg;
  });
}

module.exports = function withPaymentNotification(config) {
  config = withPaymentNotificationFiles(config);
  config = withPaymentNotificationPackage(config);
  config = withPaymentNotificationService(config);
  return config;
};
