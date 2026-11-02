import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import Svg, { Rect, Path, Circle, Line } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";

import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import {
  getNavigationForRole,
  getNormalizedRole,
  NavItemConfig,
} from "@/navigation/navigationConfig";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
export const DOCK_WIDTH = Math.min(SCREEN_WIDTH - 36, 334);
export const DOCK_HEIGHT = 64;
export const DOCK_BORDER_RADIUS = 40;

const COLOR_ACTIVE = "#FF6B00";
const COLOR_MUTED_DARK = "#8E9BAE";
const COLOR_MUTED_LIGHT = "#64748B";

const DOCK_BG_DARK = "rgba(29, 36, 50, 0.85)";
const DOCK_BG_LIGHT = "rgba(255, 255, 255, 0.88)";

const DOCK_BORDER_DARK = "rgba(51, 65, 85, 0.7)";
const DOCK_BORDER_LIGHT = "rgba(226, 232, 240, 0.95)";

export interface FloatingPillNavigationProps extends Partial<BottomTabBarProps> {
  role?: string | null;
  onOpenQrScanner?: () => void;
  showLabels?: boolean;
}

/**
 * 1. Bento Grid Icon (Solid 4-Square Grid for Dashboard)
 */
function BentoGridIcon({
  color,
  size = 22,
}: {
  color: string;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="7.5" height="7.5" rx="2" fill={color} />
      <Rect x="13.5" y="3" width="7.5" height="7.5" rx="2" fill={color} />
      <Rect x="3" y="13.5" width="7.5" height="7.5" rx="2" fill={color} />
      <Rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" fill={color} />
    </Svg>
  );
}

/**
 * 2. Minimalist Dual-User Outline Icon (Workers / Team)
 */
function DualUserIcon({
  color,
  size = 22,
}: {
  color: string;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <Circle cx="9" cy="7" r="4" />
      <Path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  );
}

/**
 * 3. Modern QR Viewfinder Icon (White icon inside the 44x44px Orange Badge)
 */
