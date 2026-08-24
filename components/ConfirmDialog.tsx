import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '@/theme';

export interface ConfirmDialogConfig {
  title: string;
  message: string;
  cancelText?: string;
  confirmText?: string;
  onCancel?: () => void;
  onConfirm?: () => void;
}

interface ConfirmDialogProps extends ConfirmDialogConfig {
  visible: boolean;
  onRequestClose?: () => void;
}

/**
 * 通用确认对话框（基于 Modal 自绘，不依赖原生 Alert.alert）。
 *
 * 背景：Android 15 / targetSdk 35 / edge-to-edge 下 RN 的 Alert.alert
 * 弹窗存在已知缺陷（可能不显示），这里用 JS Modal 替代以保证弹窗稳定出现。
 */
const ConfirmDialog = ({
  visible,
  title,
  message,
  cancelText = '取消',
  confirmText = '确定',
  onCancel,
  onConfirm,
  onRequestClose,
}: ConfirmDialogProps) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose || onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnCancel]}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text style={styles.btnCancelText}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnConfirm]}
              onPress={onConfirm}
              activeOpacity={0.7}
            >
              <Text style={styles.btnConfirmText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  panel: {
    width: '100%',
    backgroundColor: theme.colors.background.paper,
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: {
    backgroundColor: theme.colors.background.neutral,
  },
  btnConfirm: {
    backgroundColor: theme.colors.btn,
  },
  btnCancelText: {
    color: theme.colors.text.secondary,
    fontSize: 15,
    fontWeight: '500',
  },
  btnConfirmText: {
    color: theme.colors.text.inverse,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default ConfirmDialog;
