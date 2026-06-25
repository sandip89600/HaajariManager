import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeMode } from "@/utils/storage";

export async function saveThemeMode(mode: ThemeMode): Promise<void> {
  await AsyncStorage.setItem("@haajari/theme", mode);
}

export async function getThemeMode(): Promise<ThemeMode> {
  const saved = await AsyncStorage.getItem("@haajari/theme");
  return (saved as ThemeMode) || "system";
}
