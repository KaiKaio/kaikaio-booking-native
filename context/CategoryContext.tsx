import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Category } from '../types/category';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoadingScreen } from '../components/LoadingScreen';
import { listCategories } from '@/services/category'
import { CATEGORIES_CACHE_STORAGE_KEY, TOKEN_STORAGE_KEY } from '@/utils/storage';

interface CategoryContextType {
  categories: Category[];
  getCategoryIcon: (name: string) => string;
  getCategoryName: (id: number) => string;
  refreshCategories: () => Promise<void>;
  resetCategories: () => void;
  isReady: boolean;
}

const DEFAULT_CATEGORIES: Category[] = [];

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

export const CategoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [isReady, setIsReady] = useState(false);

  const refreshCategories = async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
      if (!token) {
        setCategories(DEFAULT_CATEGORIES);
        setIsReady(true);
        return;
      }

      const res = await listCategories();
      const list = res?.data?.list || [];
      if (res.code === 200 && list?.length) {
        const mappedList = list.map((item: Category) => ({
          id: item.id,
          name: item.name,
          type: item.type,
          background_color: item?.background_color,
          icon: item.icon,
          user_id: item.user_id,
        }));
        setCategories(mappedList);
        // 缓存到本地存储
        await AsyncStorage.setItem(CATEGORIES_CACHE_STORAGE_KEY, JSON.stringify(mappedList));
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
        const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
        if (!token) {
          setCategories(DEFAULT_CATEGORIES);
          setIsReady(true);
          return;
        }

        // 尝试从缓存读取数据
        const cachedData = await AsyncStorage.getItem(CATEGORIES_CACHE_STORAGE_KEY);
        if (cachedData) {
          const parsedCategories = JSON.parse(cachedData);
          setCategories(parsedCategories);
          setIsReady(true);
          console.log('Loaded categories from cache');
        }
      } catch (error) {
        console.error('Failed to load categories from cache:', error);
      }

      // 后台获取最新数据（有 token 才尝试）
      refreshCategories();
    };

    initializeCategories();
  }, []);

  const getCategoryIcon = (name: string) => {
    const category = categories.find(c => c.name === name);
    return category ? category.icon : '💰';
  };

  const getCategoryName = (id: number) => {
    const category = categories.find(c => c.id === id);
    return category ? category.name : '其他';
  };

  const resetCategories = () => {
    setCategories(DEFAULT_CATEGORIES);
    setIsReady(true);
  };

  return (
    <CategoryContext.Provider value={{ categories, getCategoryIcon, getCategoryName, refreshCategories, resetCategories, isReady }}>
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
