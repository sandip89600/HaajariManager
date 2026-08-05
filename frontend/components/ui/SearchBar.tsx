import React, { useState } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolateColor } from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Search...',
  onClear,
}) => {
  const { theme, isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useSharedValue(0);
  const fadeAnim = useSharedValue(value.length > 0 ? 1 : 0);

  // Update fade animation based on value length
  React.useEffect(() => {
    fadeAnim.value = withTiming(value.length > 0 ? 1 : 0, { duration: 200 });
  }, [value]);

  const handleFocus = () => {
    setIsFocused(true);
    focusAnim.value = withTiming(1, { duration: 200 });
  };

  const handleBlur = () => {
    setIsFocused(false);
    focusAnim.value = withTiming(0, { duration: 200 });
  };

  const handleClear = () => {
    onChangeText('');
    if (onClear) onClear();
  };

  const containerAnimatedStyle = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      focusAnim.value,
      [0, 1],
      [isDark ? '#334155' : '#E2E8F0', theme?.primary || '#F97316']
    );
    return {
      borderColor,
    };
  });

  const clearButtonAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: fadeAnim.value,
      transform: [{ scale: fadeAnim.value }],
    };
  });

  return (
    <Animated.View style={[
      styles.container,
      { backgroundColor: isDark ? '#1E293B' : '#F8FAFC' },
      containerAnimatedStyle,
    ]}>
      <Feather name="search" size={20} color={isFocused ? (theme?.primary || '#F97316') : (isDark ? '#94A3B8' : '#64748B')} style={styles.icon} />
      <TextInput
        style={[styles.input, { color: isDark ? '#F8FAFC' : '#0F172A' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      <Animated.View style={clearButtonAnimatedStyle}>
        <Pressable onPress={handleClear} style={styles.clearButton} hitSlop={10}>
          <Feather name="x-circle" size={18} color={isDark ? '#94A3B8' : '#64748B'} />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    height: '100%',
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
});

export default SearchBar;
