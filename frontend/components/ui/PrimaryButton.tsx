import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';

export interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'solid' | 'outline' | 'ghost';
  style?: any;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  label,
  onPress,
  disabled = false,
  loading = false,
  size = 'md',
  variant = 'solid',
  style,
}) => {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    if (!disabled && !loading) {
      scale.value = withTiming(0.95, { duration: 100 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 100 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const height = size === 'sm' ? 36 : size === 'lg' ? 56 : 48;
  const paddingHorizontal = size === 'sm' ? 16 : size === 'lg' ? 32 : 24;
  const fontSize = size === 'sm' ? 14 : size === 'lg' ? 18 : 16;
  const isSolid = variant === 'solid';
  const isOutline = variant === 'outline';
  
  const content = (
    <View style={[
      styles.content, 
      { height, paddingHorizontal },
      isOutline && { borderWidth: 1, borderColor: theme?.primary || '#F97316', borderRadius: 16 },
    ]}>
      {loading ? (
        <ActivityIndicator color={isSolid ? '#FFFFFF' : (theme?.primary || '#F97316')} />
      ) : (
        <Text style={[
          styles.label, 
          { fontSize },
          { color: isSolid ? '#FFFFFF' : (theme?.primary || '#F97316') }
        ]}>
          {label}
        </Text>
      )}
    </View>
  );

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[
        styles.container,
        animatedStyle,
        (disabled || loading) && styles.disabled,
        !isSolid && { backgroundColor: variant === 'ghost' ? 'transparent' : (theme?.backgroundDefault || '#FFFFFF') },
        style,
      ]}
    >
      {isSolid ? (
        <LinearGradient
          colors={['#F97316', '#EA580C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {content}
        </LinearGradient>
      ) : content}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  gradient: {
    borderRadius: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  disabled: {
    opacity: 0.4,
  },
});

export default PrimaryButton;
