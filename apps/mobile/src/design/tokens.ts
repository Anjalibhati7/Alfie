import { Platform } from 'react-native';

export const colors = {
  ink: '#0D1821',
  yale: '#344966',
  powder: '#B4CDED',
  porcelain: '#F0F4EF',
  terracotta: '#A24C3F',
} as const;
export const semanticColors = {
  background: colors.porcelain,
  text: colors.ink,
  secondaryText: colors.yale,
  subtleSurface: colors.powder,
  action: colors.terracotta,
  onAction: colors.porcelain,
  divider: colors.yale,
  focus: colors.yale,
} as const;
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;
export const typography = {
  family: {
    editorial: Platform.select({
      ios: 'Georgia',
      android: 'serif',
      default: 'Georgia, serif',
    }),
  },
  title: { fontSize: 40, lineHeight: 48 },
  heading: { fontSize: 24, lineHeight: 32 },
  body: { fontSize: 18, lineHeight: 28 },
  label: { fontSize: 14, lineHeight: 20 },
} as const;
export const radius = { none: 0, sm: 4, md: 8 } as const;
export const border = { thin: 1, focus: 2 } as const;
