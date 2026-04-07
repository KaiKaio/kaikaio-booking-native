# BillItem 组件使用指南

## 1. BillItem 组件定义

### 位置
[components/BillItem.tsx](components/BillItem.tsx)

### Props 接口
```typescript
export interface BillItemProps {
  id: number;                           // 账单 ID
  type: string;                         // 账单类型名称（如："餐饮"、"交通"）
  icon: string;                         // 类别图标
  remark: string;                       // 账单备注/说明
  amount: number;                       // 显示金额（支出为负数，收入为正数）
  onDeleteSuccess?: () => void;         // 删除成功回调
  onEdit?: (id: number) => void;        // 编辑回调
  isLast?: boolean;                     // 是否是最后一个项目
  // 同步状态相关
  syncStatus?: 'syncing' | 'synced' | 'failed';  // 同步状态
  localId?: string;                     // 本地唯一 ID
  onRetry?: (localId: string) => void;  // 重试回调
}
```

---

## 2. BillItem 调用位置

### 2.1 ListRefactored.tsx（推荐使用）
**位置**: [pages/ListRefactored.tsx](pages/ListRefactored.tsx) Line 127-136

```typescript
const renderBillItem = ({ item }: { item: any }) => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionDate}>{item.date}</Text>
      <Text style={styles.sectionStat}>
        支出: ￥{item.total.toFixed(2)} 收入: ￥{item.income.toFixed(2)}
      </Text>
    </View>
    {item.items.map((subItem: any, index: number) => (
      <BillItem
        key={subItem.id}
        {...subItem}
        onDeleteSuccess={refreshBills}
        onEdit={handleEdit}
        isLast={index === item.items.length - 1}
      />
    ))}
  </View>
);
```

### 2.2 List.tsx（备用版本）
**位置**: [pages/List.tsx](pages/List.tsx)

在 FlatList 中类似方式使用 BillItem：
```typescript
{item.items.map((subItem: any, index: number) => (
  <BillItem
    key={subItem.id}
    {...subItem}
    onDeleteSuccess={refreshBills}
    onEdit={handleEdit}
    isLast={index === item.items.length - 1}
  />
))}
```

---

## 3. 数据结构详解

### 3.1 账单原始数据 (API 返回)

**来源**: [types/bill.ts](types/bill.ts)

```typescript
export interface BillDetail {
  id: number;
  pay_type: string;        // "1" = 支出, "2" = 收入
  amount: string;          // 金额（字符串格式，需转换为数字）
  date: string;            // 日期
  type_id: string;         // 类别 ID
  type_name: string;       // 类别名称（如："餐饮"、"交通"）
  remark: string;          // 备注
  create_time: string;     // 创建时间
}

export interface DailyBill {
  date: string;
  bills: BillDetail[];
}

export interface BillListResponseData {
  totalExpense: number;    // 总支出
  totalIncome: number;     // 总收入
  totalPage: number;
  list: DailyBill[];       // 按日期分组的账单列表
}
```

### 3.2 收入/支出标识

**关键字段**: `pay_type`

| pay_type 值 | 含义 | amount 符号 | 说明 |
|------------|------|-----------|------|
| `"1"` | 支出（expense） | 负数 显示 | 如果是支出 ¥100，显示为 -¥100 |
| `"2"` | 收入（income） | 正数 显示 | 如果是收入 ¥100，显示为 +¥100 |

### 3.3 数据转换流程

**步骤 1**: 从 API 获取原始数据
```typescript
// API 返回的 BillDetail
{
  id: 1,
  pay_type: "1",        // 字符串
  amount: "50.00",      // 字符串
  type_id: "1",
  type_name: "餐饮",
  remark: "午餐",
  date: "2024-01-15",
  create_time: "2024-01-15T12:00:00.000Z"
}
```

**步骤 2**: 在 billStore.ts 中转换为 BillItem
```typescript
// transformBillData 函数转换逻辑
const amount = parseFloat(bill.amount);              // 50.00
const isExpense = bill.pay_type === '1';             // true
const displayAmount = isExpense ? -amount : amount;  // -50.00

const billItem: BillItem = {
  id: bill.id,
  type: bill.type_name,             // "餐饮"
  icon: getCategoryIcon(bill.type_name),  // 从 CategoryContext 获取
  remark: bill.remark,               // "午餐"
  amount: displayAmount,             // -50.00 (负数表示支出)
  typeId: bill.type_id,              // "1"
  payType: parseInt(bill.pay_type, 10),  // 1 (数字)
  date: bill.date,                   // "2024-01-15"
  rawAmount: amount,                 // 50.00 (原始金额)
};
```

