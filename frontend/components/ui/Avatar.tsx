import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export interface AvatarProps {
  name: string;
  imageUri?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

const AVATAR_COLORS = ['#F97316', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#EAB308'];

export const Avatar: React.FC<AvatarProps> = ({
  name,
  imageUri,
  size = 'md',
  color,
}) => {
  const { isDark } = useTheme();

  // Simple string hash for consistent colors
  const getHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };

  const bgColor = color || AVATAR_COLORS[getHash(name) % AVATAR_COLORS.length];
  
  const getInitials = (nameString: string) => {
    return nameString
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const dimensions = {
    sm: 32,
    md: 48,
    lg: 64,
  };

  const fontSizes = {
    sm: 12,
    md: 18,
    lg: 24,
  };

  const dim = dimensions[size];
  const fontSize = fontSizes[size];

  return (
    <View style={[
      styles.container, 
      { 
        width: dim, 
        height: dim, 
        borderRadius: dim / 2,
        backgroundColor: bgColor + (isDark ? '30' : '20'),
        borderColor: bgColor + '50',
      }
    ]}>
      {imageUri ? (
        <Image 
          source={{ uri: imageUri }} 
          style={{ width: dim, height: dim, borderRadius: dim / 2 }} 
        />
      ) : (
        <Text style={[
          styles.initials, 
          { 
            fontSize, 
            color: isDark ? bgColor : bgColor,
          }
        ]}>
          {getInitials(name)}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  initials: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default Avatar;
