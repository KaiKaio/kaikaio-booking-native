import React from 'react';
import { Text } from 'react-native';
import IconFont from './IconFont';
import { theme } from '@/theme';

interface CategoryIconProps {
  icon: string;
  size?: number;
  color?: string;
  style?: any;
}

const CategoryIcon: React.FC<CategoryIconProps> = ({ icon, size = 24, color = theme.colors.text.primary, style }) => {
  if (icon && icon.startsWith('icon-')) {
    const iconName = icon.replace('icon-', '');
    return <IconFont name={iconName} size={size} color={color} style={style} />;
  }

  return <Text style={[{ fontSize: size, color }, style]}>{icon || '❓'}</Text>;
};

export default CategoryIcon;
