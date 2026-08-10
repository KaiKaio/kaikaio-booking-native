import { NavigatorScreenParams } from '@react-navigation/native';
import { ParsedBill } from '../services/parser/types';

export type MainTabParamList = {
  // openForm: 打开记账表单（漏记提示等场景跳转用）
  List: { autoBill?: ParsedBill; openForm?: boolean } | undefined;
  Statistics: undefined;
  Account: undefined;
};

// 收集现有路由，定义路由参数类型
export type RootStackParamList = {
  AuthLoading: undefined;
  Login: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  CategoryEdit: { type?: '1' | '2' }; // '1': expense, '2': income, optional filter
  CategoryDetails: { type_id: number; type_name: string; pay_type: '1' | '2' };
  About: undefined;
  DebugTools: undefined;
  Personalization: undefined;
  RecurringBills: undefined;
  // 若有其他路由，可在此添加
};
