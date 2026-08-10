import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { addBill } from '../services/bill';
import {
  RecurringBill,
  advanceCycle,
  buildAddBillParams,
  collectDueDates,
  loadRecurringBills,
  parseDateStr,
  saveRecurringBills,
  todayStr,
} from '../services/recurringBills';
import {
  getActiveAccount,
  getUserPendingBills,
  saveUserPendingBills,
} from '../utils/storage';
import { billRefreshBus } from '../utils/refreshBus';

// 待用户确认的周期账单条目（确认模式）
export interface PendingRecurringItem {
  bill: RecurringBill;
  dueDate: string;
}

/**
 * 推进某条周期账单的 nextDueDate（以 startDate 的"号"为锚点）
 */
function advanceBill(bill: RecurringBill, dueDate: string): RecurringBill {
  const anchorDay = parseDateStr(bill.startDate)?.getDate();
  return {
    ...bill,
    nextDueDate: advanceCycle(dueDate, bill.cycle, anchorDay),
  };
}

/**
 * 生成一笔周期账单：优先调用 addBill；失败时写入离线待同步队列，
 * 由 List 页的重试逻辑后续补同步（复用现有 addBill 链路）。
 */
async function generateBill(bill: RecurringBill, dueDate: string): Promise<void> {
  const params = buildAddBillParams(bill, dueDate);
  const localId = `recurring_${bill.id}_${dueDate}`;

  try {
    const res = await addBill({ ...params, client_local_id: localId });
    if (res.code !== 200) {
      throw new Error(res.msg || '周期账单生成失败');
    }
  } catch (error) {
    console.error('Failed to generate recurring bill, enqueue for retry', error);

    const account = await getActiveAccount();
    if (!account) return;

    const pending = await getUserPendingBills(account);
    const item = {
      id: -Date.now(),
      type: bill.categoryName,
      icon: bill.categoryIcon || 'icon-qianming',
      remark: params.remark || '',
      amount: bill.type === '1' ? -bill.amount : bill.amount,
      typeId: bill.categoryId,
      date: String(params.date),
      payType: bill.type,
      rawAmount: bill.amount,
      syncStatus: 'failed',
      localId,
      retryParams: { ...params, client_local_id: localId },
    };
    await saveUserPendingBills(account, [
      item,
      ...pending.filter(p => p.localId !== localId),
    ]);
  }
}

/**
 * 周期账单运行器：App 启动 / 回到前台时检查到期的周期账单。
 * - 静默模式：自动生成并推进到期日；
 * - 确认模式：收集待确认条目，由 UI 引导用户确认或跳过。
 */
export function useRecurringBillRunner() {
  const [pendingConfirms, setPendingConfirms] = useState<PendingRecurringItem[]>([]);
  // 静默生成的提示文案（由 UI 以 Toast 展示）
  const [silentToast, setSilentToast] = useState<string | null>(null);
  const runningRef = useRef(false);

  const run = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;

    try {
      const account = await getActiveAccount();
      if (!account) return;

      const bills = await loadRecurringBills(account);
      if (bills.length === 0) return;

      const today = todayStr();
      const confirmItems: PendingRecurringItem[] = [];
      let nextBills = bills.map(b => ({ ...b }));
      let silentCount = 0;
      let changed = false;

      for (let i = 0; i < nextBills.length; i++) {
        const dueDates = collectDueDates(nextBills[i], today);
        if (dueDates.length === 0) continue;

        for (const dueDate of dueDates) {
          if (nextBills[i].mode === 'silent') {
            await generateBill(nextBills[i], dueDate);
            silentCount += 1;
          } else {
            confirmItems.push({ bill: nextBills[i], dueDate });
          }
          // 无论哪种模式，都先推进到期日，避免重复处理
          nextBills[i] = advanceBill(nextBills[i], dueDate);
        }
        changed = true;
      }

      if (changed) {
        await saveRecurringBills(account, nextBills);
      }

      if (silentCount > 0) {
        setSilentToast(`已自动生成 ${silentCount} 笔周期账单`);
        billRefreshBus.notify();
      }
      if (confirmItems.length > 0) {
        setPendingConfirms(confirmItems);
      }
    } catch (error) {
      console.error('Recurring bill runner error', error);
    } finally {
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    run();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') run();
    });
    return () => subscription.remove();
  }, [run]);

  // 确认模式：用户确认生成全部待确认账单
  const confirmAll = useCallback(async () => {
    const items = pendingConfirms;
    setPendingConfirms([]);
    if (items.length === 0) return;

    for (const item of items) {
      await generateBill(item.bill, item.dueDate);
    }
    billRefreshBus.notify();
  }, [pendingConfirms]);

  // 确认模式：本次跳过（到期日已在 run 中推进，不会重复弹窗）
  const skipAll = useCallback(() => {
    setPendingConfirms([]);
  }, []);

  const clearSilentToast = useCallback(() => setSilentToast(null), []);

  return { pendingConfirms, confirmAll, skipAll, silentToast, clearSilentToast };
}
