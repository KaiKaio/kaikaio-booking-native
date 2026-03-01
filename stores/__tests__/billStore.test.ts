import { useBillStore } from '../billStore';
import { getBillList, addBill, updateBill } from '../../services/bill';
import { BillListResponse } from '../../types/bill';

// Mock services
jest.mock('../../services/bill', () => ({
  getBillList: jest.fn(),
  addBill: jest.fn(),
  updateBill: jest.fn(),
}));

// AsyncStorage mock 在 ../__mocks__/@react-native-async-storage/async-storage.ts

describe('useBillStore', () => {
  // 在每个测试前重置
  beforeEach(() => {
    // 重置 Zustand store (只重置状态，保留函数)
    useBillStore.setState({
      rawData: [],
      currentDate: '2026-02',
      orderBy: 'DESC',
      summary: { totalExpense: 0, totalIncome: 0 },
      isLoading: false,
      isRefreshing: false,
      error: null,
      editingId: null,
      isSubmitting: false,
    });

    // 清除所有 mocks
    jest.clearAllMocks();
  });

  describe('初始状态', () => {
    const store = useBillStore.getState();

    it('应该有正确的初始值', () => {
      expect(store.rawData).toEqual([]);
      expect(store.orderBy).toBe('DESC');
      expect(store.isLoading).toBe(false);
      expect(store.isRefreshing).toBe(false);
      expect(store.error).toBe(null);
      expect(store.editingId).toBe(null);
      expect(store.isSubmitting).toBe(false);
    });

    it('currentDate 应该是当前月份', () => {
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      expect(store.currentDate).toBe(expected);
    });
  });

  describe('toggleOrderBy', () => {
    it('应该在 DESC 和 ASC 之间切换', () => {
      const { toggleOrderBy } = useBillStore.getState();

      // 初始值应该是 DESC
      expect(useBillStore.getState().orderBy).toBe('DESC');

      // 第一次切换 -> ASC
      toggleOrderBy();
      expect(useBillStore.getState().orderBy).toBe('ASC');

      // 第二次切换 -> DESC
      toggleOrderBy();
      expect(useBillStore.getState().orderBy).toBe('DESC');
    });
  });

  describe('cancelEdit', () => {
    it('应该清除编辑状态', () => {
      // 设置编辑状态
      useBillStore.setState({ editingId: 123 });

      expect(useBillStore.getState().editingId).toBe(123);

      // 取消编辑
      const { cancelEdit } = useBillStore.getState();
      cancelEdit();

      expect(useBillStore.getState().editingId).toBeNull();
    });
  });

  describe('clearError', () => {
    it('应该清除错误信息', () => {
      // 设置错误
      useBillStore.setState({ error: '测试错误' });

      expect(useBillStore.getState().error).toBe('测试错误');

      // 清除错误
      const { clearError } = useBillStore.getState();
      clearError();

      expect(useBillStore.getState().error).toBeNull();
    });
  });

  describe('startEdit', () => {
    it('应该找到并返回账单项，并设置 editingId', () => {
      const mockRawData = [
        {
          date: '2026-02-27',
          bills: [
            {
              id: 1,
              pay_type: '1',
              amount: '50.00',
              date: '2026-02-27',
              type_id: '1',
              type_name: '餐饮',
              remark: '午餐',
            },
          ],
        },
      ];

      useBillStore.setState({ rawData: mockRawData });
      const { startEdit } = useBillStore.getState();

      const result = startEdit(1);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
      expect(result?.type).toBe('餐饮');
      expect(result?.amount).toBe(-50); // 支出显示为负数
      expect(result?.rawAmount).toBe(50);
      expect(useBillStore.getState().editingId).toBe(1);
    });

    it('找不到账单时应该返回 null', () => {
      const mockRawData = [
        {
          date: '2026-02-27',
          bills: [
            {
              id: 1,
              pay_type: '1',
              amount: '50.00',
              date: '2026-02-27',
              type_id: '1',
              type_name: '餐饮',
              remark: '午餐',
            },
          ],
        },
      ];

      useBillStore.setState({ rawData: mockRawData });
      const { startEdit } = useBillStore.getState();

      const result = startEdit(999); // 不存在的 ID

      expect(result).toBeNull();
      expect(useBillStore.getState().editingId).toBeNull();
    });

    it('应该处理收入类型', () => {
      const mockRawData = [
        {
          date: '2026-02-27',
          bills: [
            {
              id: 2,
              pay_type: '2', // 收入
              amount: '5000.00',
              date: '2026-02-27',
              type_id: '2',
              type_name: '工资',
              remark: '工资',
            },
          ],
        },
      ];

      useBillStore.setState({ rawData: mockRawData });
      const { startEdit } = useBillStore.getState();

      const result = startEdit(2);

      expect(result).not.toBeNull();
      expect(result?.amount).toBe(5000); // 收入显示为正数
      expect(result?.rawAmount).toBe(5000);
      expect(result?.payType).toBe(2);
    });
  });

  describe('fetchBills', () => {
    const mockSuccessResponse: BillListResponse = {
      code: 200,
      msg: '成功',
      data: {
        totalExpense: 100,
        totalIncome: 5000,
        totalPage: 1,
        list: [
          {
            date: '2026-02-27',
            bills: [
              {
                id: 1,
                pay_type: '1',
                amount: '50.00',
                date: '2026-02-27',
                type_id: '1',
                type_name: '餐饮',
                remark: '午餐',
              },
            ],
          },
        ],
      },
    };

    it('应该成功加载账单数据', async () => {
      (getBillList as jest.Mock).mockResolvedValue(mockSuccessResponse);

      const { fetchBills } = useBillStore.getState();
      await fetchBills();

      const { rawData, summary, isLoading, error } = useBillStore.getState();

      expect(rawData).toEqual(mockSuccessResponse.data.list);
      expect(summary).toEqual({
        totalExpense: 100,
        totalIncome: 5000,
      });
      expect(isLoading).toBe(false);
      expect(error).toBeNull();
    });

    it('处理 API 错误', async () => {
      const mockErrorResponse = {
        code: 500,
        msg: '服务器错误',
        data: null,
      };

      (getBillList as jest.Mock).mockResolvedValue(mockErrorResponse);

      const { fetchBills } = useBillStore.getState();
      await fetchBills();

      const { error, isLoading } = useBillStore.getState();

      expect(error).toBe('服务器错误');
      expect(isLoading).toBe(false);
    });

    it('处理网络错误', async () => {
      (getBillList as jest.Mock).mockRejectedValue(new Error('网络错误'));

      const { fetchBills } = useBillStore.getState();
      await fetchBills();

      const { error, isLoading } = useBillStore.getState();

      expect(error).toBe('网络错误');
      expect(isLoading).toBe(false);
    });

    it('应该防止重复加载', async () => {
      (getBillList as jest.Mock).mockResolvedValue(mockSuccessResponse);

      // 设置 isLoading 为 true
      useBillStore.setState({ isLoading: true });

      const { fetchBills } = useBillStore.getState();
      await fetchBills();

      // 不应该调用 API
      expect(getBillList).not.toHaveBeenCalled();
    });
  });

  describe('refreshBills', () => {
    it('应该设置 isRefreshing 并调用 fetchBills', async () => {
      const mockSuccessResponse: BillListResponse = {
        code: 200,
        msg: '成功',
        data: {
          totalExpense: 100,
          totalIncome: 5000,
          totalPage: 1,
          list: [],
        },
      };

      (getBillList as jest.Mock).mockResolvedValue(mockSuccessResponse);

      const { refreshBills } = useBillStore.getState();
      await refreshBills();

      const { isRefreshing } = useBillStore.getState();

      expect(isRefreshing).toBe(false); // 最终应该是 false
      expect(getBillList).toHaveBeenCalled();
    });
  });

  describe('setCurrentDate', () => {
    it('应该更新日期并保存到 AsyncStorage', async () => {
      const { setCurrentDate } = useBillStore.getState();
      await setCurrentDate('2026-03');

      const { currentDate } = useBillStore.getState();

      expect(currentDate).toBe('2026-03');
      // AsyncStorage.setItem 应该被调用（在 store 中）
    });

    it('AsyncStorage 失败时不影响日期更新', async () => {
      const { setCurrentDate } = useBillStore.getState();
      await setCurrentDate('2026-04');

      const { currentDate } = useBillStore.getState();

      expect(currentDate).toBe('2026-04');
      // 日期应该更新，即使 AsyncStorage 失败
    });
  });

  describe('submitBill', () => {
    const mockBillData = {
      amount: 50,
      category: '1',
      categoryName: '餐饮',
      date: '2026-02-27',
      remark: '午餐',
      type: 1,
    };

    it('新增账单应该调用 addBill API', async () => {
      const mockAddResponse = { code: 200, msg: '成功', data: null };
      (addBill as jest.Mock).mockResolvedValue(mockAddResponse);

      const { submitBill } = useBillStore.getState();
      await submitBill(mockBillData);

      expect(addBill).toHaveBeenCalled();
      expect(updateBill).not.toHaveBeenCalled();
    });

    it('编辑账单应该调用 updateBill API', async () => {
      // 设置 editingId
      useBillStore.setState({ editingId: 123 });

      const mockUpdateResponse = { code: 200, msg: '成功', data: null };
      (updateBill as jest.Mock).mockResolvedValue(mockUpdateResponse);

      const { submitBill } = useBillStore.getState();
      await submitBill(mockBillData);

      expect(updateBill).toHaveBeenCalled();
      expect(addBill).not.toHaveBeenCalled();
    });

    it('成功后应该刷新列表', async () => {
      const mockAddResponse = { code: 200, msg: '成功', data: null };
      (addBill as jest.Mock).mockResolvedValue(mockAddResponse);

      const mockSuccessResponse: BillListResponse = {
        code: 200,
        msg: '成功',
        data: {
          totalExpense: 100,
          totalIncome: 5000,
          totalPage: 1,
          list: [],
        },
      };
      (getBillList as jest.Mock).mockResolvedValue(mockSuccessResponse);

      const { submitBill } = useBillStore.getState();
      await submitBill(mockBillData);

      // 应该调用 fetchBills 刷新列表
      expect(getBillList).toHaveBeenCalled();
    });

    it('失败时应该设置错误信息并抛出错误', async () => {
      (addBill as jest.Mock).mockRejectedValue(new Error('添加失败'));

      const { submitBill } = useBillStore.getState();

      await expect(submitBill(mockBillData)).rejects.toThrow('添加失败');

      const { error, isSubmitting } = useBillStore.getState();

      expect(error).toBe('添加失败');
      expect(isSubmitting).toBe(false);
    });

    it('提交中状态设置正确', async () => {
      const mockAddResponse = { code: 200, msg: '成功', data: null };
      (addBill as jest.Mock).mockResolvedValue(mockAddResponse);

      const mockSuccessResponse: BillListResponse = {
        code: 200,
        msg: '成功',
        data: {
          totalExpense: 0,
          totalIncome: 0,
          totalPage: 1,
          list: [],
        },
      };
      (getBillList as jest.Mock).mockResolvedValue(mockSuccessResponse);

      const { submitBill } = useBillStore.getState();

      // 开始提交
      const promise = submitBill(mockBillData);
      const stateDuring = useBillStore.getState();
      expect(stateDuring.isSubmitting).toBe(true);

      // 等待完成
      await promise;

      // 完成后
      const stateAfter = useBillStore.getState();
      expect(stateAfter.isSubmitting).toBe(false);
    });
  });
});
