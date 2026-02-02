import 'react-native-gesture-handler/jestSetup';
const { jest } = require('@jest/globals');
// Mock expo-constants
jest.mock('expo-constants', () => ({
  statusBarHeight: 20,
  manifest: {},
  expoConfig: {},
  expoGoConfig: {},
  easConfig: {},
}));

// Mock @react-navigation/native-stack
jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');
  const mockNavigation = {
    navigate: jest.fn(),
    replace: jest.fn(),
    goBack: jest.fn(),
    push: jest.fn(),
    pop: jest.fn(),
    addListener: jest.fn(() => () => {}),
  };
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }) => React.createElement('View', {}, children),
      Screen: ({ component, children }) => {
        if (component) {
          return React.createElement(component, { navigation: mockNavigation });
        }
        return children;
      },
    }),
  };
});

// Mock @react-navigation/native
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      setOptions: jest.fn(),
      addListener: jest.fn(() => () => {}),
      isFocused: jest.fn(() => true),
    }),
    useRoute: () => ({
      params: {},
      key: 'test-key',
      name: 'test-screen',
    }),
  };
});

// Mock @react-navigation/bottom-tabs
jest.mock('@react-navigation/bottom-tabs', () => {
  const React = require('react');
  return {
    createBottomTabNavigator: () => ({
      Navigator: ({ children }) => React.createElement('View', {}, children),
      Screen: ({ component, children }) => {
        if (component) {
          return React.createElement(component, {});
        }
        return children;
      },
    }),
  };
});

// Mock @react-navigation/elements to avoid SafeAreaProviderCompat issues
jest.mock('@react-navigation/elements', () => {
  const actual = jest.requireActual('@react-navigation/elements');
  return {
    ...actual,
    SafeAreaProviderCompat: ({ children }) => children,
  };
});

// Mock expo-modules-core
jest.mock('expo-modules-core', () => ({
  requireNativeModule: jest.fn(),
  requireOptionalNativeModule: jest.fn(),
  requireNativeViewManager: jest.fn(),
  EventEmitter: jest.fn(() => ({
    addListener: jest.fn(),
    removeListener: jest.fn(),
  })),
  NativeModulesProxy: {},
  ProxyNativeModule: {},
}));

// Mock expo-clipboard
jest.mock('expo-clipboard', () => ({
  getStringAsync: jest.fn(() => Promise.resolve('')),
  setStringAsync: jest.fn(() => Promise.resolve()),
  addClipboardListener: jest.fn(() => ({ remove: jest.fn() })),
  removeClipboardListener: jest.fn(),
}));

// Mock expo-image
jest.mock('expo-image', () => {
  const React = require('react');
  const View = require('react-native').View;
  return {
    Image: (props) => React.createElement(View, props),
  };
});

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const MOCK_INITIAL_METRICS = {
    frame: { x: 0, y: 0, width: 0, height: 0 },
    insets: { top: 0, left: 0, right: 0, bottom: 0 },
  };
  
  const Context = React.createContext(MOCK_INITIAL_METRICS);
  Context.displayName = 'SafeAreaContext'; // 方便调试

  return {
    __esModule: true,
    default: MOCK_INITIAL_METRICS,
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => React.createElement(require('react-native').View, {}, children),
    useSafeAreaInsets: jest.fn(() => MOCK_INITIAL_METRICS.insets),
    useSafeAreaFrame: jest.fn(() => MOCK_INITIAL_METRICS.frame),
    SafeAreaContext: Context,
    initialWindowMetrics: MOCK_INITIAL_METRICS,
  };
});

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
