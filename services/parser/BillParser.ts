import { ParsedBill, ParserStrategy } from './types';
import { NotificationStrategy } from './strategies/NotificationStrategy';
import { AlipayStrategy } from './strategies/AlipayStrategy';
import { WeChatStrategy } from './strategies/WeChatStrategy';
import { GenericStrategy } from './strategies/GenericStrategy';
import { guessCategoryName } from './categoryGuess';

class BillParser {
  private strategies: ParserStrategy[] = [];

  constructor() {
    // 注册策略（顺序即优先级，通用兜底策略放最后）
    // 通知来源带【支付宝】/【微信】前缀标记，需最先匹配
    this.strategies.push(new NotificationStrategy());
    this.strategies.push(new AlipayStrategy());
    this.strategies.push(new WeChatStrategy());
    this.strategies.push(new GenericStrategy());
  }

  /**
   * 尝试解析文本
   * @param text 剪贴板或OCR识别的文本
   */
  parse(text: string): ParsedBill | null {
    if (!text) return null;

    for (const strategy of this.strategies) {
      if (strategy.canParse(text)) {
        console.log(`Using strategy: ${strategy.name}`);
        const result = strategy.parse(text);
        if (result) {
          // 分类预填：策略未给出分类时，用关键词规则猜测
          if (!result.category) {
            result.category = guessCategoryName(result.rawText, result.merchant);
          }
          return result;
        }
      }
    }

    return null;
  }
}

export const billParser = new BillParser();
