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
  private incomeKeywords = ['收款', '到账', '入账', '收到', '转入', '退款'];

  // 支出语义关键词：优先级高于收入词
  // 注意：不要用裸「支付」，因为通知标题「微信支付」几乎总是包含它，会把收款通知误判成支出
  private expenseKeywords = [
    '付款',
    '已支付',
    '支付成功',
    '扣费',
    '扣款',
    '消费',
    '支出',
    '已扣',
  ];

  // 显式金额字段（优先级最高）：付款金额：12.50 / 金额 ￥12.50
  private amountFieldPattern =
    /(?:付款金额|交易金额|支付金额|金额|合计)[：:]?\s*[￥¥]?\s*(\d[\d,]*(?:\.\d{1,2})?)/;
  // ￥/¥ 前缀金额
  private symbolAmountPattern = /[￥¥]\s*(\d[\d,]*(?:\.\d{1,2})?)/;
  // x.xx元
  private yuanAmountPattern = /(\d[\d,]*(?:\.\d{1,2})?)\s*元/;
  // 兜底：任意两位小数
  private plainAmountPattern = /(\d+\.\d{2})/;

  // 商户：向xxx付款 / 向xxx转账 / 付款给xxx / 交易对象：xxx / 商户：xxx / 收款方：xxx
  private merchantPatterns = [
    /向(.{1,20}?)(?:付款|转账|支付)/,
    /付款给(.{1,20})/,
    /(?:交易对象|商户名称|商户|收款方|商家)[：:]\s*([^\n,，]{1,30})/,
  ];

  canParse(text: string): boolean {
    return this.sourcePattern.test(text.trim());
  }

  parse(text: string): ParsedBill | null {
    try {
      const trimmed = text.trim();
      const sourceMatch = trimmed.match(this.sourcePattern);
      if (!sourceMatch) return null;
      const source = sourceMatch[1] === '支付宝' ? 'Alipay' : 'WeChat';

      const amountStr =
        trimmed.match(this.amountFieldPattern)?.[1] ??
        trimmed.match(this.symbolAmountPattern)?.[1] ??
        trimmed.match(this.yuanAmountPattern)?.[1] ??
        trimmed.match(this.plainAmountPattern)?.[1];
      if (!amountStr) return null;

      const amount = parseFloat(amountStr.replace(/,/g, ''));
      if (!Number.isFinite(amount) || amount <= 0) return null;

      // 提取商户/交易对象
      let merchant = '';
      for (const pattern of this.merchantPatterns) {
        const matched = trimmed.match(pattern);
        if (matched?.[1]) {
          merchant = matched[1]
            .replace(/[￥¥]\s*\d[\d,]*(?:\.\d{1,2})?/g, '')
            .replace(/\d[\d,]*(?:\.\d{1,2})?\s*元/g, '')
            .trim();
          if (merchant) break;
        }
      }

      // 判断收支方向：支出词优先，避免「微信支付…收款到账」被判为支出
      const isExpense = this.expenseKeywords.some(k => trimmed.includes(k));
      const isIncome = this.incomeKeywords.some(k => trimmed.includes(k));
      const type: ParsedBill['type'] = isExpense || !isIncome ? 'expense' : 'income';

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
