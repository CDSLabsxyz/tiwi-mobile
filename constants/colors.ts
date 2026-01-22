/**
 * Design tokens from Figma
 * Exact color values as specified in the design
 */
export const colors = {
  // Primary
  primaryCTA: "#B1F128",

  // Backgrounds
  bg: "#010501",
  bgSemi: "#0B0F0A",
  bgCards: "#121712",
  bgStroke: "#1F261E",
  bgShade20: "#0D3600",

  // Text
  titleText: "#FFFFFF",
  bodyText: "#B5B5B5",
  mutedText: "#7C7C7C",
  mutedHiddenText: "#8F8F8F",

  // Accents / special
  accentDark40: "#156200",

  // Status
  error: "#FF5C5C",
  success: "#3FEA9B",

  // Status bar (light theme for dark background)
  statusBarLight: "#f3fefcfa",
} as const;

export type ColorKey = keyof typeof colors;


