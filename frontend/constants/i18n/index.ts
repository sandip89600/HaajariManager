import en from "./en.json";
import hi from "./hi.json";

export type Language = "en" | "hi";

export const translations = {
  en,
  hi,
};

export type TranslationKeys = typeof en;

export function getTranslation(language: Language): TranslationKeys {
  return translations[language] || translations.en;
}

export const languageNames: Record<Language, string> = {
  en: "English",
  hi: "हिंदी",
};
