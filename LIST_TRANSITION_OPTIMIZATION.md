# List.tsx 过渡动效与流畅度优化计划

> 目标：消除 `pages/List.tsx` 账单列表页的"生硬感"，让增删、排序、筛选、弹层等交互具备流畅丝滑的过渡效果。
>
> 技术基础：项目已安装 `react-native-reanimated@^4.3.0` 与 `react-native-gesture-handler@~2.28.0`，**无需新增依赖**。
>
> 状态标记：`[ ]` 未开始 / `[x]` 已完成

---

## P0-1 列表项布局动画（增删/排序/筛选平滑过渡）

**状态**：[x] 已完成（实施备注：`BillGroupItem` 根节点与 `BillItem` 外层包裹 reanimated `Animated.View`，分别挂 `layout={LinearTransition.springify()}` + `entering`/`exiting`；exiting 动画放在 `ReanimatedSwipeable` 外层以确保卸载时能完整播放；P2-1 高亮闪烁已随本项一并迁移到 reanimated）

**现状问题**：
- `setData` 后列表瞬间跳变：记账新增、滑动删除、切换正/倒序、筛选类型时，条目直接闪现/消失/换位。
- 涉及代码：`pages/List.tsx` 中 `setData` 相关逻辑（`upsertLocalDataItem`、`handleDeleteOptimisticBill`、`undoNewBill`、`fetchBills`）。

**改造方案**：
1. `components/BillGroupItem.tsx`：根节点从 `View` 换成 reanimated 的 `Animated.View`，添加：
   - `layout={LinearTransition.springify()}` — 条目换位/高度变化时平滑补位
   - `entering={FadeInDown.duration(250)}` — 新分组卡片入场
   - `exiting={FadeOut.duration(200)}` — 分组消失时淡出
2. `components/BillItem.tsx`：内层 `Animated.View`（核心 Animated）迁移为 reanimated `Animated.View`，添加：
   - `layout={LinearTransition.springify()}`
   - `entering={FadeInDown}`
   - `exiting`：高度收缩 + 淡出（与现有 `ReanimatedSwipeable` 删除流程配合，实现"删除后平滑塌陷"）
3. 注意事项：
   - `BillItem` 现有高亮闪烁用的是核心 `Animated`（见 P2-1），迁移时一并处理，避免两套 Animated 命名冲突（reanimated 需 `import Animated from 'react-native-reanimated'`）。
   - `FlatList` 的 renderItem 保持引用 `BillGroupItem`，动画由子组件内部承载，避免 FlatList 与 layout 动画冲突。

**验收标准**：
- 记账新增：新条目从上方淡入下滑，其余条目弹簧式补位。
- 删除：条目平滑退场，后续条目上移不跳动。
- 切换正序/倒序、类型筛选：条目换位有过渡而非瞬移。

---

## P0-2 撤销 Toast / 遮罩 / 横幅的出入场动画

**状态**：[x] 已完成（实施备注：三处均改为 reanimated `Animated.View` + entering/exiting；顶部 header 加 `layout` 过渡以配合离线横幅高度变化）

**现状问题**：
- 撤销 Toast（`List.tsx` L1380-1406）条件渲染直接弹出/消失。
- 提交中遮罩 `loadingOverlay`（L1408-1415）硬切。
- 离线横幅 `offlineBanner`（L1261-1265）突然出现。

**改造方案**：
1. 撤销 Toast：封装为常驻渲染 + 显隐驱动的组件（或用 reanimated `FadeInDown`/`SlideOutDown`），入场从底部滑入淡入，退场（4s 超时或点击后）滑出淡出。
2. 提交中遮罩：`Animated.View` + `opacity` 淡入淡出（进入 ~150ms，退出 ~200ms），避免硬切。
3. 离线横幅：高度/位移过渡（`entering={FadeInDown}` + `layout` 过渡），让顶部区域不突变。

**验收标准**：三类元素的显示与隐藏均有可见的过渡动画，无瞬间跳变。

---

## P1-1 月份切换 / 排序 / 筛选的整体过渡，去除大转圈

**状态**：[x] 已完成（实施备注：`fetchBills(isPullRefresh)` 区分下拉刷新与静默刷新，仅下拉时置 `refreshing`；整体交叉淡入方案弃用，改用 P0-1 条目级 entering/exiting/layout 动画承担切换过渡，避免 keyed 重挂载与条目动画双重叠加）

**现状问题**：
- `fetchBills`（`List.tsx` L332-435）中 `setRefreshing(true)` 会在 FlatList footer 显示大号 `ActivityIndicator`（L1345-1349），打断"缓存先行、只 setData 一次"的流畅节奏。
- 切月份/切排序/切筛选时整列表瞬间替换。

**改造方案**：
1. 区分两种加载态：
   - 下拉刷新：保留原生 `refreshing` 指示器。
   - 静默刷新（切月份/排序/筛选/refreshBus 触发）：不显示 footer 大 spinner，或仅在 header 展示细进度条。
2. FlatList 内容整体交叉淡入：给 FlatList 外层包 reanimated `Animated.View`，以 `key={currentDate}-${orderBy}-${selectedTypeId}` + `FadeIn` 实现切换时"淡入新内容"。
   - 注意与 P0-1 的条目级 layout 动画叠加效果，实施时需真机验证不出现双重动画抖动。

**验收标准**：切月份/排序/筛选时内容淡入切换；已有数据时无大转圈闪烁。

---

## P1-2 顶部统计数字滚动动画

