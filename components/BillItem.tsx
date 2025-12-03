import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ToastAndroid,
  Platform
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import CategoryIcon from './CategoryIcon';
import { deleteBill } from '../services/bill';

export interface BillItemProps {
  id: number;
  type: string;
  icon: string;
  remark: string;
  amount: number;
  onDeleteSuccess?: () => void;
}

const BillItem: React.FC<BillItemProps> = ({ id, type, icon, remark, amount, onDeleteSuccess }) => {
  const [deleting, setDeleting] = useState(false);
  const swipeableRef = React.useRef<Swipeable>(null);

  const handleDelete = async () => {
    setDeleting(true);
    try {
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

  const renderRightActions = () => {
    return (
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={confirmDelete}
        disabled={deleting}
      >
        {deleting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.deleteText}>删除</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
    >
      <View style={styles.item}>
        <View style={styles.itemIconWrap}>
          <CategoryIcon icon={icon} size={22} />
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemType}>{type}</Text>
          {remark ? <Text style={styles.itemRemark}>{remark}</Text> : null}
        </View>
        <Text style={styles.itemAmount}>{amount.toFixed(2)}</Text>
      </View>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F6F8FA'
  },
  itemIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  itemInfo: {
    flex: 1
  },
  itemType: {
    fontSize: 16,
    color: '#222',
    fontWeight: 'bold'
  },
  itemRemark: {
    fontSize: 12,
    color: '#888',
    marginTop: 2
  },
  itemAmount: {
    fontSize: 16,
    color: '#1BC47D',
    fontWeight: 'bold',
    minWidth: 60,
    textAlign: 'right'
  },
  deleteButton: {
    backgroundColor: '#FF4D4F',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%'
  },
  deleteText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14
  }
});

export default BillItem;
