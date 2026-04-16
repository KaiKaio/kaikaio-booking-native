import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import CategoryIcon from '@/components/CategoryIcon.tsx';
import { RootStackParamList } from '@/types/navigation';
import { useCategory } from '../context/CategoryContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/theme';

type CategoryDetailsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CategoryDetails'>;
type CategoryDetailsRouteProp = RouteProp<RootStackParamList, 'CategoryDetails'>;

interface CategoryDetailsProps {
  navigation: CategoryDetailsNavigationProp;
  route: CategoryDetailsRouteProp;
}

const CategoryDetails: React.FC<CategoryDetailsProps> = ({ navigation, route }) => {
  const { type_id, type_name } = route.params;
  const insets = useSafeAreaInsets();
  const { getCategoryItem } = useCategory();

  const getCategoryItemMemo = React.useMemo(() => {
    return getCategoryItem(type_id);
  }, [type_id, getCategoryItem]);

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      {/* Safe Area Background */}
      <View style={{ height: insets.top, backgroundColor: theme.colors.background.paper }} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <MaterialIcons name="arrow-back-ios" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>明细</Text>
        <View style={styles.placeholder} />
      </View>

      {/* 主内容 */}
      <View style={styles.content}>
        <View style={styles.infoCard}>
          <View style={[styles.iconWrapper, getCategoryItemMemo?.background_color && { backgroundColor: getCategoryItemMemo.background_color }]}>
            <CategoryIcon icon={getCategoryItemMemo?.icon || 'question'} size={22} />
          </View>
          <Text style={styles.value}>{type_name}</Text>
        </View>

        <View style={styles.placeholderBox}>
          <Text style={styles.placeholderText}>详细内容区域</Text>
          <Text style={styles.placeholderDescription}>后续完善具体内容</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
    borderBottomColor: theme.colors.border
  },
  backButton: {
    padding: theme.spacing.sm,
  },
  headerTitle: {
    fontSize: theme.typography.size.lg,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.text.primary,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: theme.spacing.md,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.paper,
    borderRadius: theme.spacing.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  value: {
    fontSize: theme.typography.size.md,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.weight.bold,
  },
  placeholderBox: {
    flex: 1,
    backgroundColor: theme.colors.background.paper,
    borderRadius: theme.spacing.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.background.default,
    borderStyle: 'dashed',
    marginTop: theme.spacing.lg,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  placeholderText: {
    fontSize: theme.typography.size.md,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.weight.medium,
  },
  placeholderDescription: {
    fontSize: theme.typography.size.sm,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },
});

export default CategoryDetails;
