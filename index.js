import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import { registerRootComponent } from 'expo';
import * as Sentry from '@sentry/react-native';
import App from './App';
import { name as appName } from './app.json';
import { initSentry } from './utils/sentry';
import { initCrashLogger } from './utils/crashLogger';

// 尽早初始化 Sentry：接管原生层崩溃/ANR/JS 异常上报与面包屑采集；
// 随后安装本地崩溃日志，其全局处理器会链式调用 Sentry 的处理器，两者互不影响
initSentry();
initCrashLogger();

// wrap 包裹根组件：崩溃发生时自动附带 React 渲染上下文
const WrappedApp = Sentry.wrap(App);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(WrappedApp);

// Also register the app name for bare React Native Android builds
AppRegistry.registerComponent(appName, () => WrappedApp);

