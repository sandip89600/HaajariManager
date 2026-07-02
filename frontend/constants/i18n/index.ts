import en from "./en.json";
import hi from "./hi.json";
import bn from "./bn.json";
import te from "./te.json";
import mr from "./mr.json";
import ta from "./ta.json";
import gu from "./gu.json";
import kn from "./kn.json";
import ml from "./ml.json";
import pa from "./pa.json";
import or from "./or.json";
import as from "./as.json";
import ur from "./ur.json";
import sa from "./sa.json";
import ne from "./ne.json";
import kok from "./kok.json";
import mai from "./mai.json";
import doi from "./doi.json";
import sat from "./sat.json";
import ks from "./ks.json";
import sd from "./sd.json";
import mni from "./mni.json";

export type Language =
  | "en"
  | "hi"
  | "bn"
  | "te"
  | "mr"
  | "ta"
  | "gu"
  | "kn"
  | "ml"
  | "pa"
  | "or"
  | "as"
  | "ur"
  | "sa"
  | "ne"
  | "kok"
  | "mai"
  | "doi"
  | "sat"
  | "ks"
  | "sd"
  | "mni";

export const translations: Record<Language, any> = {
  en,
  hi,
  bn,
  te,
  mr,
  ta,
  gu,
  kn,
  ml,
  pa,
  or,
  as,
  ur,
  sa,
  ne,
  kok,
  mai,
  doi,
  sat,
  ks,
  sd,
  mni,
};

export type TranslationKeys = typeof en;

export function getTranslation(language: Language): TranslationKeys {
  return translations[language] || translations.en;
}

export const languageNames: Record<Language, string> = {
  en: "English",
  hi: "हिन्दी (Hindi)",
  bn: "বাংলা (Bengali)",
  te: "తెలుగు (Telugu)",
  mr: "मराठी (Marathi)",
  ta: "தமிழ் (Tamil)",
  gu: "ગુજરાતી (Gujarati)",
  kn: "ಕನ್ನಡ (Kannada)",
  ml: "മലയാളം (Malayalam)",
  pa: "ਪੰਜਾਬੀ (Punjabi)",
  or: "ଓଡ଼ିଆ (Odia)",
  as: "অসমীয়া (Assamese)",
  ur: "اردو (Urdu)",
  sa: "संस्कृतम् (Sanskrit)",
  ne: "नेपाली (Nepali)",
  kok: "कोंकणी (Konkani)",
  mai: "मैथिली (Maithili)",
  doi: "डोगरी (Dogri)",
  sat: "संथाली (Santali)",
  ks: "कश्मीरी (Kashmiri)",
  sd: "सिंधी (Sindhi)",
  mni: "मणिपुरी (Manipuri)",
};
