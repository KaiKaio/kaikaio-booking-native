// 轻量账单列表刷新总线：外部（如周期账单静默生成）产生新账单后
// 通知 List 页重新拉取，避免引入额外依赖。
type Listener = () => void;

const listeners: Set<Listener> = new Set();

export const billRefreshBus = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  notify(): void {
    listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('billRefreshBus listener error', error);
      }
    });
  },
};
