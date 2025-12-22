import { ParsedBill, ParserStrategy } from '../types';

export class AlipayStrategy implements ParserStrategy {
  name = 'Alipay';

  // 匹配模式：
  // 1. 交易对象：xxx
  // 2. 付款金额：xx.xx元
  private patterns = [
    /支付成功/,
    /交易对象/,
    /付款金额/
  ];

  canParse(text: string): boolean {
    return this.patterns.some(pattern => pattern.test(text)) && text.includes('支付宝');
  }

  parse(text: string): ParsedBill | null {
    try {
      let amount = 0;
      let merchant = '';
      
      // 提取金额 (匹配 12.34 或 -12.34)
      const amountMatch = text.match(/([-+]?\d+\.\d{2})/);
      if (amountMatch) {
        amount = parseFloat(amountMatch[1]);
      }

      // 提取商户 (简单示例：交易对象：后面直到换行或逗号)
      const merchantMatch = text.match(/交易对象[：:]\s*([^,\n]+)/);
      if (merchantMatch) {
        merchant = merchantMatch[1].trim();
      }

      // 如果没找到明确商户，尝试从头部提取（很多时候第一行是商户）
      if (!merchant) {
        const lines = text.split('\n');
        if (lines.length > 0 && !lines[0].includes('支付宝')) {
          merchant = lines[0].trim();
        }
      }

      return {
        amount: Math.abs(amount),
        type: amount < 0 ? 'income' : 'expense', // 简单假设，实际需更复杂逻辑
        merchant,
        date: new Date(), // 默认为当前时间，实际可尝试从文本提取时间
        source: 'Alipay',
        rawText: text
      };
    } catch (e) {
      console.error('Alipay parse error', e);
      return null;
    }
  }
}
