import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const variantConfig: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: '#DCFCE7', text: '#15803D' },
  warning: { bg: '#FEF3C7', text: '#B45309' },
  error: { bg: '#FEE2E2', text: '#B91C1C' },
  info: { bg: '#DBEAFE', text: '#1D4ED8' },
  neutral: { bg: '#F1F5F9', text: '#475569' },
};

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
}) => {
  const config = variantConfig[variant];

  return (
    <View style={[styles.container, { backgroundColor: config.bg }]}>
      <Text style={[styles.label, { color: config.text }]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

export default Badge;
