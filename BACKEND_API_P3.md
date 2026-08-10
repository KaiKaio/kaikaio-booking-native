# P3 阶段四「激励与心智」后端 API 需求文档

> 对应前端计划：`PAINLESS_BOOKKEEPING_PLAN.md` P3 阶段（任务 10 习惯激励 / 任务 11 预算辅助 / 任务 12 本地配置云端同步）。
>
> 本文档面向后端开发，定义所需新增接口的业务背景、数据结构、请求/响应格式与关键规则。评审通过后按此实现。

## 0. 通用约定

沿用现有系统约定，不再重复说明：

| 项 | 约定 |
|---|---|
| 鉴权 | Header `Authorization: {accessToken}`（与现有 `/api/bill/*` 一致）；401 时客户端走 `/api/user/refresh` 刷新后自动重试 |
| 用户维度 | 所有接口按 token 解析出的用户隔离，请求体**不传** account/用户 id |
| 响应包裹 | `{ "code": 200, "msg": "success", "data": {...} }`；`code != 200` 时 `msg` 为可直接展示的错误文案 |
| 日期格式 | `YYYY-MM-DD`；月份格式 `YYYY-MM` |
| 时间戳 | 毫秒级 Unix 时间戳（与客户端 `Date.now()` 一致） |
| 金额 | number，单位元，后端按两位小数处理，避免浮点累计误差 |
| 时区 | 以用户设备本地时区上报（见各接口 `timezone` 字段），自然日/自然月判定以该时区为准 |

接口清单总览：

| 模块 | 接口 | 方法 | 路径 |
|---|---|---|---|
| 习惯激励 | 记账打卡 | POST | `/api/habit/checkIn` |
| 习惯激励 | 查询连记数据 | GET | `/api/habit/streak` |
| 预算辅助 | 预算配置列表 | GET | `/api/budget/list` |
| 预算辅助 | 新增/更新预算 | POST | `/api/budget/save` |
| 预算辅助 | 删除预算 | POST | `/api/budget/delete` |
| 预算辅助 | 月度预算进度 | GET | `/api/budget/progress` |
| 配置同步 | 增量拉取配置 | POST | `/api/sync/pull` |
| 配置同步 | 批量推送配置 | POST | `/api/sync/push` |
| 账单（改造） | 周期账单幂等生成 | POST | `/api/bill/add`（现有接口增强） |

---

## 1. 习惯激励（任务 10）

### 业务背景

客户端需要在统计页 / "我的"页展示**连续记账天数（streak）**，并在连记达到里程碑（7/30/100/365 天）时给出一次性轻反馈。streak 由服务端基于账单日期权威计算，保证跨设备一致；客户端每次记账成功后调用打卡接口，离线记账恢复同步后也会补打卡。

**streak 计算规则**（后端实现，需与前端展示口径一致）：

1. 以"自然日有 ≥1 笔账单"记为有效记账日（不限笔数、不限收支类型）；
2. 当前连记 `currentStreak`：从今天（若今天尚无记录则从昨天）向前连续累计有效记账日；
3. **断签容错**：允许 1 天宽限——昨天漏记但今天有记录时，连记不清零，仅跳过该空缺日继续累计（空缺日本身不计入天数）；
4. `longestStreak`：历史最长连记（同样应用宽限规则）；
5. `totalDays`：累计有效记账日总数。

**里程碑规则**：档位固定为 `[7, 30, 100, 365]`；达到某档后服务端持久化记录，每个档位对每个用户只生效一次。

### 1.1 记账打卡 `POST /api/habit/checkIn`

客户端在每次记账成功后调用（含离线队列恢复同步后批量补打）。同一天重复调用需幂等。

**Request Body**

