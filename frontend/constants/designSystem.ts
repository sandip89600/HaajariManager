import { Spacing, BorderRadius, Colors, Shadows, Typography } from './theme';

export const designSystem = {
  colors: Colors,
  spacing: Spacing,
  radius: BorderRadius,
  shadows: Shadows,
  typography: Typography,
  
  // Premium Enterprise Tokens Addition
  brand: {
    primary: '#F97316',
    primaryDark: '#EA580C',
    primaryLight: '#FED7AA',
    backgroundDark: '#0F172A',
    cardDark: '#1E293B',
    borderDark: '#334155',
    backgroundLight: '#F8FAFC',
    cardLight: '#FFFFFF',
    borderLight: '#E2E8F0',
  },
  
  layout: {
    containerPadding: 16,
    cardPadding: 16,
    gutter: 12,
  },
  
  animation: {
    springConfig: {
      damping: 15,
      mass: 1,
      stiffness: 120,
    }
  }
};
