import { Platform } from "react-native";
import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import { isLiquidGlassAvailable } from "expo-glass-effect";

interface ScreenOptionsParams {
  theme: {
    backgroundRoot: string;
    text: string;
  };
  isDark: boolean;
  transparent?: boolean;
}

export const getCommonScreenOptions = ({
  theme,
  isDark,
  transparent = true,
}: ScreenOptionsParams): NativeStackNavigationOptions => ({
  headerTitleAlign: "center",
  headerTransparent: transparent,
  headerBlurEffect: isDark ? "dark" : "light",
  headerTintColor: theme.text,
  headerStyle: {
    backgroundColor: Platform.select({
      ios: undefined,
      android: theme.backgroundRoot,
      web: theme.backgroundRoot,
    }),
  },
  gestureEnabled: true,
  gestureDirection: "horizontal",
  fullScreenGestureEnabled: isLiquidGlassAvailable() ? false : true,
  contentStyle: {
    backgroundColor: theme.backgroundRoot,
  },
});

export const getCommonTabScreenOptions = ({
  theme,
  isDark,
  transparent = true,
}: ScreenOptionsParams): BottomTabNavigationOptions => ({
  headerTitleAlign: "center",
  headerTransparent: transparent,
  headerTintColor: theme.text,
  headerStyle: {
    backgroundColor: Platform.select({
      ios: undefined,
      android: theme.backgroundRoot,
      web: theme.backgroundRoot,
    }),
  },
});
