import { ParsedBill, ParserStrategy } from '../types';

export class WeChatStrategy implements ParserStrategy {
  name = 'WeChat';

  canParse(text: string): boolean {
    return text.includes('微信支付') || text.includes('微信转账');
  }

  parse(text: string): ParsedBill | null {
    try {
      let amount = 0;
      let merchant = '';

      // 提取金额 (匹配 ￥12.34 或 ¥12.34)
      const amountMatch = text.match(/[￥¥]([-+]?\d+\.\d{2})/);
      if (amountMatch) {
        amount = parseFloat(amountMatch[1]);
      }

      // 提取收款方
      const merchantMatch = text.match(/收款方[：:]\s*([^,\n]+)/);
      if (merchantMatch) {
        merchant = merchantMatch[1].trim();
      }

      return {
        amount: Math.abs(amount),
        type: 'expense', // 微信支付通常是支出
        merchant,
        date: new Date(),
        source: 'WeChat',
        rawText: text
      };
    } catch (e) {
      console.error('WeChat parse error', e);
      return null;
    }
  }
}
