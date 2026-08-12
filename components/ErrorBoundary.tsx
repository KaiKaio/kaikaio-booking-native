import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { recordCrash } from '../utils/crashLogger';

// ===== 全局渲染错误边界 =====
//
// 捕获组件树渲染期异常：记录到本地崩溃日志后展示降级界面，
// 避免一次渲染错误直接导致 App 闪退且无迹可查。

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    void recordCrash({
      kind: 'boundary',
      message: `${error.name}: ${error.message}`,
      stack: error.stack,
      componentStack: errorInfo.componentStack ?? undefined,
    });
    console.error('ErrorBoundary caught:', error, errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>页面出了点问题</Text>
        <Text style={styles.message} numberOfLines={6}>
          {error.message}
        </Text>
        <Text style={styles.hint}>错误已记录，可在「我的 → Debug Tools → 崩溃日志」查看详情</Text>
        <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
          <Text style={styles.buttonText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2329',
    marginBottom: 12,
  },
  message: {
    fontSize: 13,
    color: '#646a73',
    textAlign: 'center',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: '#8f959e',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2a7de1',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
