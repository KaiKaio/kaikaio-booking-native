import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { useCategory } from '../context/CategoryContext';
import { Category } from '../types/category';
import CategoryIcon from '../components/CategoryIcon';
import { theme } from '../theme';
import { createCategory, updateCategory, deleteCategory } from '../services/category';

type Props = NativeStackScreenProps<RootStackParamList, 'CategoryEdit'>;

// 常用图标列表
const COMMON_ICONS = [
  'icon-canyin',
  'icon-jiaotongxinxi',
  'icon-kouhong',
  'icon-fushi',
  'icon-riyongpin',
  'icon-yule',
  'icon-xiyanqu',
  'icon-cunkuan_o',
  'icon-yiliao',
  'icon-shuidiantu',
  'icon-jiushui',
  'icon-tongxun',
  'icon-qiche',
  'icon-aixin',
  'icon-lvyou',
  'icon-chongwu',
  'icon-lingshi',
  'icon-shumajiadianleimu',
  'icon-fangzi',
  'icon-jiajujiafang',
  'icon-huluobu',
  'icon-xingxing',
  'icon-xuexi',
  'icon-jianzhi',
  'icon-ticket_money',
  'icon-shuiguo',
  'icon-huankuan',
  'icon-gongzitiao',
];

export default function CategoryEdit({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { categories, refreshCategories } = useCategory();
  const [activeType, setActiveType] = useState<1 | 2>(route.params?.type || 1);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  
  // 编辑模态框状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [inputName, setInputName] = useState('');
  const [inputIcon, setInputIcon] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFilteredCategories(categories.filter(cat => cat.type === activeType));
  }, [categories, activeType]);

  // 打开新增模态框
  const handleAdd = () => {
    setEditingCategory(null);
    setInputName('');
    setInputIcon(COMMON_ICONS[0]);
    setEditModalVisible(true);
  };

  // 打开编辑模态框
  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setInputName(category.name);
    setInputIcon(category.icon);
    setEditModalVisible(true);
  };

  // 删除确认
  const handleDelete = (category: Category) => {
    Alert.alert(
      '删除分类',
      `确定要删除"${category.name}"吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory({ id: category.id });
              await refreshCategories();
            } catch (err) {
              Alert.alert('错误', '删除失败，请重试');
            }
          },
        },
      ]
    );
  };

  // 保存（新增或编辑）
  const handleSave = async () => {
    if (!inputName.trim()) {
      Alert.alert('提示', '请输入分类名称');
      return;
    }
    if (!inputIcon) {
      Alert.alert('提示', '请选择图标');
      return;
    }

    setLoading(true);
    try {
      if (editingCategory) {
        // 编辑
        await updateCategory({ id: editingCategory.id, name: inputName.trim(), icon: inputIcon });
      } else {
        // 新增
        await createCategory({
          name: inputName.trim(),
          icon: inputIcon,
          type: activeType,
        });
      }
      await refreshCategories();
      setEditModalVisible(false);
    } catch (err) {
      Alert.alert('错误', '保存失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 渲染分类项
  const renderItem = ({ item }: { item: Category }) => (
    <View style={styles.itemContainer}>
      <View style={styles.itemLeft}>
        <View style={styles.iconWrap}>
          <CategoryIcon icon={item.icon} size={24} />
        </View>
        <Text style={styles.itemName}>{item.name}</Text>
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => handleEdit(item)}
        >
          <Text style={styles.editText}>编辑</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => handleDelete(item)}
        >
          <Text style={styles.deleteText}>删除</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // 渲染编辑模态框
  const renderEditModal = () => (
    <Modal
      visible={editModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setEditModalVisible(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setEditModalVisible(false)}
        />
        <View style={[styles.modalContent, { paddingBottom: Math.max(20, insets.bottom) }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Text style={styles.cancelText}>取消</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingCategory ? '编辑分类' : '新增分类'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={loading}>
              <Text style={[styles.saveText, loading && styles.disabledText]}>保存</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>分类名称</Text>
            <TextInput
              style={styles.input}
              value={inputName}
              onChangeText={setInputName}
              placeholder="请输入分类名称"
              maxLength={10}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>选择图标</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.iconList}
            >
              {COMMON_ICONS.map(icon => (
                <TouchableOpacity
                  key={`sel-${icon}`}
                  style={[styles.iconItem, inputIcon === icon && styles.iconItemActive]}
                  onPress={() => setInputIcon(icon)}
                >
                  <CategoryIcon icon={icon} size={28} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>类别编辑</Text>
        <TouchableOpacity onPress={handleAdd} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ 新增</Text>
        </TouchableOpacity>
      </View>

      {/* Type Tab */}
      <View style={styles.typeTabContainer}>
        <TouchableOpacity
          style={[styles.typeTab, activeType === 1 && styles.typeTabActive]}
          onPress={() => setActiveType(1)}
        >
          <Text style={[styles.typeTabText, activeType === 1 && styles.typeTabTextActive]}>支出</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeTab, activeType === 2 && styles.typeTabActive]}
          onPress={() => setActiveType(2)}
        >
          <Text style={[styles.typeTabText, activeType === 2 && styles.typeTabTextActive]}>收入</Text>
        </TouchableOpacity>
      </View>

      {/* Category List */}
      <FlatList
        data={filteredCategories}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>暂无分类，点击右上角新增</Text>
          </View>
        }
      />

      {/* Edit Modal */}
      {renderEditModal()}
    </View>
  );
}

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
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    padding: 4,
  },
  backText: {
    fontSize: 16,
    color: theme.colors.primary,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  addBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addBtnText: {
    color: theme.colors.text.inverse,
    fontSize: 14,
    fontWeight: '500',
  },
  typeTabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: theme.colors.background.neutral,
    borderRadius: 20,
    padding: 3,
  },
  typeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 17,
  },
  typeTabActive: {
    backgroundColor: theme.colors.primary,
  },
  typeTabText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },
  typeTabTextActive: {
    color: theme.colors.text.inverse,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background.paper,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.background.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemName: {
    fontSize: 16,
    color: theme.colors.text.primary,
    fontWeight: '500',
  },
  itemActions: {
    flexDirection: 'row',
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  editText: {
    color: theme.colors.primary,
    fontSize: 14,
  },
  deleteText: {
    color: theme.colors.status.error,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.text.placeholder,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: theme.colors.background.paper,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  cancelText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  saveText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  disabledText: {
    color: theme.colors.text.disabled,
  },
  formGroup: {
    marginTop: 20,
  },
  label: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.background.neutral,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  iconList: {
    paddingVertical: 8,
  },
  iconItem: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.background.neutral,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconItemActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.background.primaryLight,
  },
});
