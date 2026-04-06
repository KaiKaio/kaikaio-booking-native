import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserInfo, UserInfo } from '../services/user';
import { TOKEN_STORAGE_KEY } from '@/utils/storage';

interface UserContextType {
  userInfo: UserInfo | null;
  loading: boolean;
  refreshUserInfo: (silent?: boolean) => Promise<void>;
  updateUserInfo: (info: Partial<UserInfo>) => void;
  resetUserInfo: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUserInfo = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getUserInfo();
      if (res.data) {
        setUserInfo(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const updateUserInfo = (info: Partial<UserInfo>) => {
    if (userInfo) {
      setUserInfo({ ...userInfo, ...info });
    }
  };

  const resetUserInfo = () => {
    setUserInfo(null);
    setLoading(false);
  };

  useEffect(() => {
    const initializeUser = async () => {
      const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
      if (!token) {
        setLoading(false);
        setUserInfo(null);
        return;
      }
      await refreshUserInfo();
    };

    initializeUser();
  }, []);

  return (
    <UserContext.Provider value={{ userInfo, loading, refreshUserInfo, updateUserInfo, resetUserInfo }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
