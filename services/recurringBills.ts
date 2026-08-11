import AsyncStorage from '@react-native-async-storage/async-storage';
import { AddBillParams } from '../types/bill';
import { markConfigChanged, markConfigRemoved } from './configSync';

// ===== 类型定义 =====

export type RecurringCycle = 'weekly' | 'monthly' | 'yearly';

// 生成模式：confirm=到期需用户确认；silent=到期自动静默记账
export type RecurringMode = 'confirm' | 'silent';

export interface RecurringBill {
  id: string;
  // 名称（如：房租、话费）
  name: string;
  amount: number;
  categoryId: number;
  categoryName: string;
  categoryIcon?: string;
  type: '1' | '2'; // '1': 支出, '2': 收入
  cycle: RecurringCycle;
  // 起始日 YYYY-MM-DD（也是周期锚点，如每月 31 号）
  startDate: string;
  mode: RecurringMode;
  paused: boolean;
  // 下一次应生成账单的日期 YYYY-MM-DD
  nextDueDate: string;
  createdAt: number;
}

export const CYCLE_LABELS: Record<RecurringCycle, string> = {
  weekly: '每周',
  monthly: '每月',
  yearly: '每年',
};

export const MODE_LABELS: Record<RecurringMode, string> = {
  confirm: '确认模式',
  silent: '静默模式',
};

// 用户隔离的周期账单存储 key 前缀
const RECURRING_BILLS_PREFIX = 'recurring_bills_user';
// 单次运行最多补生成的期数，防止异常数据导致死循环
const MAX_CATCHUP_PER_RUN = 36;

export const getRecurringBillsKey = (account: string) =>
  `${RECURRING_BILLS_PREFIX}:${account}`;

// ===== 日期工具（纯函数，便于单测） =====

export function formatDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateStr(dateStr: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const date = new Date(
    parseInt(match[1], 10),
    parseInt(match[2], 10) - 1,
    parseInt(match[3], 10)
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

export function todayStr(now: Date = new Date()): string {
  return formatDateStr(now);
}

/**
 * 推进一个周期，返回下一次到期日。
 * monthly/yearly 以 anchorDay（起始日的"号"）为锚点，月末自动收敛
 * （如 1-31 → 2-28 → 3-28）；weekly 固定 +7 天。
 */
export function advanceCycle(
  dateStr: string,
  cycle: RecurringCycle,
  anchorDay?: number
): string {
  const base = parseDateStr(dateStr);
  if (!base) return dateStr;

  if (cycle === 'weekly') {
    return formatDateStr(
      new Date(base.getFullYear(), base.getMonth(), base.getDate() + 7)
    );
  }

  const anchor = anchorDay ?? base.getDate();
  let year = base.getFullYear();
  let month = base.getMonth() + (cycle === 'monthly' ? 1 : 12);
  year += Math.floor(month / 12);
  month = month % 12;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return formatDateStr(new Date(year, month, Math.min(anchor, daysInMonth)));
}

/**
 * 收集某周期账单所有已到期（<= today）的账期日，按时间升序。
 * 暂停中的账单返回空列表。
 */
export function collectDueDates(bill: RecurringBill, today: string): string[] {
  if (bill.paused) return [];

  const anchorDay = parseDateStr(bill.startDate)?.getDate();
  const dates: string[] = [];
  let due = bill.nextDueDate;

  while (due && due <= today && dates.length < MAX_CATCHUP_PER_RUN) {
    dates.push(due);
    due = advanceCycle(due, bill.cycle, anchorDay);
  }

  return dates;
}

/**
 * 生成某账期对应的记账参数（复用现有 addBill 链路）。
 * remark 携带结构化标记 `[周期]{name}|cfg:{id}|due:{账期}`，
 * 后端据此按 (用户, 配置 id, 账期) 维度幂等去重（见 BACKEND_API_P3.md 3.3）。
 */
export function buildAddBillParams(bill: RecurringBill, dueDate: string): AddBillParams {
  return {
    amount: bill.amount.toFixed(2),
    type_id: bill.categoryId,
    type_name: bill.categoryName,
    date: new Date(dueDate).getTime(),
    pay_type: bill.type,
    remark: `[周期]${bill.name}|cfg:${bill.id}|due:${dueDate}`,
  };
}

/**
 * 展示层清理：去除 remark 中的结构化防重标记（cfg/due 段），
 * 兼容无标记的历史数据与手动记账。
 */
export function cleanRecurringRemark(remark: string): string {
  if (!remark) return remark;
  return remark
    .split('|')
    .filter(segment => !/^cfg:/.test(segment) && !/^due:/.test(segment))
    .join('|');
}

export function generateRecurringId(): string {
  return `recurring_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ===== 持久化（用户隔离，key 带 account 前缀） =====

export async function loadRecurringBills(account: string): Promise<RecurringBill[]> {
  try {
    const raw = await AsyncStorage.getItem(getRecurringBillsKey(account));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load recurring bills', error);
    return [];
  }
}

export async function saveRecurringBills(
  account: string,
  bills: RecurringBill[]
): Promise<void> {
  await AsyncStorage.setItem(getRecurringBillsKey(account), JSON.stringify(bills));
}

export async function upsertRecurringBill(
  account: string,
  bill: RecurringBill
): Promise<void> {
  const bills = await loadRecurringBills(account);
  const index = bills.findIndex(b => b.id === bill.id);
  if (index >= 0) {
    bills[index] = bill;
  } else {
    bills.unshift(bill);
  }
  await saveRecurringBills(account, bills);
  await markConfigChanged(account, 'recurring_bill', bill.id);
}

export async function deleteRecurringBill(
  account: string,
  id: string
): Promise<void> {
  const bills = await loadRecurringBills(account);
  await saveRecurringBills(account, bills.filter(b => b.id !== id));
  await markConfigRemoved(account, 'recurring_bill', id);
}
