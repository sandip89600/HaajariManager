import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { PrimaryButton } from './PrimaryButton';

export interface EmptyStateProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}) => {
  const { theme, isDark } = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
        <Feather name={icon} size={48} color={theme?.primary || '#F97316'} />
      </View>
      <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
        {title}
      </Text>
      <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
        {subtitle}
      </Text>
      {actionLabel && onAction && (
        <View style={styles.actionContainer}>
          <PrimaryButton label={actionLabel} onPress={onAction} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  actionContainer: {
    width: '100%',
    maxWidth: 300,
  },
});

export default EmptyState;