```json
{
  "dates": ["2026-08-09", "2026-08-10"],
  "timezone": "Asia/Shanghai"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| dates | string[] | 是 | 发生记账的自然日列表（1~31 条，补账场景可能跨多天） |
| timezone | string | 是 | IANA 时区名 |

**Response `data`**

```json
{
  "currentStreak": 12,
  "longestStreak": 30,
  "totalDays": 156,
  "checkedToday": true,
  "milestonesReached": [7]
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| currentStreak | number | 当前连记天数 |
| longestStreak | number | 历史最长连记天数 |
| totalDays | number | 累计有效记账日 |
| checkedToday | boolean | 今天是否为有效记账日 |
| milestonesReached | number[] | 本次调用**新达到**的里程碑档位（用于客户端弹祝贺文案），无则为 `[]` |

### 1.2 查询连记数据 `GET /api/habit/streak`

客户端进入统计页 / "我的"页时拉取，本地缓存兜底展示。

**Query 参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| timezone | string | 是 | IANA 时区名 |

**Response `data`**：同 1.1（`milestonesReached` 恒为 `[]`，里程碑只在 checkIn 时下发）。

---

## 2. 预算辅助（任务 11）

### 业务背景

支持两种预算：**月度总预算**（每月循环生效）与**按分类预算**（如"餐饮每月 2000"）。预算配置随账号云端同步；`已用金额`由服务端基于当月支出账单实时统计（`pay_type = '1'`），客户端只负责展示与轻提醒，**预算不阻塞记账**。

### 2.1 预算配置列表 `GET /api/budget/list`

**Response `data`**

```json
{
  "totalBudget": { "amount": 8000, "updatedAt": 1754800000000 },
  "categoryBudgets": [
    {
      "id": 101,
      "categoryId": 3,
      "categoryName": "餐饮",
      "amount": 2000,
      "updatedAt": 1754800000000
    }
  ]
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| totalBudget | object \| null | 月度总预算；未设置时为 `null` |
| categoryBudgets | array | 分类预算列表，可为空数组 |

### 2.2 新增/更新预算 `POST /api/budget/save`

按 `(scope, categoryId)` upsert：同一 scope + 同一分类重复提交视为更新金额。

**Request Body**

```json
{
  "scope": "category",
  "categoryId": 3,
  "amount": 2000
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| scope | string | 是 | `total`（月度总预算）或 `category`（分类预算） |
| categoryId | number | scope=category 时必填 | 分类 id，需校验归属当前用户 |
| amount | number | 是 | 预算金额，> 0，上限建议 100,000,000 |

**Response `data`**：返回保存后的完整预算对象（结构同 2.1 中对应项）。

**错误约定**：`scope=category` 未传 categoryId → `code != 200`，msg 提示"请选择分类"；分类不存在或非本人 → 同上。

### 2.3 删除预算 `POST /api/budget/delete`

**Request Body**

```json
{ "scope": "category", "categoryId": 3 }
```

删除总预算传 `{ "scope": "total" }`。幂等：删除不存在的预算也返回成功。

**Response `data`**：`null`。

### 2.4 月度预算进度 `GET /api/budget/progress`

统计页展示进度条 + 客户端超支轻提醒的数据来源。

**Query 参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| month | string | 是 | `YYYY-MM` |
| timezone | string | 是 | IANA 时区名，按该时区统计当月账单 |

**Response `data`**

```json
{
  "month": "2026-08",
  "totalBudget": {
    "amount": 8000,
    "used": 5230.5,
    "ratio": 0.65
  },
  "categoryBudgets": [
    {
      "categoryId": 3,
      "categoryName": "餐饮",
      "amount": 2000,
      "used": 1850,
      "ratio": 0.925
    }
  ]
}
```

| 字段 | 说明 |
|---|---|
| used | 当月该维度支出合计（`pay_type='1'`，含周期账单生成的账单） |
| ratio | `used / amount`，保留 4 位小数；未设置预算的维度不出现在结果中 |
| totalBudget | 未设置时为 `null` |

> 客户端行为说明（供后端理解调用频率）：记账成功后、进入统计页时各调用一次，无高频轮询。

---

## 3. 配置同步（任务 12）

### 业务背景

客户端的周期账单、快捷模板、提醒设置目前仅存本地 AsyncStorage，存在两个问题：

1. **不跨设备同步**：换机 / 重装后配置丢失；
2. **多端不一致**：同账号多设备各自维护周期账单配置，到期时可能重复生成账单。

方案：采用**类型化 KV 同步**——配置以 `(type, id)` 为键、JSON payload 为值存云端；客户端登录后全量拉取、变更时批量推送；删除走软删标记；冲突按 `updatedAt` 最后写入优先（LWW）。

### 配置类型与 payload 结构

| type 取值 | 说明 | payload 结构（客户端现有模型，后端按 JSON 透传即可，无需解析字段） |
|---|---|---|
| `recurring_bill` | 周期账单配置 | `{ id, name, amount, categoryId, categoryName, categoryIcon?, type('1'\|'2'), cycle('weekly'\|'monthly'\|'yearly'), startDate, mode('confirm'\|'silent'), paused, nextDueDate, createdAt }` |
| `bill_template` | 快捷模板 | `{ id, name, amount, categoryId, categoryName, categoryIcon, type('1'\|'2'), createdAt, lastUsedAt }` |
| `reminder_settings` | 提醒设置（单例，id 固定为 `default`） | `{ enabled, hour, minute, missedDetectEnabled }` |

> 后端建议 payload 按 JSON 字符串/JSONB 存储，**不做字段级校验**（客户端迭代字段时后端无需发版）；仅校验 type 枚举与单用户单类型的条数上限（recurring_bill ≤ 50，bill_template ≤ 30，reminder_settings = 1）。

### 3.1 增量拉取配置 `POST /api/sync/pull`

**Request Body**

```json
{
  "types": ["recurring_bill", "bill_template", "reminder_settings"],
  "since": 1754700000000
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| types | string[] | 否 | 缺省拉取全部类型 |
| since | number | 否 | 增量起点（客户端本地记录的上次同步时间戳）；缺省/为 0 表示全量 |

**Response `data`**

```json
{
  "serverTime": 1754800000000,
  "items": [
    {
      "type": "recurring_bill",
      "id": "recurring_1754000000000_abc1234",
      "payload": { "...": "..." },
      "deleted": false,
      "updatedAt": 1754750000000
    }
  ]
}
```

| 字段 | 说明 |
|---|---|
| serverTime | 服务端当前时间戳，客户端下次 pull 作为 `since` 传入 |
| items | `updatedAt > since` 的全部配置（**含 `deleted: true` 的软删记录**，客户端据此删除本地对应项） |

软删记录建议保留 90 天后物理清理。

### 3.2 批量推送配置 `POST /api/sync/push`

**Request Body**

```json
{
  "items": [
    {
      "type": "recurring_bill",
      "id": "recurring_1754000000000_abc1234",
      "payload": { "...": "..." },
      "deleted": false,
      "updatedAt": 1754750000000
    }
  ]
}
```

单次最多 100 条。

**冲突解决（LWW）**：对同一 `(type, id)`，服务端仅当请求 `updatedAt` ≥ 库中 `updatedAt` 时覆盖；否则保留库中版本。

**Response `data`**

```json
{
  "serverTime": 1754800000000,
  "results": [
    { "type": "recurring_bill", "id": "recurring_...", "accepted": true,  "updatedAt": 1754750000000 },
    { "type": "bill_template",  "id": "tpl_...",       "accepted": false, "updatedAt": 1754760000000 }
  ]
}
```

| 字段 | 说明 |
|---|---|
| accepted | 是否被服务端采纳 |
| updatedAt | 服务端最终生效版本的时间戳；`accepted=false` 时客户端应拉取并采用服务端版本 |

### 3.3 周期账单生成幂等（现有 `POST /api/bill/add` 增强）

多端各自运行周期账单生成逻辑时，可能对同一账期重复提交账单。要求 `/api/bill/add` 增加幂等校验：

**客户端约定**：周期账单生成时 remark 采用结构化标记：

```
[周期]{name}|cfg:{配置id}|due:{账期YYYY-MM-DD}
```

示例：`[周期]房租|cfg:recurring_1754000000000_abc1234|due:2026-08-01`

**后端规则**：

1. `addBill` 时解析 remark 中的 `cfg` 与 `due`；解析失败则按普通账单处理（兼容历史数据与手动记账）；
2. 解析成功则以 **(用户, cfg id, due 账期)** 为唯一键查重——命中则**不新增**，返回 `code: 200` 且 `data` 为已存在的账单对象（客户端视作成功，静默去重）；
3. 建议落库时为该维度建唯一索引（remark 中提取的字段可冗余为独立列 `recurring_cfg_id`、`recurring_due_date`，允许为 NULL）；
4. 账单被用户删除后，同一 (cfg id, due) 允许再次生成（即唯一键仅约束未删除账单，或采用软删后重建策略，由后端选型）。

---

## 4. 实施建议与依赖关系

| 批次 | 接口 | 说明 |
|---|---|---|
| 第一批 | 3.1 / 3.2 / 3.3 | 配置同步 + 幂等生成，解决多端重复账单这一数据正确性问题，优先级最高 |
| 第二批 | 2.1 ~ 2.4 | 预算辅助，依赖账单统计能力（可复用现有月度统计逻辑） |
| 第三批 | 1.1 / 1.2 | 习惯激励，可基于账单表聚合实现 |

待后端评审确认：

1. streak 的"1 天宽限"规则是否符合产品预期（可配置化预留）；
2. `/api/bill/add` 幂等改造是否影响现有客户端版本（老版本 remark 为 `[周期]{name}` 无结构化标记，走普通账单逻辑，向后兼容）；
3. 配置 payload 采用透传 JSON 的存储方式（JSONB / TEXT）。
