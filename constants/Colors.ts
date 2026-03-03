/**
 * BikePro Color System — UI Supervisor enforced.
 * Premium dark MTB/Downhill theme with neon accents.
 */

// Neon accent colors
const accentOrange = '#FF6B2C';
const accentLime = '#A8E10C';
const accentCyan = '#00E5FF';
const accentMagenta = '#FF2D78';
const accentYellow = '#FFD600';
const accentPurple = '#B388FF';
const accentBlue = '#448AFF';
const accentRed = '#FF5252';

// Surface palette (dark mode first)
const surfaceDark = '#0A0A0F';
const surfaceCard = '#14141F';
const surfaceCardHover = '#1C1C2E';
const surfaceElevated = '#1E1E30';
const surfaceBorder = '#2A2A3E';

// Text
const textPrimary = '#F0F0F5';
const textSecondary = '#8888A0';
const textMuted = '#55556A';

export const theme = {
  colors: {
    background: surfaceDark,
    surface: surfaceCard,
    surfaceHover: surfaceCardHover,
    elevated: surfaceElevated,
    border: surfaceBorder,
    text: textPrimary,
    textSecondary: textSecondary,
    textMuted: textMuted,
    accent: accentOrange,
    accentOrange,
    accentLime,
    accentCyan,
    accentMagenta,
    accentYellow,
    accentPurple,
    accentBlue,
    accentRed,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  font: {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semibold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
    black: 'Inter-Black',
    mono: 'SpaceMono',
  },
};

// Feature tile accent mapping
export const featureColors: Record<string, string> = {
  'dialed-in': accentOrange,
  'shred-check': accentRed,
  'park-picker': accentLime,
  'trail-video': accentCyan,
  'jump-analyzer': accentMagenta,
  'pressure-bot': accentYellow,
  'ride-log': accentPurple,
  'gps-tracker': accentBlue,
};

// Legacy compat export
export default {
  light: {
    text: textPrimary,
    background: surfaceDark,
    tint: accentOrange,
    tabIconDefault: textMuted,
    tabIconSelected: accentOrange,
  },
  dark: {
    text: textPrimary,
    background: surfaceDark,
    tint: accentOrange,
    tabIconDefault: textMuted,
    tabIconSelected: accentOrange,
  },
};
