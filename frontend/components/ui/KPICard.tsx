import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, interpolate, Extrapolation, runOnJS } from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { SkeletonLoader } from './SkeletonLoader';

export interface KPICardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  trend?: number;
  isLoading?: boolean;
}

const AnimatedNumber: React.FC<{ value: number }> = ({ value }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    animatedValue.value = withTiming(value, { duration: 1000 });
  }, [value]);

  useAnimatedStyle(() => {
    runOnJS(setDisplayValue)(Math.round(animatedValue.value));
    return {};
  });

  return <Text style={styles.valueText}>{displayValue}</Text>;
};

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color,
  trend,
  isLoading = false,
}) => {
  const { theme, isDark } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
        <View style={styles.header}>
          <SkeletonLoader width={100} height={20} borderRadius={4} />
          <SkeletonLoader width={40} height={40} borderRadius={20} />
        </View>
        <SkeletonLoader width={150} height={36} borderRadius={8} style={{ marginTop: 12 }} />
        <SkeletonLoader width={120} height={16} borderRadius={4} style={{ marginTop: 8 }} />
      </View>
    );
  }

  const isPositive = trend && trend > 0;
  const trendColor = isPositive ? '#22C55E' : '#EF4444';
  const trendIcon = isPositive ? 'trending-up' : 'trending-down';
  const bgColors = isDark ? ['#1E293B', '#0F172A'] : ['#FFFFFF', '#F8FAFC'];

  return (
    <LinearGradient colors={bgColors as [string, string]} style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#94A3B8' : '#64748B' }]}>{title}</Text>
        <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
          <Feather name={icon} size={20} color={color} />
        </View>
      </View>
      
      <View style={styles.valueContainer}>
        {typeof value === 'number' ? (
          <AnimatedNumber value={value} />
        ) : (
          <Text style={[styles.valueText, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>{value}</Text>
        )}
      </View>

      <View style={styles.footer}>
        {trend !== undefined && (
          <View style={[styles.trendContainer, { backgroundColor: `${trendColor}15` }]}>
            <Feather name={trendIcon} size={14} color={trendColor} />
            <Text style={[styles.trendText, { color: trendColor }]}>
              {Math.abs(trend)}%
            </Text>
          </View>
        )}
        {subtitle && (
          <Text style={[styles.subtitle, { color: isDark ? '#64748B' : '#94A3B8' }]}>
            {subtitle}
          </Text>
        )}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  valueContainer: {
    marginTop: 16,
  },
  valueText: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  trendText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
});

export default KPICard;
