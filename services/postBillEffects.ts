import { getActiveAccount } from '../utils/storage';
import {
  checkIn,
  getMilestoneMessage,
  isMotivationEnabled,
  saveStreakCache,
} from './bookkeepingStreak';
import {
  detectBudgetAlerts,
  fetchBudgetProgress,
  loadBudgetListCache,
  loadBudgetProgressCache,
  loadHintShownMap,
  saveBudgetProgressCache,
  saveHintShownMap,
} from './budgets';
import { loadReminderSettings } from './reminderSettings';

// ===== 记账成功后的轻联动：streak 打卡 + 里程碑祝贺 + 预算超支轻提醒 =====
//
// 原则：全部 best-effort，任何失败都不影响记账主流程；激励与提醒均可关闭。

export interface PostBillInfo {
  amount: number;
  category: number;
  categoryName: string;
  date: string; // YYYY-MM-DD
  type: '1' | '2';
}

/**
 * 记账成功（或离线账单补同步成功）后调用。
 * @param notify 轻提示出口（Toast）
 */
export async function runPostBillEffects(
  bill: PostBillInfo,
  notify: (message: string) => void
): Promise<void> {
  try {
    const account = await getActiveAccount();
    if (!account) return;

    // 1. streak 打卡 + 里程碑轻反馈（激励开关控制）
    if (await isMotivationEnabled(account)) {
      const streak = await checkIn([bill.date]);
      if (streak) {
        await saveStreakCache(account, streak);
        for (const level of streak.milestonesReached || []) {
          const message = getMilestoneMessage(level);
          if (message) notify(message);
        }
      }
    }

    // 2. 预算超支轻提醒（仅支出；提醒开关在提醒设置中）
    if (bill.type !== '1') return;
    const settings = await loadReminderSettings(account);
    if (settings.budgetHintEnabled === false) return;

    const month = bill.date.substring(0, 7);

    // 未设置任何预算时跳过，减少无效请求
    const listCache = await loadBudgetListCache(account);
    if (listCache && !listCache.totalBudget && listCache.categoryBudgets.length === 0) {
      return;
    }

    let progress = await fetchBudgetProgress(month);
    if (!progress) {
      progress = await loadBudgetProgressCache(account, month);
    } else {
      await saveBudgetProgressCache(account, progress);
    }
    if (!progress) return;

    const shownMap = await loadHintShownMap(account);
    const alerts = detectBudgetAlerts(progress, shownMap);
    if (alerts.length === 0) return;

    for (const alert of alerts) {
      shownMap[alert.entryKey] = alert.level;
    }
    await saveHintShownMap(account, shownMap);
    // 多条提示合并为一条，避免连续打扰
    notify(alerts.map(alert => alert.message).join('；'));
  } catch (error) {
    console.error('runPostBillEffects failed', error);
  }
}