**状态**：[x] 已完成（实施备注：新增 `components/AnimatedNumber.tsx`，`useSharedValue` + `withTiming`，通过 `useAnimatedReaction` + `runOnJS` 回写文本，duration 500ms；已接入 List 顶部总支出/总收入。注意：Reanimated 4 的 `SharedValue.addListener` 仅限 UI runtime 调用，JS 侧使用会报 "Adding listeners is only possible on the UI runtime"，故不可用）

**现状问题**：
- `summary.totalExpense / totalIncome`（`List.tsx` L1270-1274）记账/删除后数字瞬间跳变。

**改造方案**：
1. 用 reanimated `useSharedValue` + `withTiming`/`withSpring` 对数值插值，配合 `useAnimatedProps`（`Animated.Text` + `animatedProps`）或 `runOnJS` 回写文本，实现数字滚动（duration ~400-600ms）。
2. 抽出独立组件（如 `components/AnimatedNumber.tsx`）供 List 与后续 Statistics 页复用。

**验收标准**：记账/删除/撤销后，总支出/总收入数字平滑滚动到新值。

---

## P2-1 高亮闪烁动画迁移到 reanimated（UI 线程）

**状态**：[x] 已完成（已随 P0-1 一并迁移：`useSharedValue` + `withSequence(withTiming(...))` + `interpolateColor`，视觉效果保持 3 次闪烁不变）

**现状问题**：
- `components/BillItem.tsx` L54-69 的高亮闪烁使用核心 `Animated` 且 `useNativeDriver: false`（背景色动画走 JS 线程），滚动时易掉帧。

**改造方案**：
- 随 P0-1 一并迁移为 reanimated 的背景色动画（`useAnimatedStyle` + `withRepeat(withSequence(...))`），运行在 UI 线程。

**验收标准**：高亮闪烁 3 次的视觉效果保持不变，但动画在 UI 线程执行。

---

## P2-2 FAB 按钮反馈与入场动画

**状态**：[x] 已完成（实施备注：按压 `withSpring` 缩放 0.92 反馈 + `FadeInDown` 入场；`opacity: 0.65` 保留未动，待与 TabBar 遮挡关系确认后单独评估）

**现状问题**：
- FAB（`List.tsx` L1369-1372）无按压反馈，且固定 `opacity: 0.65` 观感偏"禁用态"。

**改造方案**：
1. 按压缩放弹簧反馈（reanimated `useAnimatedStyle` + `withSpring`，scale 0.92 左右）。
2. 首次入场动画（`entering={FadeInDown}` 或缩放弹入）。
3. 评估将 `opacity: 0.65` 调整为更高透明度或阴影方案（需与 TabBar 遮挡关系确认后再定，勿盲改）。

---

## P2-3 模板快捷条过渡

**状态**：[x] 已完成（实施备注：快捷条外层 `Animated.View` 挂 entering/exiting/layout；chip 包裹 `Animated.View` 实现增删淡入淡出，新增 `templateChipWrap` 样式保持横向布局）

**现状问题**：
- 模板快捷条（`List.tsx` L1298-1319）从无到有时高度突变。

**改造方案**：
- 外层加 `layout` 过渡动画，chip 增删时淡入淡出。

---

## P2-4 渲染性能：memo 化，保障长列表滚动帧率

**状态**：[x] 已完成（实施备注：新增 `dataRef` 镜像；`handleEdit`/`handleRetrySync`/`showToast`/`onRefresh`/`renderBillItem` 均 `useCallback` 稳定化；`BillGroupItem` 用 `React.memo` 包裹；FlatList 补充 `initialNumToRender`/`windowSize`；因与 reanimated 动画冲突未开启 `removeClippedSubviews`）

**现状问题**：
- `renderBillItem` 每次渲染重建；`handleEdit`、`handleRetrySync`、`onRefresh` 未 `useCallback`，`BillGroupItem` 无法 `React.memo`，长列表滚动易掉帧。这是 P0/P1 动画流畅度的前提。

**改造方案**：
1. `handleEdit`、`handleRetrySync`、`onRefresh`、`renderBillItem` 用 `useCallback` 稳定化（`handleEdit`/`handleRetrySync` 内部对 `data` 的访问改用 ref 或函数式获取，避免依赖 `data` 导致频繁失效）。
2. `BillGroupItem` 用 `React.memo` 包裹。
3. 视列表长度补充 FlatList 调优参数（`initialNumToRender`、`windowSize`、`removeClippedSubviews`）。

---

## 实施顺序与依赖

| 步骤 | 项目 | 依赖 |
| --- | --- | --- |
| 1 | P0-1 列表项布局动画 | 无（含 P2-1 背景色迁移） |
| 2 | P0-2 Toast/遮罩/横幅动画 | 无 |
| 3 | P2-4 memo 化 | 建议在 P0-1 后验证动画时顺带做 |
| 4 | P1-1 切月过渡 + 去大转圈 | P0-1（需验证动画叠加） |
| 5 | P1-2 数字滚动 | 无 |
| 6 | P2-2 / P2-3 | 无，收尾打磨 |

## 回归验证清单

- [ ] 新增记账 → 条目入场 + 撤销 Toast + 高亮闪烁正常
- [ ] 撤销 → 条目退场、统计回滚正常
- [ ] 滑动删除（云端账单 / 本地乐观账单两类）→ 退场动画正常，无误删
- [ ] 切换正序/倒序、类型筛选 → 换位有过渡
- [ ] 切月份 → 淡入切换、无大转圈
- [ ] 离线场景（缓存先行）→ 离线横幅过渡正常
- [ ] iOS + Android 双端真机验证动画帧率
