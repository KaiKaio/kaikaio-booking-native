import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Category } from '../types/category';

interface CategoryContextType {
  categories: Category[];
  getCategoryIcon: (name: string) => string;
  getCategoryName: (id: string) => string;
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: '用餐', icon: '🍽️', type: 1 },
  { id: '2', name: '交通', icon: '🚗', type: 1 },
  { id: '3', name: '丽人', icon: '💇', type: 1 },
  { id: '4', name: '服饰', icon: '👕', type: 1 },
  { id: '5', name: '日用品', icon: '🧴', type: 1 },
  { id: '6', name: '娱乐', icon: '🎳', type: 1 },
  { id: '7', name: '买烟', icon: '🚬', type: 1 },
  { id: '8', name: '学习', icon: '📚', type: 1 },
  { id: '9', name: '医疗', icon: '💊', type: 1 },
  { id: '10', name: '物业水电', icon: '💡', type: 1 },
  { id: '11', name: '酒水', icon: '🍺', type: 1 },
  { id: '12', name: '家居', icon: '🛋️', type: 1 },
  { id: '99', name: '其他', icon: '❓', type: 1 },
];

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

export const CategoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [categories] = useState<Category[]>(DEFAULT_CATEGORIES);

  const getCategoryIcon = (name: string) => {
    const category = categories.find(c => c.name === name);
    return category ? category.icon : '💰';
  };

  const getCategoryName = (id: string) => {
    const category = categories.find(c => c.id === id);
    return category ? category.name : '其他';
  };

  return (
    <CategoryContext.Provider value={{ categories, getCategoryIcon, getCategoryName }}>
      {children}
    </CategoryContext.Provider>
  );
};

export const useCategory = () => {
  const context = useContext(CategoryContext);
  if (!context) {
    throw new Error('useCategory must be used within a CategoryProvider');
  }
  return context;
};
