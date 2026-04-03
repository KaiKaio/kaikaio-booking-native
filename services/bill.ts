import request from '../request';
import { BillListResponse, BillParams, EarliestItemDateResponse, AddBillParams, AddBillResponse, StatisticsResponse } from '../types/bill';

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