**步骤 3**: 按日期分组并传给 BillItem
```typescript
// DailyBillGroup 结构
{
  date: "2024-01-15",
  total: 120.50,         // 该日支出总额
  income: 500.00,        // 该日收入总额
  items: [               // BillItem 数组
    {
      id: 1,
      type: "餐饮",
      icon: "...",
      remark: "午餐",
      amount: -50.00,    // 负数为支出
      typeId: "1",
      payType: 1,
      date: "2024-01-15",
      rawAmount: 50.00
    },
    {
      id: 2,
      type: "交通",
      icon: "...",
      remark: "地铁",
      amount: -3.00,     // 负数为支出
      typeId: "2",
      payType: 1,
      date: "2024-01-15",
      rawAmount: 3.00
    },
    // ... 更多项目
  ]
}
```

---

## 4. billStore.ts 相关代码

### 4.1 BillItem 类型定义
**位置**: [stores/billStore.ts](stores/billStore.ts) Line 8-21

```typescript
export type BillItem = {
  id: number;
  type: string;
  icon: string;
  remark: string;
  amount: number;          // 支出为负数，收入为正数
  // Extended fields for editing
  typeId: string;          // 类别 ID（字符串）
  date: string;           // 日期
  payType: number;        // 支出类型：1=支出，2=收入
  rawAmount: number;      // 原始金额（总是正数）
};
```

### 4.2 DailyBillGroup 类型定义
**位置**: [stores/billStore.ts](stores/billStore.ts) Line 23-28

```typescript
export type DailyBillGroup = {
  date: string;
  total: number;          // 该日支出额
  income: number;         // 该日收入额
  items: BillItem[];
};
```

### 4.3 transformBillData 函数
**位置**: [stores/billStore.ts](stores/billStore.ts) Line 240-280

```typescript
export const transformBillData = (
  list: DailyBill[],
  getCategoryIcon: (name: string) => string
): DailyBillGroup[] => {
  return list.map((daily: DailyBill) => {
    let dailyTotal = 0;
    let dailyIncome = 0;

    const items: BillItem[] = daily.bills.map((bill: BillDetail) => {
      const amount = parseFloat(bill.amount);
      // 关键：pay_type === '1' 表示支出
      const isExpense = bill.pay_type === '1';
      // 支出显示为负数，收入为正数
      const displayAmount = isExpense ? -amount : amount;

      if (isExpense) {
        dailyTotal += amount;
      } else {
        dailyIncome += amount;
      }

      return {
        id: bill.id,
        type: bill.type_name,
        icon: getCategoryIcon(bill.type_name),
        remark: bill.remark,
        amount: displayAmount,  // ← 核心：-50 表示支出，50 表示收入
        typeId: bill.type_id,
        payType: parseInt(bill.pay_type, 10),
        date: bill.date,
        rawAmount: amount,
      };
    });

    return {
      date: daily.date,
      total: dailyTotal,
      income: dailyIncome,
      items,
    };
  });
};
```

---

## 5. 完整使用示例

### 5.1 ListRefactored.tsx 中的完整流程

```typescript
// 1. 从 Zustand store 获取原始数据
const { rawData, getCategoryIcon } = useBillStore();

// 2. 使用 useMemo 转换数据（避免不必要的重新计算）
const data = useMemo(() => {
  return transformBillData(rawData, getCategoryIcon);
}, [rawData, getCategoryIcon]);

// 3. 渲染函数中使用 BillItem
const renderBillItem = ({ item }: { item: DailyBillGroup }) => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionDate}>{item.date}</Text>
      <Text style={styles.sectionStat}>
        支出: ￥{item.total.toFixed(2)} 收入: ￥{item.income.toFixed(2)}
      </Text>
    </View>
    {item.items.map((subItem: BillItem, index: number) => (
      <BillItem
        key={subItem.id}
        id={subItem.id}
        type={subItem.type}
        icon={subItem.icon}
        remark={subItem.remark}
        amount={subItem.amount}           // 支出为负数，收入为正数
        typeId={subItem.typeId}
        payType={subItem.payType}         // 1=支出，2=收入
        onDeleteSuccess={refreshBills}
        onEdit={handleEdit}
        isLast={index === item.items.length - 1}
      />
    ))}
  </View>
);

// 4. 在 FlatList 中使用
<FlatList
  data={data}
  renderItem={renderBillItem}
  keyExtractor={(item) => item.date}
/>
```

