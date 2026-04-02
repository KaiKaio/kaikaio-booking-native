import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RootStackParamList } from '../types/navigation';
import { useUser } from '../context/UserContext';
import { updateUsername, updatePassword, updateAvatar, uploadAvatar } from '../services/user';
import JSEncrypt from 'jsencrypt';
import { theme } from '@/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

const encrypt = new JSEncrypt();

const Account = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { userInfo, loading, updateUserInfo } = useUser();

  // Modal states
  const [usernameModalVisible, setUsernameModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);

  // Form states
  const [newUsername, setNewUsername] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('清除 token 失败', error);
    }
  };

  // 获取公钥用于密码加密
  const fetchPublicKey = async () => {
    try {
      const response = await fetch('http://10.242.78.83:4000/api/user/public_key');
      const data = await response.json();
      if (data?.msg) {
        encrypt.setPublicKey(data.msg);
        return true;
      }
      return false;
    } catch (error) {
      console.error('获取公钥失败', error);
      return false;
    }
  };

  // 从相册选择图片
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('权限提示', '需要相册权限才能选择头像');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setLocalAvatarUri(uri);
        setAvatarUrl(''); // 清空 URL 输入
      }
    } catch (error) {
      console.error('选择图片失败', error);
      Alert.alert('错误', '选择图片失败，请重试');
    }
  };

  // 拍照
  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('权限提示', '需要相机权限才能拍照');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setLocalAvatarUri(uri);
        setAvatarUrl(''); // 清空 URL 输入
      }
    } catch (error) {
      console.error('拍照失败', error);
      // iOS 模拟器没有摄像头，会抛出错误
      Alert.alert('提示', '当前设备不支持拍照，请使用相册或输入图片URL');
    }
  };

  // 修改用户名
  const handleUpdateUsername = async () => {
    if (!newUsername.trim()) {
      Alert.alert('提示', '请输入用户名');
      return;
    }
    setSubmitting(true);
    try {
      await updateUsername({ username: newUsername.trim() });
      updateUserInfo({ username: newUsername.trim() });
      setUsernameModalVisible(false);
      setNewUsername('');
      Alert.alert('成功', '用户名修改成功');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '修改失败';
      Alert.alert('错误', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // 修改密码
  const handleUpdatePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert('提示', '请填写所有密码字段');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('提示', '两次输入的新密码不一致');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('提示', '密码长度不能少于6位');
      return;
    }

    setSubmitting(true);
    try {
      const hasPublicKey = await fetchPublicKey();
      if (!hasPublicKey) {
        Alert.alert('错误', '获取加密公钥失败');
        return;
      }

      const encryptedOldPassword = encrypt.encrypt(oldPassword);
      const encryptedNewPassword = encrypt.encrypt(newPassword);

      if (!encryptedOldPassword || !encryptedNewPassword) {
        Alert.alert('错误', '密码加密失败');
        return;
      }

      await updatePassword({
        oldPassword: encryptedOldPassword,
        newPassword: encryptedNewPassword,
      });
      setPasswordModalVisible(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('成功', '密码修改成功');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '修改失败';
      Alert.alert('错误', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // 修改头像
  const handleUpdateAvatar = async () => {
    // 优先使用本地选择的图片
    if (localAvatarUri) {
      setSubmitting(true);
      try {
        const res = await uploadAvatar(localAvatarUri);
        if (res.data?.url) {
          await updateAvatar({ avatar: res.data.url });
          updateUserInfo({ avatar: res.data.url });
          setAvatarModalVisible(false);
          setLocalAvatarUri(null);
          setAvatarUrl('');
          Alert.alert('成功', '头像修改成功');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '上传失败';
        Alert.alert('错误', errorMsg);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // 使用 URL
    if (!avatarUrl.trim()) {
      Alert.alert('提示', '请选择图片或输入头像URL');
      return;
    }
    setSubmitting(true);
    try {
      await updateAvatar({ avatar: avatarUrl.trim() });
      updateUserInfo({ avatar: avatarUrl.trim() });
      setAvatarModalVisible(false);
      setAvatarUrl('');
      Alert.alert('成功', '头像修改成功');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '修改失败';
      Alert.alert('错误', errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const defaultAvatar = 'https://via.placeholder.com/100';
  const avatarInitial = (userInfo?.username?.trim()?.charAt(0) ?? '?').toUpperCase();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
      {/* 用户信息卡片 */}
      <View style={styles.card}>
        {/* 头像区域 */}
        <TouchableOpacity
          style={styles.avatarSection}
          onPress={() => {
            setLocalAvatarUri(null);
            setAvatarUrl('');
            setAvatarModalVisible(true);
          }}
        >
          {userInfo?.avatar ? (
            <Image
              source={{ uri: userInfo.avatar }}
              style={styles.avatar}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarInitial]}>
              <Text style={styles.avatarInitialText}>{avatarInitial}</Text>
            </View>
          )}
          <View style={styles.avatarEditHint}>
            <Icon name="edit" size={16} color={theme.colors.text.inverse} />
          </View>
        </TouchableOpacity>

        {/* 用户名 */}
        <TouchableOpacity
          style={styles.infoRow}
          onPress={() => {
            setNewUsername(userInfo?.username || '');
            setUsernameModalVisible(true);
          }}
        >
          <View style={styles.infoLeft}>
            <Icon name="person" size={24} color={theme.colors.primary} />
            <Text style={styles.infoLabel}>用户名</Text>
          </View>
          <View style={styles.infoRight}>
            <Text style={styles.infoValue}>{userInfo?.username || '未设置'}</Text>
            <Icon name="chevron-right" size={24} color={theme.colors.text.placeholder} />
          </View>
        </TouchableOpacity>

        {/* 修改密码 */}
        <TouchableOpacity
          style={styles.infoRow}
          onPress={() => setPasswordModalVisible(true)}
        >
          <View style={styles.infoLeft}>
            <Icon name="lock" size={24} color={theme.colors.primary} />
            <Text style={styles.infoLabel}>修改密码</Text>
          </View>
          <View style={styles.infoRight}>
            <Icon name="chevron-right" size={24} color={theme.colors.text.placeholder} />
          </View>
        </TouchableOpacity>
      </View>

      {/* 退出登录按钮 */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Icon name="logout" size={20} color={theme.colors.status.error} />
        <Text style={styles.logoutText}>退出登录</Text>
      </TouchableOpacity>

      {/* 修改用户名 Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={usernameModalVisible}
        onRequestClose={() => setUsernameModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>修改用户名</Text>
            <TextInput
              style={styles.input}
              placeholder="请输入新用户名"
              placeholderTextColor={theme.colors.text.placeholder}
              value={newUsername}
              onChangeText={setNewUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setUsernameModalVisible(false);
                  setNewUsername('');
                }}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleUpdateUsername}
                disabled={submitting}
              >
                <Text style={styles.confirmButtonText}>
                  {submitting ? '提交中...' : '确认'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 修改密码 Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={passwordModalVisible}
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>修改密码</Text>
            <TextInput
              style={styles.input}
              placeholder="请输入旧密码"
              placeholderTextColor={theme.colors.text.placeholder}
              value={oldPassword}
              onChangeText={setOldPassword}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="请输入新密码"
              placeholderTextColor={theme.colors.text.placeholder}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="请确认新密码"
              placeholderTextColor={theme.colors.text.placeholder}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setPasswordModalVisible(false);
                  setOldPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleUpdatePassword}
                disabled={submitting}
              >
                <Text style={styles.confirmButtonText}>
                  {submitting ? '提交中...' : '确认'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 修改头像 Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={avatarModalVisible}
        onRequestClose={() => setAvatarModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalContent]}>
            <Text style={styles.modalTitle}>修改头像</Text>
            
            {/* 头像预览 */}
            <Image
              source={{ uri: localAvatarUri || avatarUrl || userInfo?.avatar || defaultAvatar }}
              style={styles.avatarPreview}
              contentFit="cover"
            />

            {/* 选择图片按钮 */}
            <View style={styles.imagePickerButtons}>
              <TouchableOpacity style={styles.pickerButton} onPress={pickImage}>
                <Icon name="photo-library" size={24} color={theme.colors.primary} />
                <Text style={styles.pickerButtonText}>从相册选择</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickerButton} onPress={takePhoto}>
                <Icon name="camera-alt" size={24} color={theme.colors.primary} />
                <Text style={styles.pickerButtonText}>拍照</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.dividerText}>或输入图片URL</Text>
            
            <TextInput
              style={styles.input}
              placeholder="请输入头像图片URL"
              placeholderTextColor={theme.colors.text.placeholder}
              value={avatarUrl}
              onChangeText={(text) => {
                setAvatarUrl(text);
                setLocalAvatarUri(null); // 输入 URL 时清除本地图片
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setAvatarModalVisible(false);
                  setAvatarUrl('');
                  setLocalAvatarUri(null);
                }}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleUpdateAvatar}
                disabled={submitting}
              >
                <Text style={styles.confirmButtonText}>
                  {submitting ? '上传中...' : '确认'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background.default,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.default,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background.default,
  },
  card: {
    backgroundColor: theme.colors.background.paper,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.background.neutral,
  },
  avatarInitial: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
  },
  avatarInitialText: {
    fontSize: 36,
    fontWeight: '600',
    color: theme.colors.text.inverse,
  },
  avatarEditHint: {
    position: 'absolute',
    bottom: 0,
    right: '35%',
    backgroundColor: theme.colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.background.paper,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 16,
    color: theme.colors.text.primary,
    marginLeft: 12,
  },
  infoRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoValue: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    marginRight: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background.paper,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  logoutText: {
    fontSize: 16,
    color: theme.colors.status.error,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.background.paper,
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 380,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: theme.colors.background.neutral,
    marginBottom: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  avatarPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignSelf: 'center',
    marginBottom: 16,
    backgroundColor: theme.colors.background.neutral,
  },
  imagePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: theme.colors.background.neutral,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pickerButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.text.primary,
  },
  dividerText: {
    textAlign: 'center',
    color: theme.colors.text.placeholder,
    marginBottom: 12,
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  cancelButton: {
    backgroundColor: theme.colors.background.neutral,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  confirmButton: {
    backgroundColor: theme.colors.primary,
  },
  confirmButtonText: {
    fontSize: 16,
    color: theme.colors.text.inverse,
    fontWeight: '600',
  },
});

export default Account;
