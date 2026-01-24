import { colors } from '@/constants/colors';

export const Colors = {
  light: {
    text: colors.titleText,
    background: colors.bg,
    tint: colors.primaryCTA,
    icon: colors.mutedText,
    tabIconDefault: colors.mutedText,
    tabIconSelected: colors.primaryCTA,
    primary: colors.primaryCTA,
    secondary: colors.accentDark40,
    error: colors.error,
    success: colors.success,
    card: colors.bgSemi,
    border: colors.bgStroke,
  },
  dark: {
    text: colors.titleText,
    background: colors.bg,
    tint: colors.primaryCTA,
    icon: colors.mutedText,
    tabIconDefault: colors.mutedText,
    tabIconSelected: colors.primaryCTA,
    primary: colors.primaryCTA,
    secondary: colors.accentDark40,
    error: colors.error,
    success: colors.success,
    card: colors.bgCards,
    border: colors.bgStroke,
  },
};

import { typography } from '@/constants/typography';

export const Fonts = {
  light: typography.fontFamily.light,
  regular: typography.fontFamily.regular,
  medium: typography.fontFamily.medium,
  semibold: typography.fontFamily.semibold,
  bold: typography.fontFamily.bold,
  extraBold: typography.fontFamily.extraBold,
};
