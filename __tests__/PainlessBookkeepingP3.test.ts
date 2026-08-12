import {
  cleanRecurringRemark,
} from '../services/recurringBills';
import {
  MILESTONE_LEVELS,
  getMilestoneMessage,
} from '../services/bookkeepingStreak';
import {
  BudgetProgressData,
  buildHintEntryKey,
  detectBudgetAlerts,
} from '../services/budgets';
import {
  SyncItem,
  SyncMetaMap,
  getSyncItemKey,
  mergeSyncItems,
  pickReminderSettingsItem,
} from '../services/configSync';

describe('周期账单：remark 结构化防重标记', () => {
  it('展示层应去除 cfg/due 防重段', () => {
    expect(
      cleanRecurringRemark('[周期]房租|cfg:recurring_123|due:2026-08-01')
    ).toBe('[周期]房租');
  });

  it('无标记的历史数据与手动记账 remark 保持不变', () => {
    expect(cleanRecurringRemark('[周期]房租')).toBe('[周期]房租');
    expect(cleanRecurringRemark('午饭 麦当劳')).toBe('午饭 麦当劳');
  });

  it('空 remark 不报错', () => {
    expect(cleanRecurringRemark('')).toBe('');
  });
});

describe('习惯激励：里程碑文案', () => {
  it('每个档位都有对应祝贺文案', () => {
    for (const level of MILESTONE_LEVELS) {
      expect(getMilestoneMessage(level)).toBeTruthy();
    }
  });

  it('未知档位返回 null', () => {
    expect(getMilestoneMessage(15)).toBeNull();
  });
});

const makeProgress = (overrides: Partial<BudgetProgressData> = {}): BudgetProgressData => ({
  month: '2026-08',
  totalBudget: null,
  categoryBudgets: [],
  ...overrides,
});

describe('预算辅助：超支检测（纯函数）', () => {
  it('未达 80% 不提醒', () => {
    const alerts = detectBudgetAlerts(
      makeProgress({ totalBudget: { amount: 1000, used: 700, ratio: 0.7 } }),
      {}
    );
    expect(alerts).toEqual([]);
  });

  it('达到 80% 触发 warn，达到 100% 触发 over', () => {
    const warnAlerts = detectBudgetAlerts(
      makeProgress({ totalBudget: { amount: 1000, used: 850, ratio: 0.85 } }),
      {}
    );
    expect(warnAlerts).toHaveLength(1);
    expect(warnAlerts[0].level).toBe('warn');

    const overAlerts = detectBudgetAlerts(
      makeProgress({ totalBudget: { amount: 1000, used: 1100, ratio: 1.1 } }),
      {}
    );
    expect(overAlerts).toHaveLength(1);
    expect(overAlerts[0].level).toBe('over');
  });

  it('同档位每月只提示一次（去重）', () => {
    const progress = makeProgress({
      totalBudget: { amount: 1000, used: 850, ratio: 0.85 },
    });
    const key = buildHintEntryKey('2026-08', 'total');
    const shown = { [key]: 'warn' as const };
    expect(detectBudgetAlerts(progress, shown)).toEqual([]);
  });

  it('已提示 warn 后仍可提示 over', () => {
    const progress = makeProgress({
      totalBudget: { amount: 1000, used: 1050, ratio: 1.05 },
    });
    const key = buildHintEntryKey('2026-08', 'total');
    const shown = { [key]: 'warn' as const };
    const alerts = detectBudgetAlerts(progress, shown);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe('over');
  });

  it('分类预算与总预算可同时检测', () => {
    const progress = makeProgress({
      totalBudget: { amount: 5000, used: 4200, ratio: 0.84 },
      categoryBudgets: [
        { categoryId: 3, categoryName: '餐饮', amount: 2000, used: 2100, ratio: 1.05 },
        { categoryId: 4, categoryName: '交通', amount: 500, used: 100, ratio: 0.2 },
      ],
    });
    const alerts = detectBudgetAlerts(progress, {});
    expect(alerts.map(a => a.level)).toEqual(['warn', 'over']);
    expect(alerts[1].message).toContain('餐饮');
  });
});

