import { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  List: undefined;
  Statistics: undefined;
  Account: undefined;
};

// 收集现有路由，定义路由参数类型
export type RootStackParamList = {
  AuthLoading: undefined;
  Login: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  // 若有其他路由，可在此添加
};
