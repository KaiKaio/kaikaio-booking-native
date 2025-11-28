import request from '../request';
import { BillListResponse, BillParams, AddBillParams, AddBillResponse } from '../types/bill';

export const getBillList = async (params: BillParams): Promise<BillListResponse> => {
  // TODO: Replace with actual API base URL if needed
  const queryString = new URLSearchParams({
    start: params.start,
    end: params.end,
    ...(params.orderBy ? { orderBy: params.orderBy } : {}),
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
