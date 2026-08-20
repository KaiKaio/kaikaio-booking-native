import { billParser } from '../services/parser/BillParser';
import { AlipayStrategy } from '../services/parser/strategies/AlipayStrategy';
import { NotificationStrategy } from '../services/parser/strategies/NotificationStrategy';

describe('BillParser', () => {
  it('should identify Alipay text', () => {
    const strategy = new AlipayStrategy();
    const text = `
      支付成功
      交易对象：7-ELEVEn
      付款金额：12.50元
      支付宝
    `;
    expect(strategy.canParse(text)).toBe(true);
  });

  it('should parse Alipay bill correctly', () => {
    const text = `
      支付成功
      交易对象：7-ELEVEn
      付款金额：12.50元
      支付宝
    `;
    const result = billParser.parse(text);
    
    expect(result).not.toBeNull();
    expect(result?.source).toBe('Alipay');
    expect(result?.amount).toBe(12.50);
    expect(result?.merchant).toBe('7-ELEVEn');
    expect(result?.type).toBe('expense');
  });

  it('should return null for empty text', () => {
    expect(billParser.parse('')).toBeNull();
  });

  it('should return null for unknown text format', () => {
    const text = 'Some random text that is not a bill';
    expect(billParser.parse(text)).toBeNull();
  });
});

describe('NotificationStrategy（支付通知自动记账）', () => {
  const strategy = new NotificationStrategy();

  it('should parse WeChat payment notification', () => {
    const text = '【微信】微信支付\n你已成功向肯德基(人民广场店)付款￥25.00';
    expect(strategy.canParse(text)).toBe(true);

    const result = billParser.parse(text);
    expect(result).not.toBeNull();
    expect(result?.source).toBe('WeChat');
    expect(result?.amount).toBe(25.0);
    expect(result?.type).toBe('expense');
    expect(result?.merchant).toBe('肯德基(人民广场店)');
  });

  it('should parse Alipay payment notification with 元 suffix', () => {
    const text = '【支付宝】你已成功付款12.50元';
    const result = billParser.parse(text);
    expect(result).not.toBeNull();
    expect(result?.source).toBe('Alipay');
    expect(result?.amount).toBe(12.5);
    expect(result?.type).toBe('expense');
  });

  it('should treat 收款/到账 notification as income', () => {
    const text = '【微信】微信收款到账￥88.00';
    const result = billParser.parse(text);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('income');
    expect(result?.amount).toBe(88.0);
  });

  it('should return null when no amount found', () => {
    const text = '【支付宝】新的活动消息推荐';
    expect(strategy.canParse(text)).toBe(true);
    expect(strategy.parse(text)).toBeNull();
  });

  it('should not match clipboard bill text without prefix', () => {
    const text = '支付成功\n交易对象：7-ELEVEn\n付款金额：12.50元\n支付宝';
    expect(strategy.canParse(text)).toBe(false);
  });
});
