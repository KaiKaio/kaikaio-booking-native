# 支付通知自动记账（Android）设计说明

> 本文档描述「支付宝/微信支付通知 → 自动识别 → 一键记账」功能的完整实现，供后续迭代优化与问题排查参考。

## 1. 背景与目标

iOS/Android 沙盒不允许 App 直接感知其他 App 的支付行为，也没有官方支付回调 API。本功能选择 **Android 通知监听（NotificationListenerService）** 方案：支付宝/微信每笔收支都会发系统通知，读取通知文本并解析即可在用户授权后实现"准全自动"记账。

设计目标：
- 用户授权后，每笔支付宝/微信支出回前台即弹窗提示记账，一键确认
- 不重复记账、不重复弹窗（防抖 + 哈希去重）
- App 在后台/未启动 RN 时收到的通知不丢失（原生层缓冲兜底）
- 与现有剪贴板自动记账链路完全解耦又复用同一套解析/去重基础设施
- iOS 无感（该能力 Android 独有，iOS 上 UI 与逻辑自动退化）

## 2. 整体架构

```
支付宝/微信 发出支付通知
        │
        ▼
PaymentNotificationListener (NotificationListenerService)
  · 过滤包名：com.eg.android.AlipayGphone / com.tencent.mm
  · 过滤支付语义关键词，剔除聊天/推广噪音
        │
        ▼
PaymentNotificationModule (ReactContextBaseJavaModule)
  · 缓冲事件（上限 20 条，防 RN 未就绪丢单）
  · RN 就绪时实时 emit「PaymentNotificationDetected」
        │                                    ▲
        │  事件流（实时）                      │ getPendingEvents（后台期间通知，挂载后拉取）
        ▼                                    │
services/paymentNotification.ts（JS 封装，iOS 退化为不可用）
        │
        ▼
hooks/useAutoBookkeeping.ts
  · 开关检查（auto_bill_notification_enabled:{account}）
  · 拼接来源前缀：【支付宝】/【微信】
  · 60s 防抖 + clipboard_seen_hashes 哈希去重（与剪贴板共用）
  · billParser.parse() → NotificationStrategy
        │
        ▼
Main.tsx 弹窗「发现新账单」→ navigate List 携带 autoBill → BillForm 预填
```

## 3. 文件清单

> ⚠️ **重要：原生源文件在 `plugins/payment-notification/android/` 下，不在 `android/` 目录里。**
> 项目 `prebuild:android` 脚本使用 `expo prebuild --clean` 会整体重新生成 android/ 目录，手动添加的原生文件会被清除（曾因此丢过一次代码）。本功能已封装为 config plugin（`plugins/payment-notification/withPaymentNotification.js`，在 app.json 注册），prebuild 时自动：拷贝 .kt 模板 → 注入 MainApplication 注册 → 注入 Manifest Service 声明。**修改原生逻辑请改 plugins/ 下的模板，然后重新 `npm run prebuild:android`。**

### 新增

| 文件 | 职责 |
|---|---|
| `plugins/payment-notification/withPaymentNotification.js` | Expo config plugin：prebuild 时拷贝 .kt、注入 MainApplication/Manifest |
| `plugins/payment-notification/android/PaymentNotificationListener.kt` | 通知监听服务模板：包名过滤 + 支付关键词过滤 + 提取 title/text |
| `plugins/payment-notification/android/PaymentNotificationModule.kt` | 原生模块模板：`isPermissionGranted` / `openNotificationSettings` / `getPendingEvents` / `addListener` / `removeListeners`，事件缓冲与 emit |
| `plugins/payment-notification/android/PaymentNotificationPackage.kt` | ReactPackage 模板 |
| `services/paymentNotification.ts` | JS 侧原生模块封装，导出 `isPaymentNotificationAvailable`、权限查询、设置跳转、事件订阅、缓冲拉取 |
| `services/parser/strategies/NotificationStrategy.ts` | 通知文本解析策略：金额（`¥/￥`、`x.xx元`、纯两位小数）、商户（`向xxx付款`）、收支方向（收款/到账 → income） |
| `__tests__/BillParser.test.ts`（追加用例） | NotificationStrategy 5 个单测 |

