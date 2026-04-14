import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ToastAndroid,
  Platform,
  Animated
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Icon from 'react-native-vector-icons/MaterialIcons';
import CategoryIcon from './CategoryIcon';
import { deleteBill } from '../services/bill';
import { theme } from '@/theme';

export interface BillItemProps {
  id: number;
  type: string;
  icon: string;
  remark: string;
  amount: number;
  payType?: '1' | '2';  // '1'=支出, '2'=收入
  onDeleteSuccess?: () => void;
  // 删除回调：用于处理“本地乐观数据”删除（避免误调用真实删除接口）
  onDelete?: (payload: { id: number; localId?: string; syncStatus?: 'syncing' | 'synced' | 'failed' }) => Promise<void> | void;
  onEdit?: (id: number) => void;
  isLast?: boolean;
  // 同步状态相关
  syncStatus?: 'syncing' | 'synced' | 'failed';
  localId?: string;
  onRetry?: (localId: string) => void;
  isHighlighted?: boolean;
}

const BillItem: React.FC<BillItemProps> = ({ id, type, icon, remark, amount, payType, onDeleteSuccess, onDelete, onEdit, isLast, syncStatus, localId, onRetry, isHighlighted }) => {
  const [deleting, setDeleting] = useState(false);
  const swipeableRef = useRef<Swipeable>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isHighlighted) {
      flashAnim.setValue(0);
      // 每秒闪 1 次（500ms 亮，500ms 灭），持续 3 秒（共 3 次循环）
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
        Animated.timing(flashAnim, { toValue: 0, duration: 500, useNativeDriver: false }),
        Animated.timing(flashAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
        Animated.timing(flashAnim, { toValue: 0, duration: 500, useNativeDriver: false }),
        Animated.timing(flashAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
        Animated.timing(flashAnim, { toValue: 0, duration: 500, useNativeDriver: false })
      ]).start();
    } else {
      flashAnim.setValue(0);
    }
  }, [isHighlighted, flashAnim]);

  const animatedStyle = {
    backgroundColor: flashAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [theme.colors.background.paper, theme.colors.background.primaryLight,] // Using a semi-transparent primary color
    })
  };

  // 根据 payType 判断颜色：1=支出（绿色），2=收入（红色）
  const amountColor = payType === '1' ? theme.colors.status.success : theme.colors.status.error;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // 乐观更新（本地数据）直接走本地删除逻辑，避免错误调用真实删除接口
      if (localId && id < 0) {
        if (!onDelete) {
          showToast('本地删除未配置，请重试');
          return;
        }
        await onDelete({ id, localId, syncStatus });
        // 仅关闭滑动组件：本地列表由父组件更新
        swipeableRef.current?.close();
        return;
      }

      const res = await deleteBill(id);
      if (res.code === 200) {
        // Close swipeable
        swipeableRef.current?.close();
        // Notify parent
        onDeleteSuccess?.();
      } else {
        showToast('删除失败，请重试');
      }
    } catch (error) {
      showToast('删除失败，请重试');
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('提示', message);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      '提示',
      '确定要删除该账单吗？',
      [
        {
          text: '取消',
          style: 'cancel',
          onPress: () => {
            swipeableRef.current?.close();
          }
        },
        {
          text: '确认删除',
          style: 'destructive',
          onPress: handleDelete
        }
      ]
    );
  };

  const handleEdit = () => {
    swipeableRef.current?.close();
    onEdit?.(id);
  };

  // 处理同步状态点击
  const handleSyncStatusPress = () => {
    if (syncStatus === 'failed' && localId && onRetry) {
      onRetry(localId);
    }
  };

  // 渲染同步状态图标
  const renderSyncIndicator = () => {
    if (syncStatus === 'syncing') {
      return (
        <View style={styles.syncIndicator}>
          <ActivityIndicator size="small" color={theme.colors.status.info} />
        </View>
      );
    }
    if (syncStatus === 'failed') {
      return (
        <TouchableOpacity style={styles.syncIndicator} onPress={handleSyncStatusPress}>
          {/* <IconFont name="warning" size={18} color={theme.colors.status.warning} /> */}
          <Icon
            name={'warning'}
            size={18}
            color={theme.colors.status.warning}
          />
        </TouchableOpacity>
      );
    }
    return null;
  };

  const renderRightActions = () => {
    return (
      <View style={styles.rightActions}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={handleEdit}
        >
          <Text style={styles.editText}>编辑</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={confirmDelete}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color={theme.colors.text.inverse} />
          ) : (
            <Text style={styles.deleteText}>删除</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
    >
      <Animated.View style={[styles.item, isLast && styles.lastItem, animatedStyle]}>
        <View style={styles.itemIconWrap}>
          <CategoryIcon icon={icon} size={22} />
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemType}>{type}</Text>
          {remark ? <Text style={styles.itemRemark}>{remark}</Text> : null}
        </View>
        {renderSyncIndicator()}
        <Text style={[styles.itemAmount, { color: amountColor }]}>{ payType !== '1' && '+' }{amount.toFixed(2)}</Text>
      </Animated.View>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.colors.background.paper,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.background.neutral
  },
  lastItem: {
    borderBottomWidth: 0,
    paddingBottom: 4,
  },
  itemIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  itemInfo: {
    flex: 1
  },
  itemType: {
    fontSize: theme.typography.size.md,
    fontWeight: theme.typography.weight.bold,
  },
  itemRemark: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginTop: 2
  },
  itemAmount: {
    fontSize: 16,
    color: theme.colors.status.success,
    fontWeight: 500,
    minWidth: 60,
    textAlign: 'right'
  },
  rightActions: {
    flexDirection: 'row',
    height: '100%'
  },
  editButton: {
    backgroundColor: theme.colors.status.info,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%'
  },
  editText: {
    color: theme.colors.text.inverse,
    fontWeight: 'bold',
    fontSize: 14
  },
  deleteButton: {
    backgroundColor: theme.colors.status.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%'
  },
  deleteText: {
    color: theme.colors.text.inverse,
    fontWeight: 'bold',
    fontSize: 14
  },
  syncIndicator: {
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  }
});

export default BillItem;
