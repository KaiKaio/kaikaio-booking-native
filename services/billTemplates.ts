import AsyncStorage from '@react-native-async-storage/async-storage';

// ===== 快捷模板（一键记账） =====

export interface BillTemplate {
  id: string;
  // 模板名称（如：早餐、地铁）
  name: string;
  amount: number;
  categoryId: number;
  categoryName: string;
  categoryIcon: string;
  type: '1' | '2'; // '1': 支出, '2': 收入
  createdAt: number;
  lastUsedAt: number;
}

// 用户隔离的模板存储 key 前缀
const BILL_TEMPLATES_PREFIX = 'bill_templates_user';
// 模板数量上限，防止无限增长
const MAX_TEMPLATES = 30;

export const getTemplatesKey = (account: string) =>
  `${BILL_TEMPLATES_PREFIX}:${account}`;

export function generateTemplateId(): string {
  return `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function loadTemplates(account: string): Promise<BillTemplate[]> {
  try {
    const raw = await AsyncStorage.getItem(getTemplatesKey(account));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 最近使用的排最前
    return [...parsed].sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0));
  } catch (error) {
    console.error('Failed to load bill templates', error);
    return [];
  }
}

export async function saveTemplates(
  account: string,
  templates: BillTemplate[]
): Promise<void> {
  await AsyncStorage.setItem(
    getTemplatesKey(account),
    JSON.stringify(templates.slice(0, MAX_TEMPLATES))
  );
}

export async function addTemplate(
  account: string,
  template: Omit<BillTemplate, 'id' | 'createdAt' | 'lastUsedAt'>
): Promise<BillTemplate> {
  const templates = await loadTemplates(account);
  const created: BillTemplate = {
    ...template,
    id: generateTemplateId(),
    createdAt: Date.now(),
    lastUsedAt: 0,
  };
  await saveTemplates(account, [created, ...templates]);
  return created;
}

export async function removeTemplate(
  account: string,
  id: string
): Promise<BillTemplate[]> {
  const templates = await loadTemplates(account);
  const next = templates.filter(t => t.id !== id);
  await saveTemplates(account, next);
  return next;
}

/**
 * 更新模板最近使用时间（用于首页快捷入口排序）
 */
export async function touchTemplate(
  account: string,
  id: string
): Promise<void> {
  const templates = await loadTemplates(account);
  const target = templates.find(t => t.id === id);
  if (!target) return;
  target.lastUsedAt = Date.now();
  await saveTemplates(account, templates);
}
