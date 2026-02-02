import { billParser } from '../services/parser/BillParser';
import { AlipayStrategy } from '../services/parser/strategies/AlipayStrategy';

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
