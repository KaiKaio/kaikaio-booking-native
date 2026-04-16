import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import CategoryIcon from './CategoryIcon';
import { theme } from '@/theme';
import { Category } from '@/types/category';

interface TypePickerProps {
  visible: boolean;
  selectedTypeId: number | null;
  categories: Category[];
  getCategoryIcon: (name: string) => string;
  onClose: () => void;
  onSelect: (typeId: number | null) => void;
  footerHeight: number;
}

const TypePicker: React.FC<TypePickerProps> = ({
  visible,
  selectedTypeId,
  categories,
  getCategoryIcon,
  onClose,
  onSelect,
  footerHeight,
}) => {
  const handleSelect = (typeId: number | null) => {
    onSelect(typeId);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.container} onStartShouldSetResponder={() => true}>
          {/* 头部 */}
          <View style={styles.header}>
            <Text style={styles.title}>选择分类</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* 内容区域 */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 全部选项 */}
            <TouchableOpacity
              style={[
                styles.item,
                selectedTypeId === null && styles.itemSelected
              ]}
              activeOpacity={0.7}
              onPress={() => handleSelect(null)}
            >
              <View style={[
                styles.iconWrap,
                selectedTypeId === null && styles.iconWrapSelected
              ]}>
                <Text style={styles.iconText}>📋</Text>
              </View>
              <Text style={[
                styles.itemText,
                selectedTypeId === null && styles.itemTextSelected
              ]}>全部</Text>
              {selectedTypeId === null && (
                <View style={styles.checkWrap}>
                  <Text style={styles.checkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* 分隔线 */}
            <View style={styles.divider} />

            {/* 分类列表 */}
            {categories.map((category) => {
              const isSelected = selectedTypeId === category.id;
              return (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.item,
                    isSelected && styles.itemSelected
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleSelect(category.id)}
                >
                  <View style={[
                    styles.iconWrap,
                    isSelected && styles.iconWrapSelected
                  ]}>
                    <CategoryIcon
                      icon={getCategoryIcon(category.name)}
                      size={22}
                      color={isSelected ? theme.colors.primary : theme.colors.text.primary}
                    />
                  </View>
                  <Text style={[
                    styles.itemText,
                    isSelected && styles.itemTextSelected
                  ]}>{category.name}</Text>
                  {isSelected && (
                    <View style={styles.checkWrap}>
                      <Text style={styles.checkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* 底部安全区域 */}
          <View style={[styles.footer, { height: footerHeight }]} />
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: theme.colors.background.paper,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    minHeight: '50%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    position: 'relative',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.background.neutral,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 8,
    marginHorizontal: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  itemSelected: {
    backgroundColor: `${theme.colors.primary}15`,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.background.neutral,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  iconWrapSelected: {
    backgroundColor: `${theme.colors.primary}20`,
  },
  iconText: {
    fontSize: 18,
  },
  itemText: {
    fontSize: 16,
    color: theme.colors.text.primary,
    flex: 1,
  },
  itemTextSelected: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  checkWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkText: {
    fontSize: 14,
    color: theme.colors.text.inverse,
    fontWeight: 'bold',
  },
  footer: {
    backgroundColor: theme.colors.background.paper,
  },
});

export default TypePicker;
