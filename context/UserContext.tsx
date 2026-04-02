import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { getUserInfo, UserInfo } from '../services/user';

interface UserContextType {
  userInfo: UserInfo | null;
  loading: boolean;
  refreshUserInfo: () => Promise<void>;
  updateUserInfo: (info: Partial<UserInfo>) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUserInfo = async () => {
    setLoading(true);
    try {
      const res = await getUserInfo();
      if (res.data) {
        setUserInfo(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserInfo = (info: Partial<UserInfo>) => {
    if (userInfo) {
      setUserInfo({ ...userInfo, ...info });
    }
  };

  useEffect(() => {
    refreshUserInfo();
  }, []);

  return (
    <UserContext.Provider value={{ userInfo, loading, refreshUserInfo, updateUserInfo }}>
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
