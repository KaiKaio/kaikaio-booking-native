# 用户隔离离线账单实现方案

## 实现概述

实现了用户隔离的离线队列存储,确保:
1. Token 过期(401)时离线账单数据不丢失
2. 多用户切换时离线数据互不污染
3. 用户重新登录后自动恢复并继续同步离线数据

## 修改文件清单

### 1. `utils/storage.ts` - 新增用户隔离存储方法

**新增功能:**
- `getUserPendingBillsKey(account)` - 生成用户隔离的存储 key: `pending_bills_user:{account}`
- `getActiveAccount()` - 获取当前活跃账号
- `saveUserPendingBills(account, bills)` - 保存用户隔离的待同步账单
- `getUserPendingBills(account)` - 获取用户隔离的待同步账单
- `removeUserPendingBills(account)` - 清除指定用户的待同步账单
- `clearAllUserPendingBills()` - 清除所有用户的待同步账单(用于清理遗留数据)

**存储格式:**
```
旧的: pendingOptimisticBills -> [所有用户的账单]
新的: pending_bills_user:{account} -> [该用户的账单]
```

### 2. `request.ts` - 修改 401 处理逻辑

**核心改动:**
- ❌ 不再调用 `clearUserLocalData()` (会清除所有数据)
- ✅ 只清除认证相关数据: `token`, `user_credentials`, `categories_cache`, `lastSelectedDate`
- ✅ 清除月度缓存 `bills_month_cache_*` (避免数据过大)
- ✅ **保留** `pending_bills_user:{account}` 离线账单数据
- ✅ 添加日志: `401: 已清除认证数据,保留离线账单数据`

### 3. `pages/List.tsx` - 使用用户隔离存储

**核心改动:**
```typescript
// 旧代码
await AsyncStorage.getItem(PENDING_BILLS_STORAGE_KEY)
await AsyncStorage.setItem(PENDING_BILLS_STORAGE_KEY, JSON.stringify(bills))

// 新代码
const account = await getActiveAccount()
await getUserPendingBills(account)
await saveUserPendingBills(account, bills)
```

### 4. `pages/Login.tsx` - 登录时智能处理

**核心逻辑:**
```typescript
const isSwitchingAccount = previousAccount && previousAccount !== account
const isFirstLogin = !previousAccount && !!oldToken

if (isSwitchingAccount) {
  // 切换账号: 保留旧用户的离线数据,只清除认证数据
  await AsyncStorage.multiRemove([
    TOKEN_STORAGE_KEY,
    USER_CREDENTIALS_STORAGE_KEY,
    ACTIVE_ACCOUNT_STORAGE_KEY,
  ])
  console.log(`检测到切换账号: ${previousAccount} -> ${account}`)
  console.log('旧用户的离线数据已保留,等待其重新登录时自动恢复')
} else if (isFirstLogin) {
  // 首次登录或有旧 token: 清除所有数据
  await clearUserLocalData()
}
```

### 5. `pages/Account.tsx` - 登出时保留离线数据

**核心改动:**
- ❌ 不再调用 `clearUserLocalData()`
- ✅ 只清除认证数据,保留 `pending_bills_user:{account}`
- ✅ 添加日志记录保留的离线数据

## 数据流图

### 场景 1: Token 过期 (401)

```
用户正在使用 App (离线记账)
    ↓
Token 过期,接口返回 401
    ↓
request.ts: 清除认证数据,保留离线账单
    ↓
跳转到登录页
    ↓
用户看到离线记账的数据 (还在列表中)
    ↓
用户重新登录
    ↓
Login.tsx: 检测到同一账号
    ↓
List.tsx: 自动加载之前的离线数据
    ↓
继续同步到服务器
```

### 场景 2: 切换账号

```
用户 A 登录并使用
    ↓
用户 A 退出登录 / 切换账号
    ↓
Account.tsx: 清除认证数据,保留 pending_bills_user:A
    ↓
用户 B 登录
    ↓
Login.tsx: 检测到切换账号
    ↓
只清除认证数据,保留 pending_bills_user:A
    ↓
用户 B 使用 (使用 pending_bills_user:B 的数据)
    ↓
用户 A 重新登录
    ↓
Login.tsx: 检测到切换回用户 A
    ↓
List.tsx: 自动加载 pending_bills_user:A
    ↓
用户 A 看到之前的离线数据
```

### 场景 3: 首次登录 / 重新安装

```
新用户或清除数据后
    ↓
没有 previousAccount,有旧 token (异常场景)
    ↓
Login.tsx: isFirstLogin = true
    ↓
调用 clearUserLocalData() 清除所有数据
    ↓
正常登录
```

## 测试场景

### ✅ 测试 1: Token 过期后离线数据不丢失

1. 登录账号 A
2. 关闭网络 (飞行模式)
3. 添加 3 条离线账单
4. 等待 Token 过期 (或模拟 401 响应)
5. 尝试同步 → 触发 401
6. **预期**: 跳转到登录页,但离线数据已保留
7. 重新登录账号 A
8. **预期**: 3 条离线账单还在,并自动同步

### ✅ 测试 2: 多用户切换不污染数据

1. 登录账号 A,添加 2 条离线账单 (无网络)
2. 退出登录
3. 登录账号 B
4. **预期**: 看不到账号 A 的离线账单
5. 退出登录,重新登录账号 A
6. **预期**: 看到之前的 2 条离线账单

### ✅ 测试 3: 正常同步流程

1. 登录账号 A
2. 关闭网络
3. 添加离线账单
4. 恢复网络
5. **预期**: 账单自动同步,状态从 `syncing` → `synced`

### ✅ 测试 4: 同步失败重试

1. 添加离线账单
2. 同步失败 (网络错误或服务器错误)
3. **预期**: 账单状态标记为 `failed`,可手动重试

## AsyncStorage Key 说明

### 认证相关 (401/登出时清除)
- `token` - 认证 token
- `user_credentials` - 记住密码的账号密码
- `categories_cache` - 分类缓存
- `lastSelectedDate` - 最后选择的日期
- `bills_month_cache_YYYY-MM` - 月度账单缓存

### 离线账单 (用户隔离,不清除)
- `pending_bills_user:{account}` - 用户隔离的待同步账单

### 遗留兼容 (未来版本可删除)
- `pendingOptimisticBills` - 旧的全局待同步账单 key

## 注意事项

1. **旧数据迁移**: 旧的 `pendingOptimisticBills` 数据不会自动迁移,如果需要可使用 `clearAllUserPendingBills()` 清理

2. **账号标识**: 使用登录时的 `account` (用户名) 作为用户隔离标识,确保唯一性

3. **存储空间**: 定期清理月度缓存 `bills_month_cache_*`,避免数据过大

4. **竞态条件**: 登录时使用 `await` 确保存储操作完成后再跳转页面

5. **错误处理**: 所有存储操作都有 try-catch,失败时返回空数组或记录日志

## 后续优化建议

1. **数据迁移工具**: 提供从 `pendingOptimisticBills` 迁移到用户隔离存储的工具函数

2. **存储压缩**: 对离线账单进行压缩后再存储,减少占用空间

3. **过期清理**: 添加离线账单的过期时间戳,定期清理超过 N 天的数据

4. **监控告警**: 添加离线队列长度的监控,超过阈值时提醒用户同步

5. **冲突解决**: 实现服务端数据与离线数据的冲突检测和合并策略
