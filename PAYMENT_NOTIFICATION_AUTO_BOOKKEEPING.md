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
  · 事件先落 SharedPreferences 持久化缓冲（上限 20 条），再尝试实时 emit
  · RN 未就绪 / 进程被回收都不丢单，回前台由 JS 主动拉取
        │                                    ▲
        │  事件流（实时）                      │ getPendingEvents（挂载时 + 每次回前台）
        ▼                                    │
services/paymentNotification.ts（JS 封装，iOS 退化为不可用）
        │
        ▼
hooks/useAutoBookkeeping.ts
  · 开关检查（auto_bill_notification_enabled:{account}）
  · 拼接来源前缀：【支付宝】/【微信】
  · 去重：事件 ID（来源+标题+正文+通知 postTime）+ 60s 同文案窗口
  · 账单日期取通知 postTime，延迟补记日期仍准确
  · billParser.parse() → NotificationStrategy
        │
        ▼
Main.tsx 弹窗队列「发现新账单」→ navigate List 携带 autoBill → BillForm 预填
```

## 3. 文件清单

> ⚠️ **重要：原生源文件在 `plugins/payment-notification/android/` 下，不在 `android/` 目录里。**
> 项目 `prebuild:android` 脚本使用 `expo prebuild --clean` 会整体重新生成 android/ 目录，手动添加的原生文件会被清除（曾因此丢过一次代码）。本功能已封装为 config plugin（`plugins/payment-notification/withPaymentNotification.js`，在 app.json 注册），prebuild 时自动：拷贝 .kt 模板 → 注入 MainApplication 注册 → 注入 Manifest Service 声明。**修改原生逻辑请改 plugins/ 下的模板，然后重新 `npm run prebuild:android`。**

### 新增

| 文件 | 职责 |
|---|---|
| `plugins/payment-notification/withPaymentNotification.js` | Expo config plugin：prebuild 时拷贝 .kt、注入 MainApplication/Manifest |
| `plugins/payment-notification/android/PaymentNotificationListener.kt` | 通知监听服务模板：包名过滤 + 支付关键词过滤 + 多字段正文提取 + 断连重绑 |
| `plugins/payment-notification/android/PaymentNotificationModule.kt` | 原生模块模板：`isPermissionGranted` / `openNotificationSettings` / `getPendingEvents` / `addListener` / `removeListeners`，事件持久化缓冲与 emit |
| `plugins/payment-notification/android/PaymentNotificationPackage.kt` | ReactPackage 模板 |
| `services/paymentNotification.ts` | JS 侧原生模块封装，导出 `isPaymentNotificationAvailable`、权限查询、设置跳转、事件订阅、缓冲拉取 |
| `services/parser/strategies/NotificationStrategy.ts` | 通知文本解析策略：金额（显式金额字段 > `¥/￥` > `x.xx元` > 纯两位小数）、商户（`向xxx付款`/`付款给xxx`/`交易对象/商户：xxx`）、收支方向（支出词优先，`收款/到账/退款 → income`） |
| `__tests__/BillParser.test.ts`（追加用例） | NotificationStrategy 单测 |
| `__tests__/AutoBookkeepingDedup.test.ts` | 去重语义回归：同一条通知重复送达去重、同额不同笔必须都能记账 |

### 修改

| 文件 | 改动 |
|---|---|
| `app.json` | plugins 数组追加本地插件 `./plugins/payment-notification/withPaymentNotification` |
| `android/app/src/main/AndroidManifest.xml` | Service 声明由插件自动注入（prebuild 生成，勿手动改） |
| `android/app/src/main/java/com/anonymous/kaikaio/MainApplication.kt` | `add(PaymentNotificationPackage())` 由插件自动注入（prebuild 生成，勿手动改） |
| `services/parser/BillParser.ts` | 策略注册表首位加入 `NotificationStrategy`（前缀标记需最先匹配） |
| `hooks/useAutoBookkeeping.ts` | 新增通知事件处理链路：订阅事件 + 挂载/回前台拉取缓冲 + 开关门控；去重改为事件 ID + 60s 文案窗口；账单日期取通知 postTime；新增通知使用权看门狗（回前台巡检，失效时每天轻提示一次） |
| `utils/storage.ts` | 新增 `getAutoBillNotificationEnabled/setAutoBillNotificationEnabled`（key：`auto_bill_notification_enabled:{account}`）与 `notif_perm_hint_date:{account}` 清理，并纳入账号数据清理 |
| `pages/Personalization.tsx` | 新增「支付通知自动记账」开关卡片（仅 Android 显示），开启时引导授权，回前台刷新授权状态；授权丢失时描述区变黄并可点击直达系统设置页 |
| `pages/Main.tsx` | 通知使用权失效时展示轻提示（每天最多一次）；自动记账弹窗改为队列，后台连续多笔不再互相覆盖 |

## 4. 关键设计决策

### 4.1 来源前缀标记解决策略冲突
通知原文可能含「微信支付」「支付成功」等字样，会与剪贴板策略（WeChatStrategy/AlipayStrategy）冲突。处理方式：JS 侧统一拼接 `【支付宝】`/`【微信】` 前缀，`NotificationStrategy.canParse` 只匹配该前缀（`/^【(支付宝|微信)】/`），并在 BillParser 中注册为最高优先级。前缀同时进入 `rawText` 参与哈希去重，天然区分两个来源通道。

### 4.2 双通道送达 + 事件级去重兜底丢单
原生层收到通知时**同时**做两件事：持久化进缓冲队列（SharedPreferences，上限 20 条）+ 尝试实时 emit。JS 挂载时先注册监听、再调 `getPendingEvents` 清空缓冲；此后**每次回前台都补拉一次**，因此：
- App 在前台：实时 emit 送达；该事件同时留在缓冲中，回前台补拉时因事件 ID 已见被去重
- App 在后台 / RN 未就绪：emit 可能拿不到 JS 线程，事件仍在缓冲，回前台立即补拉
- **App 进程被系统回收（国产 ROM 常见）**：事件已在 SharedPreferences 落盘，下次启动仍能取回
- 重复送达不会产生重复弹窗：见下方去重语义

JS 处理完一条事件后会调用 `ackEvent` 把它从持久化缓冲中移除（开关未开启时**不**回执，事件留在缓冲等开关打开后补记）。这样「前台实时处理过、进程随后被杀」也不会在下次启动重复补记同一笔。

### 4.2.1 去重语义（重要，历史 bug 修复点）
去重**只能针对「同一条通知的重复送达」，绝不能针对「内容相同的不同笔支付」**。

微信/支付宝的免密扣费通知经常只有金额（如 `已扣费¥9.29`），既没有商户也没有时间。早期实现用「文案哈希 + 200 条常驻池」做永久去重，导致同额的第二笔及之后的支付被**静默丢弃**，用户表现为「通知明明来了但 App 没反应」——这是自动记账漏响应的头号原因。

现在的判定（`markNotificationHandled`）：
1. **事件 ID** = `来源 + 标题 + 正文 + 通知 postTime`。同一条通知的重复送达（实时 + 缓冲）ID 完全一致，可靠去重；不同笔支付 postTime 必然不同，不会互相误伤
2. **文案短窗口** 60s：兜底防住系统分组通知（子通知 / `[N条]` 聚合通知）产生的同文案重复
3. 去重状态是**会话内内存**结构，进程重启自然清空，不再持久化累积

剪贴板链路仍使用 `clipboard_seen_hashes:{account}`（按文案长期去重，避免每次回前台重复提示同一条剪贴板账单），两条链路互不干扰。

### 4.2.2 通知正文提取
支付宝/微信的正文位置并不固定，原生层按「含金额优先」挑选候选：
`EXTRA_TEXT` → `EXTRA_BIG_TEXT` → `EXTRA_TEXT_LINES`（聚合通知，如「[2条]微信支付」）→ `EXTRA_SUB_TEXT`。
历史实现只读 `EXTRA_TEXT`，当系统把正文截断成不含金额的摘要时就会漏记。

### 4.3 权限请求时机
遵循项目既有规范（权限只在用户明确操作处请求，避免 AppState 回调成环）：开关打开的那一刻检查授权，未授权则弹窗引导跳系统设置页；从设置页返回后通过 `AppState` active 刷新授权状态并更新开关描述文案。后台链路绝不主动弹任何权限引导。

### 4.4 开关按账号隔离且实时生效
开关值存于 `auto_bill_notification_enabled:{account}`，与项目其他用户级配置保持一致，退出登录时随 `clearUserLocalData` 清理。每个通知事件处理时实时读取开关（AsyncStorage），因此同一会话内切换开关立即生效，无需重启 App。

### 4.5 噪音过滤两道防线
- 原生层：只转发支付宝/微信两个包名 + 含支付语义关键词（支付/付款/收款/转账/消费/到账/入账/扣款）的通知
- JS 层：`NotificationStrategy` 解析不到有效金额时返回 null，不弹窗（如活动推广通知）

### 4.6 授权丢失巡检（每天最多提醒一次）
通知使用权可能被 ROM 优化或系统更新回收，且**重装 App 后必然失效**，而开关本身仍显示为「开启」，用户无从察觉。为此在 App 回前台时巡检一次：**开关已开 + 授权已丢**才提示。

- 提示频率对齐漏记轻提示（`useMissedRecordReminder`）的模式：命中当天在 `notif_perm_hint_date:{account}` 落一条日期，同一天不再重复打扰；授权恢复正常则不落日期、不提示。
- 因为开关此时已是「开」状态，**拨动开关只会把它关掉，无法再次触发授权引导**。所以「个性化」页在授权丢失时会把描述文案变黄并做成可点击入口，直达系统「通知使用权」设置页，避免用户卡死在这一步。

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
2. **缓冲只保留最近 20 条**：长时间不打开 App 时，最早的通知会被挤出队列（当前为 SharedPreferences 持久化，进程被杀不丢）
3. **通知使用权可能被系统回收**：部分 ROM 更新/优化后需重新授权，开关描述已给出引导文案；**重装 App 后授权一定失效，必须重新授予**
4. 转账、红包等特殊场景文案差异较大，可能解析失败（设计上允许漏识别，不允许误记账）
5. Google Play 对 `NotificationListenerService` 审核严格，上架需准备权限用途说明；国内商店相对宽松

### 迭代方向
- **金额/商户提取增强**：收集真实通知样本补充正则（可先在 DebugTools 页加通知原文采集）
- **自动入账模式**：开关下增加「免确认直接记账」子选项（高风险，需配合金额上限/分类置信度）
- **iOS Share Extension**：iOS 侧的替代方案，从支付宝/微信账单页分享到 Kaikaio，复用同一 BillParser

## 7. 问题排查指南

> 前置：本功能依赖三个开关同时生效——① Kaikaio 的通知使用权（我们引导）；② 支付宝/微信在系统设置中允许通知；③ 支付宝/微信 App 内的支付通知推送开关（支付宝：设置→消息设置；微信：「微信支付」服务号消息）。②③任一关闭都不会有通知进入系统通知栏，监听无感知。另注意：若用户开启了锁屏通知内容隐藏，正文可能被系统脱敏导致解析不到金额，属于预期内的漏识别。

**全链路日志排查法**：原生层统一使用 tag `PaymentNotif`，JS 层使用 `[AutoBookkeeping]` 前缀。真机连接后执行：

```bash
adb logcat -s PaymentNotif:* ReactNativeJS:*
```

按日志断点定位问题层级：

| 日志表现 | 结论 |
|---|---|
| 无任何 `PaymentNotif` 输出 | 服务未运行：通知使用权未授予（重装后必失效）、或 ROM 杀后台/未自启动 |
| 有 `listener disconnected, requesting rebind` | 监听被 ROM 解绑过，已请求重绑；若反复出现需关闭该应用的省电优化 |
| 有 `listener connected`，支付时无任何 posted 日志 | 支付宝/微信未发通知：检查②③开关 |
| `skipped (no payment keyword)` | 通知文本未命中支付关键词，需根据实际文案扩展关键词列表 |
| `forwarded` + `event emitted to JS` 但无 `[AutoBookkeeping]` | 事件桥断：确认 JS 监听已注册（Main 已挂载）；事件已落盘，回前台会自动补拉 |
| `event persisted only (RN module not mounted)` | 正常：App 未启动/RN 未就绪，事件已持久化，打开 App 后补记 |
| `[AutoBookkeeping] payment event received` 后 `skipped: disabled` | 开关未开或账号未登录 |
| `skipped: parse failed` | 通知文案不匹配正则，日志中已打印原文，据此补 NotificationStrategy 正则 |
| `skipped: duplicate notification` | 同一条通知重复送达（实时 + 缓冲），属正常去重 |
| `[AutoBookkeeping] draining pending notifications N` | 回前台补拉到了后台期间的通知（预期行为） |
| `bill detected, showing dialog` 但无弹窗 | Main 页弹窗链路问题（如导航栈上已有弹窗或 App 判定为非前台） |

| 现象 | 排查点 |
|---|---|
| 开关打开但不弹窗 | ① 系统设置中 Kaikaio 的「通知使用权」是否开启；② `auto_bill_notification_enabled:{account}` 是否为 true；③ 该通知文本是否被关键词/金额解析过滤（加日志看 `Notification parse error`）；④ 回前台后是否看到 `draining pending notifications`（说明事件其实收到了，只是实时链路没送到） |
| 同额的第二笔支付不弹窗 | 历史 bug（已修复）：旧版按文案永久去重，同额通知被静默丢弃。确认包内 `useAutoBookkeeping` 是事件 ID + 60s 窗口的新版去重 |
| 回前台才弹窗（预期行为） | 正常：弹窗依赖 Main 页挂载的弹窗链路 |
| 同一笔重复弹窗 | 检查实时事件与缓冲补拉的 `time`（通知 postTime）是否一致；不一致时事件 ID 会变化（原生层已保证同一条通知 postTime 不变） |
| 完全收不到事件 | ① 确认是原生重新构建后的包（纯 JS 热更不含原生模块）；② 若执行过 `prebuild:android`，确认 plugins/ 下模板存在且 config plugin 已注册（否则 .kt 会被 --clean 清掉）；③ OPPO/小米/华为需额外开启自启动与后台运行权限；④ logcat 过滤 `PaymentNotification` 查看服务是否存活；⑤ 确认支付宝/微信的系统通知权限与 App 内支付通知开关均已开启 |
| iOS 构建报错 | `paymentNotification.ts` 已做 iOS 退化，若仍报错检查是否误在 iOS 原生层引入了 Kotlin 文件 |

## 8. 验证方式

```bash
# 单元测试（解析策略 + 去重语义回归）
npx jest __tests__/BillParser.test.ts __tests__/AutoBookkeepingDedup.test.ts

# TypeScript 检查
npx tsc --noEmit

# 重新生成 android 目录（原生模板修改后必须执行，config plugin 会自动注入）
npm run prebuild:android

# Android 原生编译
cd android && ./gradlew :app:compileDebugKotlin
```

真机验证步骤：重新安装 debug 包 → 个性化页打开开关 → 授权通知使用权 → 用支付宝/微信完成一笔支付 → 回到 App 应弹出「发现新账单」。

**漏响应回归验证**：连续做两笔**金额相同**的微信支付（可间隔 2 分钟）→ 两笔都应分别弹出「发现新账单」。旧版实现只会在第一笔弹窗。

**进程回收兜底验证**：支付后立刻在最近任务里划掉 Kaikaio（或 `adb shell am force-stop com.anonymous.kaikaio`）→ 再打开 App，应补弹该笔账单（事件已持久化）。
