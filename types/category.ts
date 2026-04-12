export interface Category {
  id: number;
  name: string;
  icon: string;
  type: '1' | '2'; // '1': expense, '2': income
  user_id: string;
  is_system?: number; // 是否是系统初始化自带的(1：是预设，0：不是预设)
  background_color?: string | null; // #RRGGBB format for background color, optional
}
