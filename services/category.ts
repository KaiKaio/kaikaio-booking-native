import request from '@/request';
import { Category } from '../types/category';
import { ApiResponse } from '../types/common';

// 创建分类
export async function createCategory(data: Omit<Category, 'id' | 'user_id'>): Promise<Category> {
  const res = await request('/api/type/add', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
  
  // // 模拟返回
  // return {
  //   id: `temp_${Date.now()}`,
  //   ...data,
  // };
}

// 更新分类
export async function updateCategory(data: Partial<Category> & Pick<Category, 'id' | 'type' | 'user_id'>): Promise<Category> {
  const res = await request(`/api/type/update`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
  
  // // 模拟返回
  // return {
  //   id,
  //   name: data.name || '',
  //   icon: data.icon || '💰',
  //   type: data.type || 1,
  // };
}

// 删除分类
export async function deleteCategory(data: { id: string }): Promise<void> {
  await request(`/api/type/delete`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  
  // 模拟
  // console.log('Delete category:', id);
}

// 获取分类列表
export async function listCategories(): Promise<ApiResponse<{
  list: Category[];
}>> {
  return request('/api/type/list', { method: 'GET' });
}
