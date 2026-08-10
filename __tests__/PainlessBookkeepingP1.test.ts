import {
  advanceCycle,
  collectDueDates,
  buildAddBillParams,
  parseDateStr,
  RecurringBill,
} from '../services/recurringBills';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addTemplate,
  loadTemplates,
  removeTemplate,
  touchTemplate,
} from '../services/billTemplates';
import { loadReminderSettings, saveReminderSettings } from '../services/reminderSettings';

const makeRecurringBill = (overrides: Partial<RecurringBill> = {}): RecurringBill => ({
  id: 'r1',
  name: '房租',
  amount: 2000,
  categoryId: 5,
  categoryName: '居住',
  type: '1',
  cycle: 'monthly',
  startDate: '2026-01-01',
  mode: 'silent',
  paused: false,
  nextDueDate: '2026-01-01',
  createdAt: 0,
  ...overrides,
});

describe('周期账单：周期推进', () => {
  it('每周固定 +7 天', () => {
    expect(advanceCycle('2026-08-03', 'weekly')).toBe('2026-08-10');
    // 跨月
    expect(advanceCycle('2026-08-28', 'weekly')).toBe('2026-09-04');
  });

  it('每月以起始日"号"为锚点推进，月末自动收敛', () => {
    expect(advanceCycle('2026-01-15', 'monthly')).toBe('2026-02-15');
    // 31 号锚点：2 月收敛到 28 号
    expect(advanceCycle('2026-01-31', 'monthly', 31)).toBe('2026-02-28');
    // 跨年
    expect(advanceCycle('2026-12-15', 'monthly')).toBe('2027-01-15');
  });

  it('每年推进，闰日自动收敛', () => {
    expect(advanceCycle('2026-03-01', 'yearly')).toBe('2027-03-01');
    expect(advanceCycle('2024-02-29', 'yearly', 29)).toBe('2025-02-28');
  });

  it('非法日期原样返回', () => {
    expect(advanceCycle('not-a-date', 'monthly')).toBe('not-a-date');
  });
});

describe('周期账单：到期收集', () => {
  it('应补齐所有已到期的账期（升序）', () => {
    const bill = makeRecurringBill({ nextDueDate: '2026-05-01' });
    const dues = collectDueDates(bill, '2026-08-10');
    expect(dues).toEqual(['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01']);
  });

  it('未到期的账期不收集', () => {
    const bill = makeRecurringBill({ nextDueDate: '2026-09-01' });
    expect(collectDueDates(bill, '2026-08-10')).toEqual([]);
  });

  it('暂停中的账单不收集', () => {
    const bill = makeRecurringBill({ nextDueDate: '2026-05-01', paused: true });
    expect(collectDueDates(bill, '2026-08-10')).toEqual([]);
  });

  it('每周账单按 7 天步长收集', () => {
    const bill = makeRecurringBill({ cycle: 'weekly', nextDueDate: '2026-08-01' });
    const dues = collectDueDates(bill, '2026-08-15');
    expect(dues).toEqual(['2026-08-01', '2026-08-08', '2026-08-15']);
  });
});

describe('周期账单：记账参数构建', () => {
  it('应复用 addBill 参数结构并带上周期备注', () => {
    const bill = makeRecurringBill();
    const params = buildAddBillParams(bill, '2026-08-01');
    expect(params.amount).toBe('2000.00');
    expect(params.type_id).toBe(5);
    expect(params.type_name).toBe('居住');
    expect(params.pay_type).toBe('1');
    expect(params.remark).toBe('[周期]房租');
    expect(params.date).toBe(new Date('2026-08-01').getTime());
  });
});

describe('快捷模板（用户隔离持久化）', () => {
  const account = 'test-user';

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('新增后可读取，最近使用的排最前', async () => {
    await addTemplate(account, {
      name: '早餐',
      amount: 12,
      categoryId: 1,
      categoryName: '餐饮',
      categoryIcon: 'icon-canyin',
      type: '1',
    });
    await addTemplate(account, {
      name: '地铁',
      amount: 4,
      categoryId: 2,
      categoryName: '交通',
      categoryIcon: 'icon-jiaotong',
      type: '1',
    });

    let list = await loadTemplates(account);
    expect(list.map(t => t.name)).toEqual(['地铁', '早餐']);

    // 使用「早餐」后应排到最前
    await touchTemplate(account, list.find(t => t.name === '早餐')!.id);
    list = await loadTemplates(account);
    expect(list.map(t => t.name)).toEqual(['早餐', '地铁']);
  });

  it('删除后列表更新', async () => {
    const created = await addTemplate(account, {
      name: '咖啡',
      amount: 20,
      categoryId: 1,
      categoryName: '餐饮',
      categoryIcon: 'icon-canyin',
      type: '1',
    });
    const next = await removeTemplate(account, created.id);
    expect(next).toEqual([]);
  });

  it('不同账号数据隔离', async () => {
    await addTemplate(account, {
      name: '早餐',
      amount: 12,
      categoryId: 1,
      categoryName: '餐饮',
      categoryIcon: 'icon-canyin',
      type: '1',
    });
    const otherList = await loadTemplates('another-user');
    expect(otherList).toEqual([]);
  });
});

describe('漏记提醒设置', () => {
  const account = 'test-user';

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('未设置时返回默认值', async () => {
    const settings = await loadReminderSettings(account);
    expect(settings.enabled).toBe(false);
    expect(settings.hour).toBe(21);
    expect(settings.missedDetectEnabled).toBe(true);
  });

  it('保存后可读取，且与默认值合并', async () => {
    await saveReminderSettings(account, {
      enabled: true,
      hour: 22,
      minute: 0,
      missedDetectEnabled: false,
    });
    const settings = await loadReminderSettings(account);
    expect(settings.enabled).toBe(true);
    expect(settings.hour).toBe(22);
    expect(settings.missedDetectEnabled).toBe(false);
  });
});

describe('日期工具', () => {
  it('parseDateStr 应正确解析合法/非法日期', () => {
    const date = parseDateStr('2026-08-10');
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(7);
    expect(date?.getDate()).toBe(10);
    expect(parseDateStr('2026/08/10')).toBeNull();
    expect(parseDateStr('')).toBeNull();
  });
});
