import { ParsedBill, ParserStrategy } from '../types';

/**
 * 支付通知解析策略（Android 通知监听来源）
 *
 * 通知文本由 useAutoBookkeeping 统一加上来源前缀，形如：
 *   【支付宝】你已成功付款12.50元
 *   【微信】微信支付\n你已成功向肯德基付款¥25.00
 *
 * 前缀保证与剪贴板账单文本（AlipayStrategy/WeChatStrategy）互不干扰。
 */
export class NotificationStrategy implements ParserStrategy {
  name = 'Notification';

  private sourcePattern = /^【(支付宝|微信)】/;

  // 收入语义关键词：命中则记为收入
  private incomeKeywords = ['收款', '到账', '入账', '收到', '转入'];

  canParse(text: string): boolean {
    return this.sourcePattern.test(text.trim());
  }

  parse(text: string): ParsedBill | null {
    try {
      const trimmed = text.trim();
      const sourceMatch = trimmed.match(this.sourcePattern);
      if (!sourceMatch) return null;
      const source = sourceMatch[1] === '支付宝' ? 'Alipay' : 'WeChat';

      let amount = 0;
      // 提取金额：优先 ￥/¥ 前缀，其次 x.xx元
      const symbolMatch = trimmed.match(/[￥¥]\s*(\d+(?:\.\d{1,2})?)/);
      const yuanMatch = trimmed.match(/(\d+(?:\.\d{1,2})?)\s*元/);
      const plainMatch = trimmed.match(/(\d+\.\d{2})/);
      const amountStr = symbolMatch?.[1] ?? yuanMatch?.[1] ?? plainMatch?.[1];
      if (!amountStr) return null;
      amount = parseFloat(amountStr);
      if (!Number.isFinite(amount) || amount <= 0) return null;

      // 提取商户/交易对象
      let merchant = '';
      const merchantMatch =
        trimmed.match(/向(.{1,20}?)付款/) || trimmed.match(/交易对象[：:]\s*([^,\n]+)/);
      if (merchantMatch) {
        merchant = merchantMatch[1].replace(/[￥¥]\s*\d+(?:\.\d{1,2})?/, '').trim();
      }

      // 判断收支方向
      const type = this.incomeKeywords.some(k => trimmed.includes(k)) ? 'income' : 'expense';

      return {
        amount,
        type,
        merchant,
        date: new Date(),
        source,
        rawText: trimmed
      };
    } catch (e) {
      console.error('Notification parse error', e);
      return null;
    }
  }
}
