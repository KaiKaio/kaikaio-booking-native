import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import { registerRootComponent } from 'expo';
import App from './App';
import { name as appName } from './app.json';
import { initCrashLogger } from './utils/crashLogger';

// 尽早安装全局异常捕获：JS 层致命错误/未捕获 Promise 异常会落盘到本地崩溃日志，
// 供「我的 → Debug Tools → 崩溃日志」查看，用于追查偶发闪退
initCrashLogger();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// Also register the app name for bare React Native Android builds
AppRegistry.registerComponent(appName, () => App);

