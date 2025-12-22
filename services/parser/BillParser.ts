import { ParsedBill, ParserStrategy } from './types';
import { AlipayStrategy } from './strategies/AlipayStrategy';
import { WeChatStrategy } from './strategies/WeChatStrategy';

class BillParser {
  private strategies: ParserStrategy[] = [];

  constructor() {
    // 注册策略
    this.strategies.push(new AlipayStrategy());
    this.strategies.push(new WeChatStrategy());
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
          return result;
        }
      }
    }
    
    // 如果没有特定策略匹配，可以尝试通用正则（此处略）
    return null;
  }
}

export const billParser = new BillParser();
