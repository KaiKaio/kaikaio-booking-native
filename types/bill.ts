export interface BillParams {
  start: string; // YYYY-MM-DD 00:00:00
  end: string;   // YYYY-MM-DD 23:59:59
  orderBy?: string;
  page?: number;
  page_size?: number;
}

export interface BillDetail {
  id: number;
  pay_type: string; // "1" might be expense, "2" income? The user example shows "1" for expense items like "Entertainment"
  amount: string;
  date: string;
  type_id: string;
  type_name: string;
  remark: string;
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
