import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  actionLabel,
  onAction,
}) => {
  const { theme, isDark } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.leftContent}>
        <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {actionLabel && onAction && (
        <Pressable 
          onPress={onAction} 
          style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.7 }]}
          hitSlop={8}
        >
          <Text style={[styles.actionText, { color: theme?.primary || '#F97316' }]}>
            {actionLabel}
          </Text>
          <Feather name="chevron-right" size={16} color={theme?.primary || '#F97316'} />
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  leftContent: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 2,
  },
});

export default SectionHeader;