### 修改

| 文件 | 改动 |
|---|---|
| `app.json` | plugins 数组追加本地插件 `./plugins/payment-notification/withPaymentNotification` |
| `android/app/src/main/AndroidManifest.xml` | Service 声明由插件自动注入（prebuild 生成，勿手动改） |
| `android/app/src/main/java/com/anonymous/kaikaio/MainApplication.kt` | `add(PaymentNotificationPackage())` 由插件自动注入（prebuild 生成，勿手动改） |
| `services/parser/BillParser.ts` | 策略注册表首位加入 `NotificationStrategy`（前缀标记需最先匹配） |
| `hooks/useAutoBookkeeping.ts` | 新增通知事件处理链路：订阅事件 + 挂载后拉取缓冲 + 开关门控 |
| `utils/storage.ts` | 新增 `getAutoBillNotificationEnabled/setAutoBillNotificationEnabled`（key：`auto_bill_notification_enabled:{account}`），并纳入账号数据清理 |
| `pages/Personalization.tsx` | 新增「支付通知自动记账」开关卡片（仅 Android 显示），开启时引导授权，回前台刷新授权状态 |

## 4. 关键设计决策

### 4.1 来源前缀标记解决策略冲突
通知原文可能含「微信支付」「支付成功」等字样，会与剪贴板策略（WeChatStrategy/AlipayStrategy）冲突。处理方式：JS 侧统一拼接 `【支付宝】`/`【微信】` 前缀，`NotificationStrategy.canParse` 只匹配该前缀（`/^【(支付宝|微信)】/`），并在 BillParser 中注册为最高优先级。前缀同时进入 `rawText` 参与哈希去重，天然区分两个来源通道。

### 4.2 双通道送达 + 哈希去重兜底丢单
原生层收到通知时**同时**做两件事：缓冲进内存队列（上限 20 条）+ 尝试实时 emit。JS 挂载时先注册监听、再调 `getPendingEvents` 清空缓冲。因此：
- App 在前台：实时 emit 送达；该事件同时留在缓冲中，下次挂载拉取时因哈希已 seen 被去重
- App 在后台/RN 未就绪：emit 失败无影响，事件留在缓冲，回前台挂载后拉取
- 重复送达不会产生重复弹窗：`clipboard_seen_hashes:{account}`（与剪贴板共用同一去重池，上限 200 条）

### 4.3 权限请求时机
遵循项目既有规范（权限只在用户明确操作处请求，避免 AppState 回调成环）：开关打开的那一刻检查授权，未授权则弹窗引导跳系统设置页；从设置页返回后通过 `AppState` active 刷新授权状态并更新开关描述文案。后台链路绝不主动弹任何权限引导。

### 4.4 开关按账号隔离
开关值存于 `auto_bill_notification_enabled:{account}`，与项目其他用户级配置保持一致，退出登录时随 `clearUserLocalData` 清理。`useAutoBookkeeping` 在挂载时读取一次存入 ref，作为事件处理的门控。

### 4.5 噪音过滤两道防线
- 原生层：只转发支付宝/微信两个包名 + 含支付语义关键词（支付/付款/收款/转账/消费/到账/入账/扣款）的通知
- JS 层：`NotificationStrategy` 解析不到有效金额时返回 null，不弹窗（如活动推广通知）

## 5. 当前支持的通知格式

| 来源 | 示例文本 | 解析结果 |
|---|---|---|
| 支付宝 | `你已成功付款12.50元` | expense ¥12.50 |
| 微信 | `你已成功向肯德基(人民广场店)付款￥25.00` | expense ¥25.00，商户=肯德基(人民广场店) |
| 微信 | `微信收款到账￥88.00` | income ¥88.00（命中「收款/到账」） |

金额匹配优先级：`￥/¥ + 数字` > `数字 + 元` > 纯 `x.xx` 两位小数。商户提取：`向(.{1,20}?)付款` 或 `交易对象：xxx`（支付宝通知通常不含商户，会留空）。