function QrViewfinderIcon({
  color = "#FFFFFF",
  size = 20,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <Path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <Path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <Path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <Rect x="7" y="7" width="3" height="3" fill={color} stroke="none" rx={0.5} />
      <Rect x="14" y="7" width="3" height="3" fill={color} stroke="none" rx={0.5} />
      <Rect x="7" y="14" width="3" height="3" fill={color} stroke="none" rx={0.5} />
      <Line x1="7" y1="12" x2="17" y2="12" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

/**
 * 4. Clean Vertical Bar Chart Icon (Summary / Analytics Metrics)
 */
function AnalyticsBarChartIcon({
  color,
  size = 22,
}: {
  color: string;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="18" y1="20" x2="6" y2="20" />
      <Line x1="6" y1="20" x2="6" y2="14" strokeWidth={2.5} />
      <Line x1="12" y1="20" x2="12" y2="8" strokeWidth={2.5} />
      <Line x1="18" y1="20" x2="18" y2="4" strokeWidth={2.5} />
    </Svg>
  );
}

/**
 * 5. Modern Architectural High-Rise Building Icon (Site Control)
 */
function HighRiseBuildingIcon({
  color,
  size = 22,
}: {
  color: string;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="4" y="2" width="16" height="20" rx="2" />
      <Line x1="9" y1="6" x2="9.01" y2="6" strokeWidth={2.5} />
      <Line x1="15" y1="6" x2="15.01" y2="6" strokeWidth={2.5} />
      <Line x1="9" y1="10" x2="9.01" y2="10" strokeWidth={2.5} />
      <Line x1="15" y1="10" x2="15.01" y2="10" strokeWidth={2.5} />
      <Line x1="9" y1="14" x2="9.01" y2="14" strokeWidth={2.5} />
      <Line x1="15" y1="14" x2="15.01" y2="14" strokeWidth={2.5} />
      <Path d="M10 22v-4h4v4" />
    </Svg>
  );
}

/**
 * Single Tab Item with micro-interaction spring animations
 */
function PillTabItem({
  item,
  isFocused,
  isDark,
  label,
  showLabel,
  onPress,
}: {
  item: NavItemConfig;
  isFocused: boolean;
  isDark: boolean;
  label: string;
  showLabel?: boolean;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const dotAnim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(dotAnim, {
      toValue: isFocused ? 1 : 0,
      useNativeDriver: true,
      damping: 15,
      stiffness: 200,
    }).start();
  }, [isFocused, dotAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.88,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 8,
    }).start();
  };

  const color = isFocused
    ? COLOR_ACTIVE
    : isDark
      ? COLOR_MUTED_DARK
      : COLOR_MUTED_LIGHT;
  const id = (item.id || "").toLowerCase();
  const name = (item.name || "").toLowerCase();

  const renderIcon = () => {
    if (id === "dashboard" || name === "dashboardtab" || id === "home") {
      return <BentoGridIcon color={color} size={22} />;
    }
    if (id === "workers" || name === "workerstab" || id === "team") {
      return <DualUserIcon color={color} size={22} />;
    }
    if (id === "camera" || name === "workercameratab" || id === "sitelogs" || name === "sitelogstab") {
      return <Feather name="camera" size={22} color={color} />;
    }
    if (id === "summary" || name === "summarytab" || id === "reports") {
      return <AnalyticsBarChartIcon color={color} size={22} />;
    }
    if (id === "sitecontrol" || name === "sitecontroltab" || id === "sites") {
      return <HighRiseBuildingIcon color={color} size={22} />;
    }
    if (id === "profile" || name === "profiletab") {
      return <Feather name="user" size={22} color={color} />;
    }
    return <BentoGridIcon color={color} size={22} />;
  };

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabItem}
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
        {renderIcon()}

        {showLabel && (
          <Text
            numberOfLines={1}
            style={[
              styles.tabLabelText,
              { color, fontWeight: isFocused ? "700" : "500" },
            ]}
          >
            {label}
          </Text>
        )}

        {/* Small glowing orange dot directly underneath icon */}
        <Animated.View
          style={[
            styles.activeDot,
            {
              opacity: dotAnim,
              transform: [{ scale: dotAnim }],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

/**
 * 3. Elevated Circular QR Center Action Badge (44x44px)
 */
function CenterQrBadge({
  onPress,
  isDark,
}: {
  onPress: () => void;
  isDark: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
      speed: 40,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 12,
    }).start();
  };

  return (
    <View style={styles.centerSlot}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel="Scan QR Attendance"
      >
        <Animated.View
          style={[
            styles.qrBadge,
            {
              transform: [{ scale: scaleAnim }],
              borderColor: isDark
                ? "rgba(255, 255, 255, 0.25)"
                : "rgba(255, 255, 255, 0.45)",
            },
          ]}
        >
          <QrViewfinderIcon color="#FFFFFF" size={20} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

/**
 * Main Floating Pill Navigation Dock Component
 */
export default function FloatingPillNavigation({
  state,
  descriptors,
  navigation,
  role,
  onOpenQrScanner,
  showLabels = false,
}: FloatingPillNavigationProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const normalizedRole = getNormalizedRole(role);
  const navItems = getNavigationForRole(normalizedRole);

  // Position: Floating 24px above the home indicator
  const bottomOffset = Math.max(insets.bottom, 12) + 24;

  const dockBg = isDark ? DOCK_BG_DARK : DOCK_BG_LIGHT;
  const dockBorder = isDark ? DOCK_BORDER_DARK : DOCK_BORDER_LIGHT;
  const shadowColor = isDark ? "#000000" : "#0F172A";
  const shadowOpacity = isDark ? 0.45 : 0.12;
  const blurTint: "dark" | "light" = isDark ? "dark" : "light";

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.dockOuterWrapper,
        {
          bottom: bottomOffset,
        },
      ]}
    >
      <View
        style={[
          styles.shadowWrapper,
          {
            shadowColor,
            shadowOpacity,
          },
        ]}
      >
        <BlurView
          intensity={Platform.OS === "ios" ? 45 : 30}
          tint={blurTint}
          style={[
            styles.pillContainer,
            {
              borderColor: dockBorder,
            },
          ]}
        >
          {/* Subtle translucent frosted glass layer */}
          <View style={[styles.frostedOverlay, { backgroundColor: dockBg }]} />

          {/* 5 Navigation Items evenly spaced */}
          <View style={styles.itemsRow}>
            {navItems.map((item: NavItemConfig, index: number) => {
              // 3. Center QR Scanner Badge (44x44px)
              if (item.isCenterAction) {
                return (
                  <CenterQrBadge
                    key={item.id || "qr-center"}
                    isDark={isDark}
                    onPress={() => {
                      if (onOpenQrScanner) {
                        onOpenQrScanner();
                      } else if (navigation) {
                        navigation.navigate("ScanQRTab" as any);
                      }
                    }}
                  />
                );
              }

              const routeIndex = state ? state.routes.findIndex((r) => r.name === item.name) : -1;
              const isFocused = routeIndex !== -1 && state ? state.index === routeIndex : index === 0;
              const label = t(item.titleKey, item.defaultTitle);

              const handlePress = () => {
                if (routeIndex === -1) {
                  if (navigation) navigation.navigate(item.name as any);
                  return;
                }
                if (navigation && state) {
                  const route = state.routes[routeIndex];
                  const event = navigation.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true,
                  });

                  if (!isFocused && !event.defaultPrevented) {
                    navigation.navigate(route.name);
                  }
                }
              };

              return (
                <PillTabItem
                  key={item.id}
                  item={item}
                  isFocused={isFocused}
                  isDark={isDark}
                  label={label}
                  showLabel={showLabels}
                  onPress={handlePress}
                />
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dockOuterWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  shadowWrapper: {
    width: DOCK_WIDTH,
    height: DOCK_HEIGHT,
    borderRadius: DOCK_BORDER_RADIUS,
    // Deep soft ambient drop shadow (0 12px 30px rgba(0, 0, 0, 0.45))
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 20,
  },
  pillContainer: {
    width: "100%",
    height: "100%",
    borderRadius: DOCK_BORDER_RADIUS,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: DOCK_BORDER_DARK,
    justifyContent: "center",
  },
  frostedOverlay: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: DOCK_BG_DARK,
  },
  itemsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    height: "100%",
  },
  tabItem: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 48,
  },
  tabLabelText: {
    fontSize: 9,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLOR_ACTIVE,
    marginTop: 4,
    shadowColor: COLOR_ACTIVE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 3,
  },
  centerSlot: {
    width: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  qrBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLOR_ACTIVE,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    shadowColor: COLOR_ACTIVE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
});