### 5.2 API 数据示例

```typescript
// API 返回的原始数据
const apiResponse = {
  code: 200,
  msg: "success",
  data: {
    totalExpense: 173.50,
    totalIncome: 500.00,
    totalPage: 1,
    list: [
      {
        date: "2024-01-15",
        bills: [
          {
            id: 1,
            pay_type: "1",              // ← 支出
            amount: "50.00",
            date: "2024-01-15",
            type_id: "1",
            type_name: "餐饮",
            remark: "午餐",
            create_time: "2024-01-15T12:00:00.000Z"
          },
          {
            id: 2,
            pay_type: "1",              // ← 支出
            amount: "120.50",
            date: "2024-01-15",
            type_id: "3",
            type_name: "购物",
            remark: "衣服",
            create_time: "2024-01-15T14:30:00.000Z"
          },
          {
            id: 3,
            pay_type: "2",              // ← 收入
            amount: "500.00",
            date: "2024-01-15",
            type_id: "10",
            type_name: "薪资",
            remark: "月工资",
            create_time: "2024-01-15T10:00:00.000Z"
          }
        ]
      }
    ]
  }
};

// 转换后的 BillItem 数据
const transformedData = {
  date: "2024-01-15",
  total: 170.50,        // 支出总额（保持正数）
  income: 500.00,       // 收入总额（保持正数）
  items: [
    {
      id: 1,
      type: "餐饮",
      icon: "restaurant-icon",
      remark: "午餐",
      amount: -50.00,          // ← 负数表示支出
      typeId: "1",
      payType: 1,              // 1 = 支出
      date: "2024-01-15",
      rawAmount: 50.00
    },
    {
      id: 2,
      type: "购物",
      icon: "shopping-icon",
      remark: "衣服",
      amount: -120.50,         // ← 负数表示支出
      typeId: "3",
      payType: 1,              // 1 = 支出
      date: "2024-01-15",
      rawAmount: 120.50
    },
    {
      id: 3,
      type: "薪资",
      icon: "salary-icon",
      remark: "月工资",
      amount: 500.00,          // ← 正数表示收入
      typeId: "10",
      payType: 2,              // 2 = 收入
      date: "2024-01-15",
      rawAmount: 500.00
    }
  ]
};
```

---

## 6. 关键要点总结

| 字段 | 来源 | 说明 | 示例 |
|------|------|------|------|
| **pay_type** | API (BillDetail) | "1"=支出 / "2"=收入 | "1" |
| **payType** | Zustand (BillItem) | 1=支出 / 2=收入（数字） | 1 |
| **amount** | Zustand (BillItem) | 支出为负数，收入为正数 | -50.00 或 500.00 |
| **rawAmount** | Zustand (BillItem) | 原始金额，总是正数 | 50.00 或 500.00 |
| **type_name** | API | 类别名称 | "餐饮" |
| **type** | Zustand (BillItem) | 类别名称（同 type_name） | "餐饮" |

### 记住：
- **收入/支出的标识**: `payType` 字段（1=支出，2=收入）或 `pay_type` 字段（"1"=支出，"2"=收入）
- **显示金额的正负**: `amount` 为负数表示支出，正数表示收入
- **原始金额**: `rawAmount` 始终为正数，不受支出/收入类型影响
- **数据转换**: 通过 `transformBillData()` 函数完成从 API 数据到 UI 数据的转换

---

## 7. 相关文件快速导航

- [components/BillItem.tsx](components/BillItem.tsx) - 组件定义
- [stores/billStore.ts](stores/billStore.ts) - 数据转换和状态管理
- [types/bill.ts](types/bill.ts) - 类型定义
- [pages/ListRefactored.tsx](pages/ListRefactored.tsx) - 推荐的使用示例
- [pages/List.tsx](pages/List.tsx) - 备用实现
- [context/CategoryContext.tsx](context/CategoryContext.tsx) - 类别图标提供者