## 6. 已知限制与后续迭代方向

### 已知限制
1. **支付宝通知通常不带商户名**，仅能记金额，商户需用户在记账表单补填
2. **开关状态在挂载时读取一次**：用户在个性化页切换开关后，需等下次 `useAutoBookkeeping` 挂载（重新进入 Main）才完全生效；当前 Main 常驻，实际影响为"本次会话内切换开关可能延迟生效"。迭代建议：改为 storage 变更事件或 ref 提升
3. **缓冲仅内存队列**：进程被系统杀死后缓冲丢失（此窗口内通知无法找回）。迭代建议：改用 SharedPreferences 持久化缓冲
4. **通知使用权可能被系统回收**：部分 ROM 更新/优化后需重新授权，开关描述已给出引导文案
5. 转账、红包等特殊场景文案差异较大，可能解析失败（设计上允许漏识别，不允许误记账）
6. Google Play 对 `NotificationListenerService` 审核严格，上架需准备权限用途说明；国内商店相对宽松

### 迭代方向
- **金额/商户提取增强**：收集真实通知样本补充正则（可先在 DebugTools 页加通知原文采集）
- **自动入账模式**：开关下增加「免确认直接记账」子选项（高风险，需配合金额上限/分类置信度）
- **iOS Share Extension**：iOS 侧的替代方案，从支付宝/微信账单页分享到 Kaikaio，复用同一 BillParser
- **通知使用权状态巡检**：开关开启但授权丢失时在 Main 页轻提示一次（复用漏记检测的轻提示模式）

## 7. 问题排查指南

> 前置：本功能依赖三个开关同时生效——① Kaikaio 的通知使用权（我们引导）；② 支付宝/微信在系统设置中允许通知；③ 支付宝/微信 App 内的支付通知推送开关（支付宝：设置→消息设置；微信：「微信支付」服务号消息）。②③任一关闭都不会有通知进入系统通知栏，监听无感知。另注意：若用户开启了锁屏通知内容隐藏，正文可能被系统脱敏导致解析不到金额，属于预期内的漏识别。

| 现象 | 排查点 |
|---|---|
| 开关打开但不弹窗 | ① 系统设置中 Kaikaio 的「通知使用权」是否开启；② `auto_bill_notification_enabled:{account}` 是否为 true；③ 该通知文本是否被关键词/金额解析过滤（加日志看 `Notification parse error`） |
| 回前台才弹窗（预期行为） | 正常：弹窗依赖 Main 页挂载的 Alert 链路 |
| 同一笔重复弹窗 | 检查 `clipboard_seen_hashes:{account}` 写入是否成功（AsyncStorage 异常会降级为不去重） |
| 完全收不到事件 | ① 确认是原生重新构建后的包（纯 JS 热更不含原生模块）；② 若执行过 `prebuild:android`，确认 plugins/ 下模板存在且 config plugin 已注册（否则 .kt 会被 --clean 清掉）；③ OPPO/小米/华为需额外开启自启动与后台运行权限；④ logcat 过滤 `PaymentNotification` 查看服务是否存活；⑤ 确认支付宝/微信的系统通知权限与 App 内支付通知开关均已开启 |
| iOS 构建报错 | `paymentNotification.ts` 已做 iOS 退化，若仍报错检查是否误在 iOS 原生层引入了 Kotlin 文件 |

## 8. 验证方式

```bash
# 单元测试（解析策略）
npx jest __tests__/BillParser.test.ts

# TypeScript 检查
npx tsc --noEmit

# 重新生成 android 目录（原生模板修改后必须执行，config plugin 会自动注入）
npm run prebuild:android

# Android 原生编译
cd android && ./gradlew :app:compileDebugKotlin
```

真机验证步骤：重新安装 debug 包 → 个性化页打开开关 → 授权通知使用权 → 用支付宝/微信完成一笔支付 → 回到 App 应弹出「发现新账单」。
