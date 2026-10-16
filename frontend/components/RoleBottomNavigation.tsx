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
import { Ionicons } from "@expo/vector-icons";
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
 * Render active (filled/solid) vs inactive (outline) icon variants
 */
function renderNavIcon(
  item: NavItemConfig,
  isFocused: boolean,
  color: string,
  size: number = 22,
) {
  const id = (item.id || "").toLowerCase();
  const name = (item.name || "").toLowerCase();

  // 1. Dashboard / Home
  if (id === "dashboard" || name === "dashboardtab") {
    if (id === "home") {
      return (
        <Ionicons
          name={isFocused ? "home" : "home-outline"}
          size={size}
          color={color}
        />
      );
    }
    return (
      <Ionicons
        name={isFocused ? "grid" : "grid-outline"}
        size={size}
        color={color}
      />
    );
  }

  // 2. Camera / Work Photos
  if (id === "camera" || name === "workercameratab") {
    return (
      <Ionicons
        name={isFocused ? "camera" : "camera-outline"}
        size={size}
        color={color}
      />
    );
  }

  // 3. Workers
  if (id === "workers" || name === "workerstab") {
    return (
      <Ionicons
        name={isFocused ? "people" : "people-outline"}
        size={size}
        color={color}
      />
    );
  }

  // 4. Summary / Reports
  if (id === "summary" || name === "summarytab") {
    return (
      <Ionicons
        name={isFocused ? "stats-chart" : "stats-chart-outline"}
        size={size}
        color={color}
      />
    );
  }

  // 5. Site Control
  if (id === "sitecontrol" || name === "sitecontroltab") {
    return (
      <Ionicons
        name={isFocused ? "business" : "business-outline"}
        size={size}
        color={color}
      />
    );
  }

  // 6. Profile
  if (id === "profile" || name === "profiletab") {
    return (
      <Ionicons
        name={isFocused ? "person" : "person-outline"}
        size={size}
        color={color}
      />
    );
  }

  // Generic Fallback
  return (
    <Ionicons
      name={(isFocused ? item.iconName : `${item.iconName}-outline`) as any}
      size={size}
      color={color}
    />
  );
}

/**
 * Single Animated Navigation Tab Item with LinkedIn-Style 3° Tilt, Subtle Lift, Scale, & Straight Label
 */
interface TabItemProps {
  item: NavItemConfig;
  isFocused: boolean;
  label: string;
  theme: any;
  isDark: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

function BottomTabItem({
  item,
  isFocused,
  label,
  theme,
  isDark,
  onPress,
  onLongPress,
}: TabItemProps) {
  const focusAnim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isFocused, focusAnim]);

  const activeColor = theme.primary;
  const inactiveColor = isDark
    ? "#94A3B8"
    : theme.tabIconDefault || theme.textSecondary || "#94A3B8";
  const iconColor = isFocused ? activeColor : inactiveColor;

  // LinkedIn-style active interaction:
  // - Subtle scale increase (1.0 -> 1.10)
  // - Subtle upward movement (0 -> -3.5px)
  // - Subtle 3-degree rotation/tilt (0deg -> 3deg)
  const iconScale = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });

  const iconTranslateY = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3.5],
  });

  const iconRotate = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "3deg"],
  });

  const dotScale = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const dotOpacity = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={styles.tabItem}
    >
      {/* Icon with LinkedIn-style tilt, lift, and scale */}
      <Animated.View
        style={[
          styles.iconWrapper,
          {
            transform: [
              { translateY: iconTranslateY },
              { scale: iconScale },
              { rotate: iconRotate },
            ],
          },
        ]}
      >
        {renderNavIcon(item, isFocused, iconColor, 22)}
      </Animated.View>

      {/* Label remains straight without rotation */}
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

      {/* Subtle micro active dot */}
      <Animated.View
        style={[
          styles.activeDot,
          {
            backgroundColor: activeColor,
            opacity: dotOpacity,
            transform: [{ scale: dotScale }],
          },
        ]}
      />
    </Pressable>
  );
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

    // 1.8s total cycle: 900ms float up (-3.5px) + 900ms float down (0px) with smooth sine easing
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -3.5,
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
            transform: [{ scale: pressed ? 0.92 : 1 }],
            shadowColor: theme.primary,
          },
        ]}
      >
        <Ionicons name="qr-code-outline" size={26} color="#FFFFFF" />
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
  const barHeight = (Platform.OS === "ios" ? 58 : 62) + bottomInset;

  const hasCenterAction = navItems.some((i) => i.isCenterAction);

  // Compute curved notch path if center action exists; otherwise flat bar
  const w = barWidth || Dimensions.get("window").width;
  const h = barHeight;
  const centerIndex = navItems.findIndex((i) => i.isCenterAction);
  const totalItems = navItems.length || 5;
  const cx =
    centerIndex !== -1 ? (w / totalItems) * (centerIndex + 0.5) : w / 2;
  const cr = 36;
  const notchDepth = 24;

  // Smooth SVG Path for the bottom bar background
  const bgPath = !hasCenterAction
    ? `M 0,0 L ${w},0 L ${w},${h} L 0,${h} Z`
    : `
      M 0,0
      L ${cx - cr - 10},0
      C ${cx - cr + 4},0 ${cx - cr + 6},${notchDepth} ${cx - 18},${notchDepth}
      C ${cx - 8},${notchDepth + 2} ${cx + 8},${notchDepth + 2} ${cx + 18},${notchDepth}
      C ${cx + cr - 6},${notchDepth} ${cx + cr - 4},0 ${cx + cr + 10},0
      L ${w},0
      L ${w},${h}
      L 0,${h}
      Z
    `;

  // Stroke path for the top border
  const borderPath = !hasCenterAction
    ? `M 0,0 L ${w},0`
    : `
      M 0,0
      L ${cx - cr - 10},0
      C ${cx - cr + 4},0 ${cx - cr + 6},${notchDepth} ${cx - 18},${notchDepth}
      C ${cx - 8},${notchDepth + 2} ${cx + 8},${notchDepth + 2} ${cx + 18},${notchDepth}
      C ${cx + cr - 6},${notchDepth} ${cx + cr - 4},0 ${cx + cr + 10},0
      L ${w},0
    `;

  const borderColor = isDark ? "rgba(255, 255, 255, 0.10)" : theme.border;
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
            strokeWidth={1.2}
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

          // Regular Tab Item - derived strictly from current route state
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

          return (
            <BottomTabItem
              key={item.id}
              item={item}
              isFocused={isFocused}
              label={label}
              theme={theme}
              isDark={isDark}
              onPress={onPress}
              onLongPress={onLongPress}
            />
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
    paddingHorizontal: 4,
    overflow: "visible",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 3,
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
    letterSpacing: -0.2,
  },
  activeDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    marginTop: 2,
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
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -44,
    elevation: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 7,
  },
});
