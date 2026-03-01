import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBillList, addBill, updateBill } from '../services/bill';
import { BillDetail, DailyBill } from '../types/bill';

// ===== 类型定义 =====

export type BillItem = {
  id: number;
  type: string;
  icon: string;
  remark: string;
  amount: number;
  // Extended fields for editing
  typeId: string;
  date: string;
  payType: number;
  rawAmount: number;
};

export type DailyBillGroup = {
  date: string;
  total: number;
  income: number;
  items: BillItem[];
};

type BillStoreState = {
  // 列表数据（原始数据）
  rawData: DailyBill[];

  // 筛选和排序状态
  currentDate: string;
  orderBy: 'ASC' | 'DESC';

  // 统计摘要
  summary: { totalExpense: number; totalIncome: number };

  // 加载状态
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;

  // 编辑状态
  editingId: number | null;
  isSubmitting: boolean;

  // ===== Actions =====

  // 设置当前日期
  setCurrentDate: (date: string) => Promise<void>;

  // 切换排序
  toggleOrderBy: () => void;

  // 加载账单列表
  fetchBills: () => Promise<void>;

  // 下拉刷新
  refreshBills: () => Promise<void>;

  // 开始编辑
  startEdit: (id: number) => BillItem | null;

  // 取消编辑
  cancelEdit: () => void;

  // 提交账单（新增或更新）
  submitBill: (billData: SubmitBillData) => Promise<void>;

  // 清除错误
  clearError: () => void;
};

export type SubmitBillData = {
  amount: number;
  category: string;
  categoryName: string;
  date: string;
  remark: string;
  type: number;
};

// ===== 创建 Store =====

export const useBillStore = create<BillStoreState>((set, get) => ({
  // 初始状态
  rawData: [],
  currentDate: (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })(),
  orderBy: 'DESC',
  summary: { totalExpense: 0, totalIncome: 0 },
  isLoading: false,
  isRefreshing: false,
  error: null,
  editingId: null,
  isSubmitting: false,

  // ===== Actions =====

  setCurrentDate: async (date: string) => {
    set({ currentDate: date });
    // 保存到持久化存储
    try {
      await AsyncStorage.setItem('lastSelectedDate', date);
    } catch (e) {
      console.error('Failed to save date', e);
    }
    // 加载新日期的数据
    get().fetchBills();
  },

  toggleOrderBy: () => {
    const { orderBy } = get();
    set({ orderBy: orderBy === 'ASC' ? 'DESC' : 'ASC' });
  },

  fetchBills: async () => {
    const { currentDate, orderBy, isLoading } = get();

    // 防止重复加载
    if (isLoading) return;

    set({ isLoading: true, error: null });

    try {
      const [year, month] = currentDate.split('-');
      const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();

      const start = `${currentDate}-01 00:00:00`;
      const end = `${currentDate}-${lastDay} 23:59:59`;

      // 延时 300ms，等待 orderBy 更新
      await new Promise(resolve => setTimeout(resolve, 300));

      const res = await getBillList({
        start,
        end,
        page: 1,
        page_size: 1000,
        orderBy,
      });

      if (res.code === 200) {
        set({
          rawData: res.data.list,
          summary: {
            totalExpense: res.data.totalExpense,
            totalIncome: res.data.totalIncome,
          },
        });
      } else {
        set({ error: res.msg || '加载失败' });
      }
    } catch (error: any) {
      console.error('Fetch bills error:', error);
      set({ error: error.message || '网络错误' });
    } finally {
      set({ isLoading: false });
    }
  },

  refreshBills: async () => {
    set({ isRefreshing: true });
    await get().fetchBills();
    set({ isRefreshing: false });
  },

  startEdit: (id: number) => {
    const { rawData } = get();

    let targetItem: BillItem | undefined;
    for (const daily of rawData) {
      const bill = daily.bills.find(b => b.id === id);
      if (bill) {
        const amount = parseFloat(bill.amount);
        const isExpense = bill.pay_type === '1';
        const displayAmount = isExpense ? -amount : amount;

        targetItem = {
          id: bill.id,
          type: bill.type_name,
          icon: '', // icon 将在组件中设置
          remark: bill.remark,
          amount: displayAmount,
          typeId: bill.type_id,
          payType: parseInt(bill.pay_type, 10),
          date: bill.date,
          rawAmount: amount,
        };
        break;
      }
    }

    if (targetItem) {
      set({ editingId: id });
      return targetItem;
    }

    return null;
  },

  cancelEdit: () => {
    set({ editingId: null });
  },

  submitBill: async (billData: SubmitBillData) => {
    const { editingId } = get();
    set({ isSubmitting: true, error: null });

    try {
      const timestamp = new Date(billData.date).getTime();
      const params = {
        amount: billData.amount.toFixed(2),
        type_id: parseInt(billData.category, 10),
        type_name: billData.categoryName,
        date: timestamp,
        pay_type: billData.type,
        remark: billData.remark || '',
      };

      if (editingId) {
        await updateBill({ ...params, id: editingId });
      } else {
        await addBill(params);
      }

      // 刷新列表
      await get().fetchBills();
      set({ editingId: null });
    } catch (error: any) {
      console.error('Submit bill error:', error);
      set({ error: error.message || (editingId ? '修改失败' : '记账失败') });
      throw error;
    } finally {
      set({ isSubmitting: false });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));

// ===== 数据转换工具（在组件中使用） =====

export const transformBillData = (
  list: DailyBill[],
  getCategoryIcon: (name: string) => string
): DailyBillGroup[] => {
  return list.map((daily: DailyBill) => {
    let dailyTotal = 0;
    let dailyIncome = 0;

    const items: BillItem[] = daily.bills.map((bill: BillDetail) => {
      const amount = parseFloat(bill.amount);
      const isExpense = bill.pay_type === '1';
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
        amount: displayAmount,
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
