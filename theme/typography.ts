export const typography = {
  // Base font size scale
  // Adjusted smaller as requested (base 14px instead of 16px)
  size: {
    xs: 10,
    sm: 12,
    md: 14, // Base
    lg: 16,
    xl: 20,
    xxl: 24,
    display: 32,
  },
  
  lineHeight: {
    base: 1.5,
    tight: 1.2,
    loose: 1.8,
  },
  
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    bold: 'bold' as const,
  }
};