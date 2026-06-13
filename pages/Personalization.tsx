import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RootStackParamList } from '../types/navigation';
import { theme } from '@/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getKeepLastDate, setKeepLastDate } from '@/utils/storage';

const Personalization = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [keepLastDate, setKeepLastDateState] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      const value = await getKeepLastDate();
      setKeepLastDateState(value);
    };
    loadSettings();
  }, []);

  const handleToggleKeepLastDate = async (value: boolean) => {
    setKeepLastDateState(value);
    await setKeepLastDate(value);
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
        <Text style={styles.headerTitle}>个性化</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>退出保留日期</Text>
              <Text style={styles.settingDescription}>
                打开 App 时首次记账使用上次记账的日期
              </Text>
            </View>
            <Switch
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.background.paper}
              ios_backgroundColor={theme.colors.border}
              onValueChange={handleToggleKeepLastDate}
              value={keepLastDate}
            />
          </View>
        </View>
      </View>
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
    padding: 16,
  },
  card: {
    backgroundColor: theme.colors.background.paper,
    borderRadius: 16,
    padding: 16,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: theme.colors.text.placeholder,
    lineHeight: 18,
  },
});

export default Personalization;