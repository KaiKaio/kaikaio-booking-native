import AsyncStorage from '@react-native-async-storage/async-storage';
import request from '../request';
import {
  BillListResponse,
  BillParams,
  EarliestItemDateResponse,
  AddBillParams,
  AddBillResponse,
  StatisticsResponse,
  StatisticsResponseData,
  StatisticsData,
  DailyBill,
} from '../types/bill';
import { getBillMonthCacheKey } from '@/utils/storage';

export const getBillList = async (params: BillParams): Promise<BillListResponse> => {
  // TODO: Replace with actual API base URL if needed
  const queryString = new URLSearchParams({
    start: params.start,
    end: params.end,
    ...(params.orderBy ? { orderBy: params.orderBy } : {}),
    ...(params.type_id ? { type_id: params.type_id.toString() } : {}),
    ...(params.page ? { page: params.page.toString() } : {}),
    ...(params.page_size ? { page_size: params.page_size.toString() } : {}),
  }).toString();

  return request(`/api/bill/list?${queryString}`, {
    method: 'GET',
  });
};

export interface BillMonthCacheData {
  month: string;
  summary: {
    totalExpense: number;
    totalIncome: number;
  };
  list: DailyBill[];
  updatedAt: number;
}

export const computeSummaryFromDailyBills = (list: DailyBill[]) => {
  let totalExpense = 0;
  let totalIncome = 0;

  list.forEach(daily => {
    daily.bills.forEach(bill => {
      const amount = parseFloat(bill.amount);
      if (bill.pay_type === '1') {
        totalExpense += amount;
      } else {
        totalIncome += amount;
      }
    });
  });

  return { totalExpense, totalIncome };
};

export const saveBillMonthCache = async (month: string, list: DailyBill[], summary?: { totalExpense: number; totalIncome: number }) => {
  const cacheData: BillMonthCacheData = {
    month,
    summary: summary || computeSummaryFromDailyBills(list),
    list,
    updatedAt: Date.now(),
  };

  await AsyncStorage.setItem(getBillMonthCacheKey(month), JSON.stringify(cacheData));
};

export const loadBillMonthCache = async (month: string): Promise<BillMonthCacheData | null> => {
  const raw = await AsyncStorage.getItem(getBillMonthCacheKey(month));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as BillMonthCacheData;
    if (!parsed?.month || !Array.isArray(parsed?.list)) {
      return null;
    }
    return parsed;
  } catch (error) {
    console.error('Failed to parse month cache', error);
    return null;
  }
};

export const buildStatisticsFromDailyBills = (list: DailyBill[]): StatisticsResponseData => {
  const summary = computeSummaryFromDailyBills(list);
  const typeMap = new Map<string, StatisticsData>();

  list.forEach(daily => {
    daily.bills.forEach(bill => {
      const key = `${bill.type_id}-${bill.pay_type}`;
      const amount = parseFloat(bill.amount);
      const existing = typeMap.get(key);

      if (existing) {
        existing.number += amount;
      } else {
        typeMap.set(key, {
          type_id: bill.type_id,
          type_name: bill.type_name,
          pay_type: bill.pay_type,
          number: amount,
        });
      }
    });
  });

  return {
    total_expense: summary.totalExpense.toFixed(2),
    total_income: summary.totalIncome.toFixed(2),
    total_data: Array.from(typeMap.values()),
  };
};

export const addBill = async (params: AddBillParams): Promise<AddBillResponse> => {
  return request('/api/bill/add', {
    method: 'POST',
    body: JSON.stringify(params),
    timeout: 10000, // 10 seconds timeout as requested
  });
};

export const deleteBill = async (id: number): Promise<any> => {
  return request(`/api/bill/delete`, {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
};

export const updateBill = async (params: AddBillParams & { id: number }): Promise<any> => {
  return request('/api/bill/update', {
    method: 'POST',
    body: JSON.stringify(params),
  });
};

export const getBillStatistics = async (start: string, end: string): Promise<StatisticsResponse> => {
  const queryString = new URLSearchParams({ start, end }).toString();
  return request(`/api/bill/data?${queryString}`, {
    method: 'GET',
  });
};

// 查询某类型账单最早日期
export const getEarliestItemDate = async (type_id?: number): Promise<EarliestItemDateResponse> => {
  return request(`/api/bill/getEarliestItemDate`, {
    method: 'GET',
    params: { type_id },
  });
};
