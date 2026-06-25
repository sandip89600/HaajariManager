import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from "react";
import { Language, getTranslation, TranslationKeys } from "@/constants/i18n";
import { storage } from "@/utils/storage";

interface LanguageContextType {
  language: Language;
  t: TranslationKeys;
  setLanguage: (lang: Language) => Promise<void>;
  isLoading: boolean;
}

export const LanguageContext = createContext<LanguageContextType | null>(null);

export function useLanguageProvider() {
  const [language, setLanguageState] = useState<Language>("en");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const savedLanguage = await storage.getLanguage();
      setLanguageState(savedLanguage);
    } finally {
      setIsLoading(false);
    }
  };

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    await storage.setLanguage(lang);
  }, []);

  const t = getTranslation(language);

  return {
    language,
    t,
    setLanguage,
    isLoading,
  };
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
