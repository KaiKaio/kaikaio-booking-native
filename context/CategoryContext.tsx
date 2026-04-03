import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Category } from '../types/category';
import request from '../request';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoadingScreen } from '../components/LoadingScreen';

interface CategoryContextType {
  categories: Category[];
  getCategoryIcon: (name: string) => string;
  getCategoryName: (id: string) => string;
  refreshCategories: () => Promise<void>;
  isReady: boolean;
}

const DEFAULT_CATEGORIES: Category[] = [];
const CATEGORIES_CACHE_KEY = 'categories_cache';

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

export const CategoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [isReady, setIsReady] = useState(false);

  const refreshCategories = async () => {
    try {
      const res = await request('/api/type/list', { method: 'GET' });
      if (res.code === 200 && res.data && res.data.list) {
        const mappedList = res.data.list.map((item: any) => ({
          id: String(item.id),
          name: item.name,
          type: Number(item.type),
          icon: item.icon
        }));
        setCategories(mappedList);
        // 缓存到本地存储
        await AsyncStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(mappedList));
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setIsReady(true);
    }
  };

  useEffect(() => {
    const initializeCategories = async () => {
      try {
        // 尝试从缓存读取数据
        const cachedData = await AsyncStorage.getItem(CATEGORIES_CACHE_KEY);
        if (cachedData) {
          const parsedCategories = JSON.parse(cachedData);
          setCategories(parsedCategories);
          setIsReady(true);
          console.log('Loaded categories from cache');
        }
      } catch (error) {
        console.error('Failed to load categories from cache:', error);
      }

      // 后台获取最新数据（无论如何都要尝试）
      refreshCategories();
    };

    initializeCategories();
  }, []);

  const getCategoryIcon = (name: string) => {
    const category = categories.find(c => c.name === name);
    return category ? category.icon : '💰';
  };

  const getCategoryName = (id: string) => {
    const category = categories.find(c => c.id === id);
    return category ? category.name : '其他';
  };

  return (
    <CategoryContext.Provider value={{ categories, getCategoryIcon, getCategoryName, refreshCategories, isReady }}>
      {isReady ? children : <LoadingScreen />}
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
