import { ParsedBill, ParserStrategy } from '../types';

/**
 * 通用兜底策略：匹配「支付/消费/收款 + 金额」模式
 * 注册在 BillParser 的最后，前面的专用策略都未命中时才生效
 */
export class GenericStrategy implements ParserStrategy {
  name = 'Generic';

  private actionPattern = /(支付|消费|付款|支出|收款|入账|到账)/;
  private amountPattern = /[￥¥]\s*\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*元/;

  canParse(text: string): boolean {
    return this.actionPattern.test(text) && this.amountPattern.test(text);
  }

  parse(text: string): ParsedBill | null {
    try {
      let amount = 0;

      // 优先匹配 ￥12.34，其次匹配 12.34元
      const symbolMatch = text.match(/[￥¥]\s*(\d+(?:\.\d{1,2})?)/);
      const yuanMatch = text.match(/(\d+(?:\.\d{1,2})?)\s*元/);
      const amountStr = symbolMatch?.[1] || yuanMatch?.[1];

      if (amountStr) {
        amount = parseFloat(amountStr);
      }

      if (!amount) return null;

      const isIncome = /(收款|入账|到账|收入)/.test(text);

      return {
        amount: Math.abs(amount),
        type: isIncome ? 'income' : 'expense',
        date: new Date(),
        source: 'Generic',
        rawText: text,
      };
    } catch (e) {
      console.error('Generic parse error', e);
      return null;
    }
  }
}
