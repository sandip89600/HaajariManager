import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Animated,
  Easing,
  AccessibilityInfo,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";

import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import {
  getNavigationForRole,
  getNormalizedRole,
  NavItemConfig,
} from "@/navigation/navigationConfig";

interface RoleBottomNavigationProps extends BottomTabBarProps {
  role?: string | null;
  onOpenQrScanner: () => void;
}

/**
 * Floating Center QR Scanner Button with subtle continuous vertical floating motion inside the curved notch.
 */
function FloatingCenterQrButton({
  label,
  theme,
  onPress,
}: {
  label: string;
  theme: any;
  onPress: () => void;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let isMounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (isMounted) setReduceMotion(enabled);
    });

    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        setReduceMotion(enabled);
      },
    );

    return () => {
      isMounted = false;
      sub?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      translateY.setValue(0);
      return;
    }

    // 1.8s total cycle: 900ms float up (-4px) + 900ms float down (0px) with smooth sine easing
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -4,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
      translateY.setValue(0);
    };
  }, [reduceMotion, translateY]);

  return (
    <Animated.View
      style={[
        styles.centerItemSlot,
        {
          transform: [{ translateY }],
        },
      ]}
    >
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={label || "QR Scanner"}
        style={({ pressed }) => [
          styles.centerQrButton,
          {
            backgroundColor: theme.primary,
            transform: [{ scale: pressed ? 0.93 : 1 }],
            shadowColor: theme.primary,
          },
        ]}
      >
        <Feather name="maximize" size={26} color="#FFFFFF" />
      </Pressable>
    </Animated.View>
  );
}

export default function RoleBottomNavigation({
  state,
  descriptors,
  navigation,
  role,
  onOpenQrScanner,
}: RoleBottomNavigationProps) {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(Dimensions.get("window").width);

  const normalizedRole = getNormalizedRole(role);
  const navItems = getNavigationForRole(role);

  const bottomInset = Math.max(
    insets.bottom,
    Platform.OS === "android" ? 6 : 0,
  );
  const barHeight = (Platform.OS === "ios" ? 56 : 60) + bottomInset;

  const hasCenterAction = navItems.some((i) => i.isCenterAction);

  // Compute curved notch path if center action exists; otherwise flat bar
  const w = barWidth || Dimensions.get("window").width;
  const h = barHeight;
  const cx = w / 2;
  const cr = 40;
  const notchDepth = 30;

  // Smooth SVG Path for the bottom bar background
  const bgPath = hasCenterAction
    ? `
    M 0,0
    L ${cx - cr - 10},0
    C ${cx - cr + 4},0 ${cx - cr + 6},${notchDepth} ${cx - 18},${notchDepth}
    C ${cx - 8},${notchDepth + 2} ${cx + 8},${notchDepth + 2} ${cx + 18},${notchDepth}
    C ${cx + cr - 6},${notchDepth} ${cx + cr - 4},0 ${cx + cr + 10},0
    L ${w},0
    L ${w},${h}
    L 0,${h}
    Z
  `
    : `
    M 0,0
    L ${w},0
    L ${w},${h}
    L 0,${h}
    Z
  `;

  // Stroke path for the top border
  const borderPath = hasCenterAction
    ? `
    M 0,0
    L ${cx - cr - 10},0
    C ${cx - cr + 4},0 ${cx - cr + 6},${notchDepth} ${cx - 18},${notchDepth}
    C ${cx - 8},${notchDepth + 2} ${cx + 8},${notchDepth + 2} ${cx + 18},${notchDepth}
    C ${cx + cr - 6},${notchDepth} ${cx + cr - 4},0 ${cx + cr + 10},0
    L ${w},0
  `
    : `
    M 0,0
    L ${w},0
  `;

  const borderColor = isDark ? "rgba(255, 255, 255, 0.12)" : theme.border;
  const barBgColor = theme.backgroundSecondary;

  return (
    <View
      onLayout={(e) => {
        const layoutWidth = e.nativeEvent.layout.width;
        if (layoutWidth > 0 && layoutWidth !== barWidth) {
          setBarWidth(layoutWidth);
        }
      }}
      style={[
        styles.barContainer,
        {
          height: barHeight,
          paddingBottom: bottomInset,
        },
      ]}
    >
      {/* Curved SVG Background & Top Border */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Path d={bgPath} fill={barBgColor} />
          <Path
            d={borderPath}
            stroke={borderColor}
            strokeWidth={1.5}
            fill="none"
          />
        </Svg>
      </View>

      <View style={styles.itemsRow}>
        {navItems.map((item: NavItemConfig) => {
          if (item.isCenterAction) {
            // QR Scanner Center Elevated Button floating inside the curved notch
            const label = t(item.titleKey, item.defaultTitle);
            return (
              <FloatingCenterQrButton
                key={item.id}
                label={label}
                theme={theme}
                onPress={onOpenQrScanner}
              />
            );
          }

          // Regular Tab Item
          const routeIndex = state.routes.findIndex(
            (r) => r.name === item.name,
          );
          const isFocused = routeIndex !== -1 && state.index === routeIndex;
          const label =
            normalizedRole === "worker"
              ? item.defaultTitle
              : t(item.titleKey, item.defaultTitle);

          const onPress = () => {
            if (routeIndex === -1) return;
            const route = state.routes[routeIndex];
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            Haptics.selectionAsync();

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            if (routeIndex === -1) return;
            const route = state.routes[routeIndex];
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          const activeColor = theme.primary;
          const inactiveColor = theme.tabIconDefault || theme.textSecondary;
          const iconColor = isFocused ? activeColor : inactiveColor;

          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={label}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabItem}
            >
              <View style={styles.iconWrapper}>
                <Feather
                  name={item.iconName as any}
                  size={22}
                  color={iconColor}
                />
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.tabLabel,
                  {
                    color: iconColor,
                    fontWeight: isFocused ? "700" : "500",
                  },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    zIndex: 100,
    overflow: "visible",
    backgroundColor: "transparent",
  },
  itemsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 6,
    overflow: "visible",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    minHeight: 48,
  },
  iconWrapper: {
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 10.5,
    marginTop: 2,
    textAlign: "center",
  },
  centerItemSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    overflow: "visible",
    zIndex: 10,
  },
  centerQrButton: {
    width: 58,
    height: 58,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -62,
    elevation: 12,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
});
