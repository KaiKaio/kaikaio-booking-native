import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RootStackParamList } from '../types/navigation';
import { theme } from '@/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

const About = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [clickCount, setClickCount] = useState(0);
  const lastClickTime = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const version = Constants.expoConfig?.version || '0.5.0';

  const handleVersionPress = () => {
    const now = Date.now();
    
    if (now - lastClickTime.current > 500) {
      setClickCount(1);
    } else {
      const newCount = clickCount + 1;
      setClickCount(newCount);
      
      if (newCount >= 5) {
        setClickCount(0);
        navigation.navigate('DebugTools');
        return;
      }
    }
    
    lastClickTime.current = now;
    
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    timerRef.current = setTimeout(() => {
      setClickCount(0);
    }, 500);
  };

  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>关于</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.card}>
          <View style={styles.appInfo}>
            <Icon name="account-balance-wallet" size={60} color={theme.colors.primary} />
            <Text style={styles.appName}>Kaikaio Booking</Text>
            <TouchableOpacity onPress={handleVersionPress} activeOpacity={0.7}>
              <Text style={styles.version}>版本 {version}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>应用信息</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>应用名称</Text>
              <Text style={styles.infoValue}>KaikaioBooking</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>版本号</Text>
              <Text style={styles.infoValue}>{version}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>构建环境</Text>
              <Text style={styles.infoValue}>{__DEV__ ? '开发环境' : '生产环境'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2024 Kaikaio Booking</Text>
          <Text style={styles.footerSubtext}>简单高效的记账工具</Text>
        </View>
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
  appInfo: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  appName: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginTop: 16,
  },
  version: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    marginTop: 8,
  },
  infoSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  infoLabel: {
    fontSize: 15,
    color: theme.colors.text.secondary,
  },
  infoValue: {
    fontSize: 15,
    color: theme.colors.text.primary,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  footerSubtext: {
    fontSize: 12,
    color: theme.colors.text.placeholder,
    marginTop: 4,
  },
});

export default About;