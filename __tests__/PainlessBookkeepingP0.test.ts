import { billParser } from '../services/parser/BillParser';
import { GenericStrategy } from '../services/parser/strategies/GenericStrategy';
import { guessCategoryName } from '../services/parser/categoryGuess';
import { sortCategoriesByUsage } from '../utils/categoryUsage';
import { hashText } from '../hooks/useAutoBookkeeping';

describe('分类预填（关键词 → 分类）', () => {
  it('应优先根据商户名猜测分类', () => {
    expect(guessCategoryName('微信支付', '滴滴出行科技有限公司')).toBe('交通');
    expect(guessCategoryName('支付成功', '美团外卖')).toBe('餐饮');
  });

  it('商户无命中时应根据全文关键词猜测', () => {
    expect(guessCategoryName('微信支付收款方：楼下便利店 ￥12.00')).toBe('购物');
    expect(guessCategoryName('支付宝 交通卡充值 50.00元')).toBe('交通');
  });

  it('无任何关键词命中时返回 undefined', () => {
    expect(guessCategoryName('微信支付收款方：张三 ￥100.00')).toBeUndefined();
  });

  it('BillParser 解析结果应自动填充猜测分类', () => {
    const result = billParser.parse('微信支付收款方：肯德基（人民广场店） ￥35.00');
    expect(result).not.toBeNull();
    expect(result?.category).toBe('餐饮');
  });
});

describe('通用兜底解析策略', () => {
  const strategy = new GenericStrategy();

  it('应匹配「消费 + 金额」文本', () => {
    const text = '【银行提醒】您的卡片于今日消费12.50元';
    expect(strategy.canParse(text)).toBe(true);
    const result = strategy.parse(text);
    expect(result?.amount).toBe(12.5);
    expect(result?.type).toBe('expense');
    expect(result?.source).toBe('Generic');
  });

  it('应识别收入类文本', () => {
    const text = '您有一笔收款入账 ￥200.00';
    const result = strategy.parse(text);
    expect(result?.amount).toBe(200);
    expect(result?.type).toBe('income');
  });

  it('不含金额时不匹配', () => {
    expect(strategy.canParse('今天消费了一顿')).toBe(false);
  });

  it('BillParser 在无专用策略命中时走兜底策略', () => {
    const result = billParser.parse('支付成功，金额 30 元');
    expect(result).not.toBeNull();
    expect(result?.source).toBe('Generic');
    expect(result?.amount).toBe(30);
  });
});

describe('分类 LRU 排序', () => {
  it('应按最近使用时间倒序，未使用的保持原顺序', () => {
    const categories = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    const usageMap = { 3: 100, 1: 300, 2: 200 };
    const sorted = sortCategoriesByUsage(categories, usageMap);
    expect(sorted.map(c => c.id)).toEqual([1, 2, 3, 4]);
  });

  it('无使用记录时保持原顺序', () => {
    const categories = [{ id: 5 }, { id: 6 }];
    const sorted = sortCategoriesByUsage(categories, {});
    expect(sorted.map(c => c.id)).toEqual([5, 6]);
  });
});

describe('剪贴板去重哈希', () => {
  it('相同内容哈希一致，不同内容哈希不同', () => {
    expect(hashText('微信支付 ￥10.00')).toBe(hashText('微信支付 ￥10.00'));
    expect(hashText('微信支付 ￥10.00')).not.toBe(hashText('微信支付 ￥11.00'));
  });
});
