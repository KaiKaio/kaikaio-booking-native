import React from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import BillItem from './BillItem';
import { theme } from '@/theme';

// 同步状态类型
type SyncStatus = 'syncing' | 'synced' | 'failed';

// 定义 SubItem 类型
export type SubItem = {
  id: number;
  type: string;
  icon: string;
  remark: string;
  amount: number;
  typeId: number;
  date: string;
  payType: '1' | '2'; // '1'=支出，'2'=收入
  rawAmount: number;
  // 同步状态相关
  syncStatus?: SyncStatus; // 'syncing' | 'synced' | 'failed'
  localId?: string; // 本地唯一标识,用于乐观更新时定位
  retryParams?: any; // 用于重试的参数
};

// 定义 DailyBillGroup 类型
export type DailyBillGroup = {
  date: string;
  total: number;
  income: number;
  items: SubItem[];
};

export type BillGroupItemProps = {
  item: DailyBillGroup;
  highlightedLocalId: string | null;
  onDeleteSuccess: () => void;
  onDelete: ({ id, localId }: { id: number; localId?: string }) => Promise<void>;
  onEdit: (id: number) => void;
  onRetry: (localId: string) => Promise<void>;
};

const BillGroupItem: React.FC<BillGroupItemProps> = ({
  item,
  highlightedLocalId,
  onDeleteSuccess,
  onDelete,
  onEdit,
  onRetry,
}) => {
  return (
    <Animated.View
      style={styles.section}
      layout={LinearTransition.springify().damping(26).stiffness(260)}
      entering={FadeInDown.duration(250)}
      exiting={FadeOut.duration(200)}
    >
      <Animated.View style={styles.sectionHeader}>
        <Text style={styles.sectionDate}>{item.date}</Text>
        <Text style={styles.sectionStat}>
          支出: ￥{item.total.toFixed(2)} 收入: ￥{item.income.toFixed(2)}
        </Text>
      </Animated.View>
      {item.items.map((subItem: SubItem, index: number) => (
        <BillItem
          key={subItem.localId || subItem.id}
          isHighlighted={subItem.localId === highlightedLocalId}
          onDeleteSuccess={onDeleteSuccess}
          onDelete={onDelete}
          onEdit={onEdit}
          onRetry={onRetry}
          isLast={index === item.items.length - 1}
          {...subItem}
        />
      ))}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  section: {
    backgroundColor: theme.colors.background.paper,
    borderRadius: 12,
    marginHorizontal: theme.spacing.md,
    marginTop: 16,
    paddingBottom: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionDate: {
    fontWeight: 'bold',
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  sectionStat: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
});

export default React.memo(BillGroupItem);
