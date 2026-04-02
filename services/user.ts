import request from '../request';
import { BASE_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserInfo {
  user_id: string;
  username: string;
  avatar?: string;
}

export interface UpdateUsernameParams {
  username: string;
}

export interface UpdatePasswordParams {
  oldPassword: string;
  newPassword: string;
}

export interface UpdateAvatarParams {
  avatar: string;
}

// 获取用户信息
export const getUserInfo = async (): Promise<{ data: UserInfo }> => {
  return request('/api/user/info', {
    method: 'GET',
  });
};

// 更新用户名
export const updateUsername = async (params: UpdateUsernameParams): Promise<{ msg: string }> => {
  return request('/api/user/update/username', {
    method: 'POST',
    body: JSON.stringify(params),
  });
};

// 更新密码
export const updatePassword = async (params: UpdatePasswordParams): Promise<{ msg: string }> => {
  return request('/api/user/update/password', {
    method: 'POST',
    body: JSON.stringify(params),
  });
};

// 更新头像
export const updateAvatar = async (params: UpdateAvatarParams): Promise<{ msg: string }> => {
  return request('/api/user/update/avatar', {
    method: 'POST',
    body: JSON.stringify(params),
  });
};

// 上传头像图片
export const uploadAvatar = async (uri: string): Promise<{ data: { url: string } }> => {
  const token = await AsyncStorage.getItem('token');
  
  const formData = new FormData();
  const filename = uri.split('/').pop() || 'avatar.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';
  
  formData.append('avatar', {
    uri: uri,
    name: filename,
    type: type,
  } as any);

  const response = await fetch(`${BASE_URL}/api/user/upload/avatar`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: token } : {}),
    },
    body: formData,
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.msg || '上传失败');
  }
  
  return data;
};
