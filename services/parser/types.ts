export interface ParsedBill {
  amount: number;
  type: 'expense' | 'income';
  category?: string; // 猜测的分类
  merchant?: string; // 商户/交易对象
  date?: Date;
  source: string; // 来源：支付宝、微信、短信等
  rawText: string;
}

export interface ParserStrategy {
  name: string;
  canParse(text: string): boolean;
  parse(text: string): ParsedBill | null;
}