describe('配置同步：合并逻辑（LWW + 软删）', () => {
  interface FakeConfig {
    id: string;
    name: string;
  }

  const makeItem = (
    id: string,
    name: string,
    updatedAt: number,
    deleted = false
  ): SyncItem => ({
    type: 'recurring_bill',
    id,
    payload: { id, name },
    deleted,
    updatedAt,
  });

  it('远端新增条目合并进本地', () => {
    const local: FakeConfig[] = [{ id: 'a', name: 'A' }];
    const result = mergeSyncItems<FakeConfig>(
      'recurring_bill',
      local,
      [makeItem('b', 'B', 100)],
      {}
    );
    expect(result.changed).toBe(true);
    expect(result.list.map(i => i.id)).toEqual(['b', 'a']);
    expect(result.applied).toEqual([
      { key: getSyncItemKey('recurring_bill', 'b'), updatedAt: 100 },
    ]);
  });

  it('远端更新覆盖本地旧版本', () => {
    const local: FakeConfig[] = [{ id: 'a', name: '旧' }];
    const result = mergeSyncItems<FakeConfig>(
      'recurring_bill',
      local,
      [makeItem('a', '新', 200)],
      { [getSyncItemKey('recurring_bill', 'a')]: 100 }
    );
    expect(result.list[0].name).toBe('新');
  });

  it('本地 meta 更新时跳过远端旧版本（LWW）', () => {
    const local: FakeConfig[] = [{ id: 'a', name: '本地新' }];
    const result = mergeSyncItems<FakeConfig>(
      'recurring_bill',
      local,
      [makeItem('a', '远端旧', 100)],
      { [getSyncItemKey('recurring_bill', 'a')]: 300 }
    );
    expect(result.changed).toBe(false);
    expect(result.list[0].name).toBe('本地新');
    expect(result.applied).toEqual([]);
  });

  it('远端与本地完全一致时不产生变更（避免重复 pull 空转）', () => {
    const local: FakeConfig[] = [{ id: 'a', name: 'A' }];
    const result = mergeSyncItems<FakeConfig>(
      'recurring_bill',
      local,
      [makeItem('a', 'A', 100)],
      { [getSyncItemKey('recurring_bill', 'a')]: 100 }
    );
    expect(result.changed).toBe(false);
    expect(result.applied).toEqual([]);
  });

  it('updatedAt 相同但内容不同时仍以远端为准', () => {
    const local: FakeConfig[] = [{ id: 'a', name: '旧' }];
    const result = mergeSyncItems<FakeConfig>(
      'recurring_bill',
      local,
      [makeItem('a', '新', 100)],
      { [getSyncItemKey('recurring_bill', 'a')]: 100 }
    );
    expect(result.changed).toBe(true);
    expect(result.list[0].name).toBe('新');
  });

  it('软删条目从本地移除', () => {
    const local: FakeConfig[] = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ];
    const result = mergeSyncItems<FakeConfig>(
      'recurring_bill',
      local,
      [makeItem('a', 'A', 500, true)],
      {}
    );
    expect(result.list.map(i => i.id)).toEqual(['b']);
  });

  it('只处理对应类型的条目', () => {
    const local: FakeConfig[] = [];
    const item = makeItem('x', 'X', 100);
    item.type = 'bill_template';
    const result = mergeSyncItems<FakeConfig>('recurring_bill', local, [item], {});
    expect(result.changed).toBe(false);
    expect(result.list).toEqual([]);
  });
});

describe('配置同步：提醒设置单例挑选', () => {
  const meta: SyncMetaMap = {};

  it('取最新的远端提醒设置', () => {
    const items: SyncItem[] = [
      {
        type: 'reminder_settings',
        id: 'default',
        payload: { enabled: false, hour: 20, minute: 0, missedDetectEnabled: true },
        deleted: false,
        updatedAt: 100,
      },
      {
        type: 'reminder_settings',
        id: 'default',
        payload: { enabled: true, hour: 22, minute: 0, missedDetectEnabled: false },
        deleted: false,
        updatedAt: 200,
      },
    ];
    const picked = pickReminderSettingsItem(items, meta);
    expect(picked?.payload).toMatchObject({ enabled: true, hour: 22 });
    expect(picked?.deleted).toBe(false);
  });

  it('远端删除时 payload 为 null（本地应重置默认）', () => {
    const items: SyncItem[] = [
      { type: 'reminder_settings', id: 'default', deleted: true, updatedAt: 300 },
    ];
    const picked = pickReminderSettingsItem(items, meta);
    expect(picked?.deleted).toBe(true);
    expect(picked?.payload).toBeNull();
  });

  it('本地更新时忽略远端旧版本', () => {
    const items: SyncItem[] = [
      {
        type: 'reminder_settings',
        id: 'default',
        payload: { enabled: true, hour: 18, minute: 0, missedDetectEnabled: true },
        deleted: false,
        updatedAt: 100,
      },
    ];
    const localMeta: SyncMetaMap = {
      [getSyncItemKey('reminder_settings', 'default')]: 500,
    };
    expect(pickReminderSettingsItem(items, localMeta)).toBeNull();
  });
});
