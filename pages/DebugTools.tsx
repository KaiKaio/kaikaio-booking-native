import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RootStackParamList } from '../types/navigation';
import { theme } from '@/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

const DebugTools = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [storageData, setStorageData] = useState<Array<{key: string; value: string | null}> | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getAllStorage = async () => {
    setLoading(true);
    try {
      const keys = await AsyncStorage.getAllKeys();
      const values = await AsyncStorage.multiGet(keys);
      const data = values.map(([key, value]) => ({
        key,
        value,
      }));
      setStorageData(data);
    } catch (error) {
      Alert.alert('错误', '获取 AsyncStorage 数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const clearCache = async () => {
    Alert.alert(
      '确认清空缓存',
      '此操作将清除所有本地缓存数据（包括 token），是否继续？',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              Alert.alert('成功', '缓存已清空');
              setStorageData(null);
              setToken(null);
            } catch (error) {
              Alert.alert('错误', '清空缓存失败');
              console.error(error);
            }
          },
        },
      ]
    );
  };

  const getToken = async () => {
    setLoading(true);
    try {
      const tokenValue = await AsyncStorage.getItem('token');
      setToken(tokenValue);
    } catch (error) {
      Alert.alert('错误', '获取 Token 失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('成功', '已复制到剪贴板');
    } catch (error) {
      Alert.alert('错误', '复制失败');
      console.error(error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Debug Tools</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>调试工具</Text>
          
          <TouchableOpacity style={styles.menuItem} onPress={getAllStorage}>
            <View style={styles.menuItemLeft}>
              <Icon name="storage" size={24} color={theme.colors.primary} />
              <Text style={styles.menuItemText}>查看 AsyncStorage</Text>
            </View>
            <Icon name="chevron-right" size={24} color={theme.colors.text.placeholder} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={clearCache}>
            <View style={styles.menuItemLeft}>
              <Icon name="delete-sweep" size={24} color={theme.colors.active} />
              <Text style={styles.menuItemText}>清空缓存</Text>
            </View>
            <Icon name="chevron-right" size={24} color={theme.colors.text.placeholder} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={getToken}>
            <View style={styles.menuItemLeft}>
              <Icon name="vpn-key" size={24} color={theme.colors.primary} />
              <Text style={styles.menuItemText}>查看 Token</Text>
            </View>
            <Icon name="chevron-right" size={24} color={theme.colors.text.placeholder} />
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        )}

        {token !== null && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>Token</Text>
              <TouchableOpacity onPress={() => copyToClipboard(token || '')}>
                <Icon name="content-copy" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal style={styles.resultContent}>
              <Text style={styles.resultText}>{token || '(空)'}</Text>
            </ScrollView>
          </View>
        )}

        {storageData && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>AsyncStorage 数据 ({storageData.length} 条)</Text>
              <TouchableOpacity
                onPress={() => copyToClipboard(JSON.stringify(storageData, null, 2))}
              >
                <Icon name="content-copy" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.resultScroll}>
              {storageData.map((item, index) => (
                <View key={index} style={styles.storageItem}>
                  <Text style={styles.storageKey}>{item.key}</Text>
                  <Text style={styles.storageValue}>
                    {item.value ? (item.value.length > 100 ? item.value.substring(0, 100) + '...' : item.value) : '(null)'}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background.default,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.background.paper,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.default,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    color: theme.colors.text.primary,
    marginLeft: 12,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  resultCard: {
    backgroundColor: theme.colors.background.paper,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  resultContent: {
    maxHeight: 100,
  },
  resultText: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    fontFamily: 'monospace',
  },
  resultScroll: {
    maxHeight: 300,
  },
  storageItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  storageKey: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  storageValue: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    fontFamily: 'monospace',
  },
});

export default DebugTools;