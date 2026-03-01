import { transformBillData, BillItem, DailyBillGroup } from '../billStore';
import { DailyBill } from '../../types/bill';

describe('transformBillData', () => {
  // Mock getCategoryIcon function
  const mockGetCategoryIcon = jest.fn((name: string) => {
    const iconMap: Record<string, string> = {
      '餐饮': '🍜',
      '交通': '🚗',
      '购物': '🛒',
      '工资': '💰',
      '奖金': '🎁',
    };
    return iconMap[name] || '📦';
  });

  // 清除所有 mocks
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基础转换功能', () => {
    it('应该正确转换空数组', () => {
      const input: DailyBill[] = [];
      const result = transformBillData(input, mockGetCategoryIcon);

      expect(result).toEqual([]);
      expect(mockGetCategoryIcon).not.toHaveBeenCalled();
    });

    it('应该正确转换单日支出数据', () => {
      const input: DailyBill[] = [
        {
          date: '2026-02-27',
          bills: [
            {
              id: 1,
              pay_type: '1', // 支出
              amount: '50.00',
              date: '2026-02-27',
              type_id: '1',
              type_name: '餐饮',
              remark: '午餐',
            },
          ],
        },
      ];

      const result = transformBillData(input, mockGetCategoryIcon);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        date: '2026-02-27',
        total: 50,
        income: 0,
        items: [
          {
            id: 1,
            type: '餐饮',
            icon: '🍜',
            remark: '午餐',
            amount: -50, // 支出显示为负数
            typeId: '1',
            date: '2026-02-27',
            payType: 1,
            rawAmount: 50,
          },
        ],
      });
    });

    it('应该正确转换单日收入数据', () => {
      const input: DailyBill[] = [
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

      const result = transformBillData(input, mockGetCategoryIcon);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        date: '2026-02-27',
        total: 0,
        income: 5000,
        items: [
          {
            id: 2,
            type: '工资',
            icon: '💰',
            remark: '工资',
            amount: 5000, // 收入显示为正数
            typeId: '2',
            date: '2026-02-27',
            payType: 2,
            rawAmount: 5000,
          },
        ],
      });
    });
  });

  describe('计算逻辑', () => {
    it('应该正确计算单日总支出', () => {
      const input: DailyBill[] = [
        {
          date: '2026-02-27',
          bills: [
            {
              id: 1,
              pay_type: '1',
              amount: '30.00',
              date: '2026-02-27',
              type_id: '1',
              type_name: '餐饮',
              remark: '早餐',
            },
            {
              id: 2,
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

      const result = transformBillData(input, mockGetCategoryIcon);

      expect(result[0].total).toBe(80); // 30 + 50
      expect(result[0].income).toBe(0);
    });

    it('应该正确计算单日总收入', () => {
      const input: DailyBill[] = [
        {
          date: '2026-02-27',
          bills: [
            {
              id: 1,
              pay_type: '2',
              amount: '5000.00',
              date: '2026-02-27',
              type_id: '2',
              type_name: '工资',
              remark: '工资',
            },
            {
              id: 2,
              pay_type: '2',
              amount: '1000.00',
              date: '2026-02-27',
              type_id: '3',
              type_name: '奖金',
              remark: '奖金',
            },
          ],
        },
      ];

      const result = transformBillData(input, mockGetCategoryIcon);

      expect(result[0].total).toBe(0);
      expect(result[0].income).toBe(6000); // 5000 + 1000
    });

    it('应该正确计算混合收支', () => {
      const input: DailyBill[] = [
        {
          date: '2026-02-27',
          bills: [
            {
              id: 1,
              pay_type: '2',
              amount: '5000.00',
              date: '2026-02-27',
              type_id: '2',
              type_name: '工资',
              remark: '工资',
            },
            {
              id: 2,
              pay_type: '1',
              amount: '100.00',
              date: '2026-02-27',
              type_id: '1',
              type_name: '餐饮',
              remark: '晚餐',
            },
          ],
        },
      ];

      const result = transformBillData(input, mockGetCategoryIcon);

      expect(result[0].total).toBe(100);
      expect(result[0].income).toBe(5000);
    });
  });

  describe('多日数据', () => {
    it('应该正确转换多日数据', () => {
      const input: DailyBill[] = [
        {
          date: '2026-02-26',
          bills: [
            {
              id: 1,
              pay_type: '1',
              amount: '30.00',
              date: '2026-02-26',
              type_id: '1',
              type_name: '餐饮',
              remark: '早餐',
            },
          ],
        },
        {
          date: '2026-02-27',
          bills: [
            {
              id: 2,
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

      const result = transformBillData(input, mockGetCategoryIcon);

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2026-02-26');
      expect(result[1].date).toBe('2026-02-27');
      expect(result[0].total).toBe(30);
      expect(result[1].total).toBe(50);
    });
  });

  describe('getCategoryIcon 调用', () => {
    it('应该为每个账单项调用 getCategoryIcon', () => {
      const input: DailyBill[] = [
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
            {
              id: 2,
              pay_type: '1',
              amount: '30.00',
              date: '2026-02-27',
              type_id: '2',
              type_name: '交通',
              remark: '打车',
            },
          ],
        },
      ];

      transformBillData(input, mockGetCategoryIcon);

      expect(mockGetCategoryIcon).toHaveBeenCalledTimes(2);
      expect(mockGetCategoryIcon).toHaveBeenCalledWith('餐饮');
      expect(mockGetCategoryIcon).toHaveBeenCalledWith('交通');
    });
  });

  describe('金额解析', () => {
    it('应该正确解析整数金额', () => {
      const input: DailyBill[] = [
        {
          date: '2026-02-27',
          bills: [
            {
              id: 1,
              pay_type: '1',
              amount: '100',
              date: '2026-02-27',
              type_id: '1',
              type_name: '餐饮',
              remark: '整数金额',
            },
          ],
        },
      ];

      const result = transformBillData(input, mockGetCategoryIcon);

      expect(result[0].items[0].amount).toBe(-100);
      expect(result[0].items[0].rawAmount).toBe(100);
    });

    it('应该正确解析小数金额', () => {
      const input: DailyBill[] = [
        {
          date: '2026-02-27',
          bills: [
            {
              id: 1,
              pay_type: '1',
              amount: '12.50',
              date: '2026-02-27',
              type_id: '1',
              type_name: '餐饮',
              remark: '小数金额',
            },
          ],
        },
      ];

      const result = transformBillData(input, mockGetCategoryIcon);

      expect(result[0].items[0].amount).toBe(-12.5);
      expect(result[0].items[0].rawAmount).toBe(12.5);
    });
  });

  describe('边界情况', () => {
    it('应该处理空账单日期', () => {
      const input: DailyBill[] = [
        {
          date: '2026-02-27',
          bills: [],
        },
      ];

      const result = transformBillData(input, mockGetCategoryIcon);

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2026-02-27');
      expect(result[0].total).toBe(0);
      expect(result[0].income).toBe(0);
      expect(result[0].items).toHaveLength(0);
    });

    it('应该处理备注为空的情况', () => {
      const input: DailyBill[] = [
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
              remark: '',
            },
          ],
        },
      ];

      const result = transformBillData(input, mockGetCategoryIcon);

      expect(result[0].items[0].remark).toBe('');
    });
  });
});
