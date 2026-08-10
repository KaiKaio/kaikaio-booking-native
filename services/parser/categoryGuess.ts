// 关键词 → 分类 映射规则，用于账单解析后的分类预填（猜测）
// 分类名使用常见命名，导入时会在用户分类库中按名称匹配，匹配不到则回退默认分类
export const KEYWORD_CATEGORY_RULES: Array<{ category: string; keywords: string[] }> = [
  {
    category: '餐饮',
    keywords: [
      '美团', '饿了么', '肯德基', '麦当劳', '星巴克', '瑞幸', '喜茶', '蜜雪冰城',
      '外卖', '早餐', '午餐', '晚餐', '奶茶', '咖啡', '火锅', '烧烤', '饭店', '面馆', '餐', '食',
    ],
  },
  {
    category: '交通',
    keywords: [
      '滴滴', '高德', '地铁', '公交', '打车', '出行', '交通', '12306', '铁路', '航空', '机票',
      '加油', '停车', '充电', '高速', '通行费', '单车', '骑行',
    ],
  },
  {
    category: '购物',
    keywords: ['淘宝', '京东', '拼多多', '天猫', '唯品会', '超市', '便利店', '商城', '百货'],
  },
  {
    category: '娱乐',
    keywords: ['电影', '游戏', '视频', '音乐', '哔哩哔哩', 'bilibili', '网易云', '演出', '会员'],
  },
  {
    category: '医疗',
    keywords: ['医院', '药房', '药店', '诊所', '挂号'],
  },
  {
    category: '教育',
    keywords: ['学费', '课程', '培训', '书店'],
  },
  {
    category: '居住',
    keywords: ['房租', '水费', '电费', '燃气', '物业', '贝壳', '自如'],
  },
  {
    category: '通讯',
    keywords: ['话费', '流量', '中国移动', '中国联通', '中国电信'],
  },
];

/**
 * 根据账单文本与商户名猜测分类名
 * 优先匹配商户名（更精准），其次匹配全文
 */
export function guessCategoryName(text: string, merchant?: string): string | undefined {
  const merchantText = merchant || '';

  if (merchantText) {
    for (const rule of KEYWORD_CATEGORY_RULES) {
      if (rule.keywords.some(keyword => merchantText.includes(keyword))) {
        return rule.category;
      }
    }
  }

  for (const rule of KEYWORD_CATEGORY_RULES) {
    if (rule.keywords.some(keyword => text.includes(keyword))) {
      return rule.category;
    }
  }

  return undefined;
}
