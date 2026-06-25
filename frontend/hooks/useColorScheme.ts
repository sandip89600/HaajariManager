import { useColorScheme as useRNColorScheme } from "react-native";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeMode } from "@/utils/storage";

export function useColorScheme() {
  const systemColorScheme = useRNColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("@haajari/theme").then((saved) => {
      if (saved) {
        setThemeModeState(saved as ThemeMode);
      }
      setIsLoaded(true);
    });
  }, []);

  if (!isLoaded) {
    return systemColorScheme;
  }

  if (themeMode === "system") {
    return systemColorScheme;
  }
  return themeMode;
}
