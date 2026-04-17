import { ApiResponse } from './common';
export interface BillParams {
  start: string; // YYYY-MM-DD 00:00:00
  end: string;   // YYYY-MM-DD 23:59:59
  orderBy?: string;
  type_id?: number;
  page?: number;
  page_size?: number;
}

export interface BillDetail {
  id: number;
  pay_type: '1' | '2'; // "1" might be expense, "2" income? The user example shows "1" for expense items like "Entertainment"
  amount: string;
  date: string;
  type_id: number;
  type_name: string;
  remark: string;
  create_time: string;
  client_local_id?: string;
}

export interface DailyBill {
  date: string;
  bills: BillDetail[];
}

export interface BillListResponseData {
  totalExpense: number;
  totalIncome: number;
  totalPage: number;
  list: DailyBill[];
}

export interface BillListResponse {
  code: number;
  msg: string;
  data: BillListResponseData;
}

export interface AddBillParams {
  amount: string;
  type_id: number;
  type_name: string;
  date: number;
  pay_type: '1' | '2';
  remark?: string;
  client_local_id?: string; // 本地生成的唯一 ID，用于同步后匹配
}

export interface AddBillResponse {
  code: number;
  msg: string;
  data: (BillDetail & { client_local_id?: string }) | null;
}

export interface UpdateBillResponse {
  code: number;
  msg: string;
  data: BillDetail | null;
}

export interface StatisticsData {
  type_id: number;
  type_name: string;
  pay_type: string;
  number: number;
}

export interface StatisticsResponseData {
  total_expense: string;
  total_income: string;
  total_data: StatisticsData[];
}

export interface StatisticsResponse {
  code: number;
  msg: string;
  data: StatisticsResponseData;
}

export interface EarliestItemDateResponse {
  code: number;
  msg: string;
  data: string // "2020-11-10T12:16:59.000Z"
}

export type MonthListResponse = ApiResponse<string[]>; // ["2020/11", "2020/12", "2021/01", ...]