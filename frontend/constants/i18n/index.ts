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
import bho from "./bho.json";

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
  | "bho"
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
  bho,
  doi,
  sat,
  ks,
  sd,
  mni,
};

export type TranslationKeys = typeof en;

export interface LocaleConfig {
  code: Language;
  nativeName: string;
  englishName: string;
  script: string;
  isRTL: boolean;
  numberLocale: string;
  dateLocale: string;
  isComplete: boolean;
}

export interface ExtendedTranslationApi {
  (keyPath: string, fallback?: string): string;
  translateAttendanceStatus(status?: string): string;
  translateSiteStatus(status?: string): string;
  translateRole(role?: string): string;
  translatePaymentType(type?: string): string;
  translatePaymentMethod(method?: string): string;
  translateWorkType(type?: string): string;
  translateError(error?: any): string;
  translateCategory(category?: string): string;
  translateConnectionStatus(status?: string): string;
  formatCurrency(amount: number): string;
  formatDate(date: Date | string | number): string;
}

export type TranslationApi = TranslationKeys & ExtendedTranslationApi;

// Deep merge fallback helper to ensure missing keys safely fall back to English
function deepMergeFallback(target: any, source: any): any {
  if (typeof target !== "object" || target === null) return source ?? target;
  if (typeof source !== "object" || source === null) return target;

  const result: any = Array.isArray(target) ? [...target] : { ...target };

  for (const key of Object.keys(target)) {
    if (source[key] !== undefined) {
      if (typeof target[key] === "object" && target[key] !== null) {
        result[key] = deepMergeFallback(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }

  for (const key of Object.keys(source)) {
    if (result[key] === undefined) {
      result[key] = source[key];
    }
  }

  return result;
}

function resolvePath(obj: any, path: string): string | undefined {
  if (!obj || !path) return undefined;
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return typeof current === "string" ? current : undefined;
}

export function getTranslation(language: Language): TranslationApi {
  const selected = translations[language] || translations.en;
  const merged =
    language === "en"
      ? translations.en
      : deepMergeFallback(translations.en, selected);

  const tFunc = function (keyPath: string, fallback?: string): string {
    if (!keyPath || typeof keyPath !== "string") {
      return fallback || "";
    }
    const val =
      resolvePath(merged, keyPath) ||
      resolvePath(translations.en, keyPath) ||
      resolvePath(translations.hi, keyPath);
    if (val !== undefined && val !== null) return String(val);

    if (fallback !== undefined) return fallback;

    const lastPart = keyPath.split(".").pop() || keyPath;
    return lastPart
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase());
  } as any;

  Object.assign(tFunc, merged);

  tFunc.translateAttendanceStatus = (status?: string): string => {
    if (!status) return "";
    const s = String(status).trim().toUpperCase();
    if (
      s === "P" ||
      s === "PRESENT" ||
      s === "उपस्थित" ||
      s === "हजर" ||
      s === "હાજર" ||
      s === "வந்தவர்" ||
      s === "హాజరు" ||
      s === "ಹಾಜರು" ||
      s === "ഹാജർ" ||
      s === "ਹਾਜ਼ਰ" ||
      s === "حاضر"
    ) {
      return (
        merged.enums?.attendance?.PRESENT ||
        merged.attendance?.present ||
        "Present"
      );
    }
    if (
      s === "A" ||
      s === "ABSENT" ||
      s === "अनुपस्थित" ||
      s === "गैरहजर" ||
      s === "ગેરહાજર" ||
      s === "வராதவர்" ||
      s === "గైర్హాజరు" ||
      s === "ಗೈರುಹಾಜರು" ||
      s === "ഗൈർഹാജർ" ||
      s === "ਗੈਰਹਾਜ਼ਰ" ||
      s === "غیر حاضر"
    ) {
      return (
        merged.enums?.attendance?.ABSENT ||
        merged.attendance?.absent ||
        "Absent"
      );
    }
    if (
      s === "HALF" ||
      s === "1/2" ||
      s === "HALF_DAY" ||
      s === "HALF DAY" ||
      s === "आधा दिन" ||
      s === "अर्धा दिवस" ||
      s === "અડધો દિવસ" ||
      s === "அரை நாள்" ||
      s === "సగం రోజు" ||
      s === "ಅರ್ಧ ದಿನ" ||
      s === "അര ദിവസം" ||
      s === "ਅੱਧਾ ਦਿਨ" ||
      s === "نصف دن"
    ) {
      return (
        merged.enums?.attendance?.HALF_DAY ||
        merged.attendance?.halfDay ||
        "Half Day"
      );
    }
    if (
      s === "OT" ||
      s === "OVERTIME" ||
      s === "OVER_TIME" ||
      s === "ओवरटाइम" ||
      s === "ओव्हरटाईम" ||
      s === "ઓવરટાઇમ" ||
      s === "கூடுதல் நேரம்" ||
      s === "ఓవర్‌టైమ్" ||
      s === "ಓವರ್‌ಟೈಮ್" ||
      s === "ഓവർടൈം" ||
      s === "ਓਵਰਟਾਈਮ" ||
      s === "اوور ٹائم"
    ) {
      return (
        merged.enums?.attendance?.OVERTIME ||
        merged.attendance?.overtime ||
        "Overtime"
      );
    }
    if (
      s === "HOLIDAY" ||
      s === "छुट्टी" ||
      s === "सुट्टी" ||
      s === "રજા" ||
      s === "விடுமுறை" ||
      s === "సెలవు" ||
      s === "ರಜೆ" ||
      s === "അവധി" ||
      s === "ਛੁੱਟੀ" ||
      s === "تعطیل"
    ) {
      return merged.enums?.attendance?.HOLIDAY || "Holiday";
    }
    if (
      s === "PAID_LEAVE" ||
      s === "PAID LEAVE" ||
      s === "सवेतन छुट्टी" ||
      s === "सवेतन अवकाश" ||
      s === "पगारी सुट्टी" ||
      s === "પગાર સાથે રજા"
    ) {
      return merged.enums?.attendance?.PAID_LEAVE || "Paid Leave";
    }
    return status;
  };

  tFunc.translateSiteStatus = (status?: string): string => {
    if (!status) return "";
    const s = String(status).trim().toUpperCase();
    if (
      s === "ACTIVE" ||
      s === "STARTED" ||
      s === "LIVE" ||
      s === "सक्रिय" ||
      s === "चालू"
    ) {
      return (
        merged.enums?.siteStatus?.ACTIVE || merged.sites?.started || "Active"
      );
    }
    if (
      s === "COMPLETED" ||
      s === "पूर्ण" ||
      s === "முடிந்தது" ||
      s === "పూర్తయింది" ||
      s === "പൂർത്തിയായി"
    ) {
      return (
        merged.enums?.siteStatus?.COMPLETED ||
        merged.sites?.completed ||
        "Completed"
      );
    }
    if (
      s === "IN_PROGRESS" ||
      s === "INPROGRESS" ||
      s === "IN PROGRESS" ||
      s === "प्रगति पर" ||
      s === "प्रगतीपथावर" ||
      s === "પ્રગતિમાં"
    ) {
      return (
        merged.enums?.siteStatus?.IN_PROGRESS ||
        merged.sites?.inProgress ||
        "In Progress"
      );
    }
    if (s === "PLANNING" || s === "योजना" || s === "नियोजन" || s === "આયોજન") {
      return (
        merged.enums?.siteStatus?.PLANNING ||
        merged.sites?.planning ||
        "Planning"
      );
    }
    if (s === "DELAYED" || s === "विलंबित" || s === "विલંબિત") {
      return (
        merged.enums?.siteStatus?.DELAYED || merged.sites?.delayed || "Delayed"
      );
    }
    if (s === "ARCHIVED" || s === "आर्काइव" || s === "संग्रहित") {
      return (
        merged.enums?.siteStatus?.ARCHIVED ||
        merged.sites?.archived ||
        "Archived"
      );
    }
    if (
      s === "NOT_STARTED" ||
      s === "NOT STARTED" ||
      s === "शुरू नहीं हुआ" ||
      s === "सुरू नाही"
    ) {
      return (
        merged.enums?.siteStatus?.NOT_STARTED ||
        merged.sites?.notStarted ||
        "Not Started"
      );
    }
    return status;
  };

  tFunc.translateRole = (role?: string): string => {
    if (!role) return "";
    const r = String(role).trim().toUpperCase();
    if (
      r === "CONTRACTOR" ||
      r === "ठेकेदार" ||
      r === "कंत्राटदार" ||
      r === "કોન્ટ્રાક્ટર" ||
      r === "ஒப்பந்ததாரர்" ||
      r === "కాంట్రాక్టర్"
    ) {
      return (
        merged.enums?.roles?.CONTRACTOR ||
        merged.profile?.contractor ||
        "Contractor"
      );
    }
    if (
      r === "SUPERVISOR" ||
      r === "सुपरवाइजर" ||
      r === "सुपरवायझर" ||
      r === "સુપરવાઇઝર" ||
      r === "மேற்பார்வையாளர்" ||
      r === "సూపర్‌వైజర్"
    ) {
      return (
        merged.enums?.roles?.SUPERVISOR ||
        merged.profile?.supervisor ||
        "Supervisor"
      );
    }
    if (
      r === "LABOR" ||
      r === "LABOUR" ||
      r === "मजदूर" ||
      r === "मजूर" ||
      r === "મજૂર" ||
      r === "தொழிலாளி" ||
      r === "కూలీ"
    ) {
      return (
        merged.enums?.roles?.LABOUR ||
        merged.enums?.roles?.LABOR ||
        merged.categories?.labour ||
        "Labour"
      );
    }
    if (
      r === "WORKER" ||
      r === "कामगार" ||
      r === "कर्मचारी" ||
      r === "ਕਾਰੀਗਰ" ||
      r === "பணியாளர்" ||
      r === "కార్మికుడు"
    ) {
      return merged.enums?.roles?.WORKER || "Worker";
    }
    if (r === "ADMIN" || r === "एडमिन" || r === "प्रशासक") {
      return merged.enums?.roles?.ADMIN || merged.profile?.admin || "Admin";
    }
    return role;
  };

  tFunc.translatePaymentType = (type?: string): string => {
    if (!type) return "";
    const t = String(type).trim().toUpperCase();
    if (
      t === "ADVANCE" ||
      t === "अग्रिम" ||
      t === "अ‍ॅडव्हान्स" ||
      t === "એડવાન્સ" ||
      t === "முன்பணம்" ||
      t === "అడ్వాన్స్"
    ) {
      return (
        merged.enums?.paymentType?.ADVANCE ||
        merged.payment?.advance ||
        "Advance"
      );
    }
    if (
      t === "SALARY" ||
      t === "वेतन" ||
      t === "पगार" ||
      t === "சம்பளம்" ||
      t === "జీతం"
    ) {
      return merged.enums?.paymentType?.SALARY || "Salary";
    }
    if (t === "BONUS" || t === "बोनस") {
      return merged.enums?.paymentType?.BONUS || "Bonus";
    }
    if (t === "DEDUCTION" || t === "कटौती" || t === "कपात" || t === "કપાત") {
      return merged.enums?.paymentType?.DEDUCTION || "Deduction";
    }
    if (t === "SETTLEMENT" || t === "अंतिम हिसाब" || t === "हिशोब पूर्ण") {
      return merged.enums?.paymentType?.SETTLEMENT || "Settlement";
    }
    if (t === "DAILY" || t === "दैनिक दर" || t === "దినసరి") {
      return merged.enums?.paymentType?.DAILY || "Daily Rate";
    }
    if (t === "WEEKLY" || t === "साप्ताहिक") {
      return merged.enums?.paymentType?.WEEKLY || "Weekly";
    }
    if (t === "MONTHLY" || t === "मासिक") {
      return merged.enums?.paymentType?.MONTHLY || "Monthly";
    }
    if (t === "PIECE_RATE" || t === "PIECE RATE" || t === "काम के आधार पर") {
      return merged.enums?.paymentType?.PIECE_RATE || "Piece Rate";
    }
    return type;
  };

  tFunc.translatePaymentMethod = (method?: string): string => {
    if (!method) return "";
    const m = String(method).trim().toUpperCase();
    if (
      m === "CASH" ||
      m === "रोकड़" ||
      m === "नकद" ||
      m === "रोख" ||
      m === "રોકડ" ||
      m === "ரொக்கம்"
    ) {
      return merged.payment?.cash || "Cash";
    }
    if (m === "UPI" || m === "यूपीआई" || m === "युपीआय") {
      return merged.payment?.upi || "UPI";
    }
    if (
      m === "BANK_TRANSFER" ||
      m === "BANK TRANSFER" ||
      m === "BANK" ||
      m === "बैंक ट्रांसफर" ||
      m === "बँक ट्रान्सफर"
    ) {
      return merged.payment?.bankTransfer || "Bank Transfer";
    }
    if (m === "CHEQUE" || m === "CHECK" || m === "चेक" || m === "காசோலை") {
      return merged.payment?.cheque || "Cheque";
    }
    if (m === "OTHER" || m === "अन्य") {
      return merged.payment?.other || "Other";
    }
    return method;
  };

  tFunc.translateWorkType = (type?: string): string => {
    if (!type) return "";
    const w = String(type).trim().toUpperCase().replace(/\s+/g, "_");
    if (
      w === "BRICK_WORK" ||
      w === "BRICK" ||
      w === "ईंट_का_काम" ||
      w === "चिनाई" ||
      w === "विटांचे_बांधकाम"
    ) {
      return merged.enums?.workTypes?.BRICK_WORK || "Brick Work";
    }
    if (w === "PLASTER" || w === "प्लास्टर" || w === "పూச்சு_வேலை") {
      return (
        merged.enums?.workTypes?.PLASTER ||
        merged.categories?.plaster ||
        "Plaster"
      );
    }
    if (
      w === "PAINTING" ||
      w === "PAINTER" ||
      w === "पेंटिंग" ||
      w === "रंगकाम" ||
      w === "કલર_કામ"
    ) {
      return merged.enums?.workTypes?.PAINTING || "Painting";
    }
    if (
      w === "ELECTRICIAN" ||
      w === "इलेक्ट्रिशियन" ||
      w === "इलेक्ट्रीशियन" ||
      w === "વીજળી_કામ"
    ) {
      return merged.enums?.workTypes?.ELECTRICIAN || "Electrician";
    }
    if (
      w === "CONCRETE" ||
      w === "कंक्रीट" ||
      w === "काँक्रीट" ||
      w === "ढलाई"
    ) {
      return merged.enums?.workTypes?.CONCRETE || "Concrete";
    }
    if (
      w === "PLUMBING" ||
      w === "PLUMBER" ||
      w === "प्लंबिंग" ||
      w === "नल_का_काम"
    ) {
      return merged.enums?.workTypes?.PLUMBING || "Plumbing";
    }
    if (
      w === "CARPENTRY" ||
      w === "CARPENTER" ||
      w === "बढ़ई_का_काम" ||
      w === "सुतारकाम"
    ) {
      return merged.enums?.workTypes?.CARPENTRY || "Carpentry";
    }
    if (w === "TILES" || w === "टाइल्स_का_काम" || w === "टाईल्स_काम") {
      return (
        merged.enums?.workTypes?.TILES || merged.categories?.tiles || "Tiles"
      );
    }
    if (w === "OTHER" || w === "अन्य_काम" || w === "इतर_काम") {
      return (
        merged.enums?.workTypes?.OTHER || merged.sites?.otherWork || "Other"
      );
    }
    return type;
  };

  tFunc.translateCategory = (category?: string): string => {
    if (!category) return "";
    const c = String(category).toLowerCase().trim();
    if (merged.categories && merged.categories[c]) return merged.categories[c];
    if (
      c === "mason" ||
      c === "raj mistri" ||
      c === "rajmistri" ||
      c === "राजमिस्त्री" ||
      c === "मिस्त्री"
    ) {
      return merged.categories?.mason || "Mason";
    }
    if (c === "carpenter" || c === "बढ़ई" || c === "सुतार") {
      return merged.categories?.carpenter || "Carpenter";
    }
    if (c === "painter" || c === "पेंटर" || c === "रंगारी") {
      return merged.categories?.painter || "Painter";
    }
    if (c === "electrician" || c === "इलेक्ट्रीशियन" || c === "इलेक्ट्रिशियन") {
      return merged.categories?.electrician || "Electrician";
    }
    if (c === "plumber" || c === "प्लंबर") {
      return merged.categories?.plumber || "Plumber";
    }
    if (c === "helper" || c === "बेलदार" || c === "हेल्पर") {
      return merged.categories?.helper || "Helper";
    }
    if (c === "labour" || c === "labor" || c === "मजदूर" || c === "मजूर") {
      return merged.categories?.labour || "Labour";
    }
    if (c === "welder" || c === "वेल्डर") {
      return merged.categories?.welder || "Welder";
    }
    if (c === "tiles" || c === "tiles_mason" || c === "टाइल मिस्त्री") {
      return merged.categories?.tiles || "Tiles";
    }
    return category;
  };

  tFunc.translateConnectionStatus = (status?: string): string => {
    if (!status) return "";
    const cs = String(status).toLowerCase().trim();
    if (cs === "connected" || cs === "जुड़ा हुआ" || cs === "जोडलेले") {
      return merged.enums?.connectionStatus?.connected || "Connected";
    }
    if (cs === "pending" || cs === "pending_connection" || cs === "लंबित") {
      return merged.enums?.connectionStatus?.pending || "Pending Connection";
    }
    if (
      cs === "not_connected" ||
      cs === "notconnected" ||
      cs === "जुड़ा नहीं है"
    ) {
      return merged.enums?.connectionStatus?.notConnected || "Not Connected";
    }
    if (
      cs === "rejected" ||
      cs === "declined" ||
      cs === "अस्वीकृत" ||
      cs === "नाकारले"
    ) {
      return merged.enums?.connectionStatus?.rejected || "Declined";
    }
    return status;
  };

  tFunc.translateError = (error?: any): string => {
    if (!error) return merged.errors?.serverError || "An error occurred";
    if (typeof error === "string") {
      if (merged.errors && merged.errors[error]) return merged.errors[error];
      if (translations.en.errors && (translations.en.errors as any)[error])
        return (translations.en.errors as any)[error];
      const lower = error.toLowerCase();
      if (
        lower.includes("network") ||
        lower.includes("internet") ||
        lower.includes("fetch failed")
      ) {
        return merged.errors?.networkError || "Network connection error";
      }
      if (lower.includes("timeout")) {
        return merged.errors?.timeoutError || "Operation timed out";
      }
      if (lower.includes("500") || lower.includes("server")) {
        return merged.errors?.serverError || "Server error";
      }
      if (
        lower.includes("unauthorized") ||
        lower.includes("invalid token") ||
        lower.includes("not authenticated")
      ) {
        return merged.errors?.unauthorized || "Authentication required";
      }
      return error;
    }
    if (error.code && merged.errors && merged.errors[error.code]) {
      return merged.errors[error.code];
    }
    if (error.message) {
      return tFunc.translateError(error.message);
    }
    return merged.errors?.serverError || "An error occurred";
  };

  tFunc.formatCurrency = (amount: number): string => {
    try {
      const num = Number(amount) || 0;
      return "₹" + num.toLocaleString("en-IN");
    } catch {
      return "₹" + amount;
    }
  };

  tFunc.formatDate = (date: Date | string | number): string => {
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return String(date);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return String(date);
    }
  };

  return tFunc as TranslationApi;
}

export const languageNames: Record<Language, string> = {
  hi: "हिन्दी (Hindi)",
  en: "English",
  mr: "मराठी (Marathi)",
  gu: "ગુજરાતી (Gujarati)",
  bn: "বাংলা (Bengali)",
  ta: "தமிழ் (Tamil)",
  te: "తెలుగు (Telugu)",
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
  bho: "भोजपुरी (Bhojpuri)",
  doi: "डोगरी (Dogri)",
  sat: "संथाली (Santali)",
  ks: "कश्मीरी (Kashmiri)",
  sd: "सिंधी (Sindhi)",
  mni: "मणिपुरी (Manipuri)",
};

export const LOCALE_CONFIGS: Record<Language, LocaleConfig> = {
  hi: {
    code: "hi",
    nativeName: "हिन्दी",
    englishName: "Hindi",
    script: "devanagari",
    isRTL: false,
    numberLocale: "hi-IN",
    dateLocale: "hi-IN",
    isComplete: true,
  },
  en: {
    code: "en",
    nativeName: "English",
    englishName: "English",
    script: "latin",
    isRTL: false,
    numberLocale: "en-IN",
    dateLocale: "en-IN",
    isComplete: true,
  },
  mr: {
    code: "mr",
    nativeName: "मराठी",
    englishName: "Marathi",
    script: "devanagari",
    isRTL: false,
    numberLocale: "mr-IN",
    dateLocale: "mr-IN",
    isComplete: true,
  },
  gu: {
    code: "gu",
    nativeName: "ગુજરાતી",
    englishName: "Gujarati",
    script: "gujarati",
    isRTL: false,
    numberLocale: "gu-IN",
    dateLocale: "gu-IN",
    isComplete: true,
  },
  bn: {
    code: "bn",
    nativeName: "বাংলা",
    englishName: "Bengali",
    script: "bengali",
    isRTL: false,
    numberLocale: "bn-IN",
    dateLocale: "bn-IN",
    isComplete: true,
  },
  ta: {
    code: "ta",
    nativeName: "தமிழ்",
    englishName: "Tamil",
    script: "tamil",
    isRTL: false,
    numberLocale: "ta-IN",
    dateLocale: "ta-IN",
    isComplete: true,
  },
  te: {
    code: "te",
    nativeName: "తెలుగు",
    englishName: "Telugu",
    script: "telugu",
    isRTL: false,
    numberLocale: "te-IN",
    dateLocale: "te-IN",
    isComplete: true,
  },
  kn: {
    code: "kn",
    nativeName: "ಕನ್ನಡ",
    englishName: "Kannada",
    script: "kannada",
    isRTL: false,
    numberLocale: "kn-IN",
    dateLocale: "kn-IN",
    isComplete: true,
  },
  ml: {
    code: "ml",
    nativeName: "മലയാളം",
    englishName: "Malayalam",
    script: "malayalam",
    isRTL: false,
    numberLocale: "ml-IN",
    dateLocale: "ml-IN",
    isComplete: true,
  },
  pa: {
    code: "pa",
    nativeName: "ਪੰਜਾਬੀ",
    englishName: "Punjabi",
    script: "gurmukhi",
    isRTL: false,
    numberLocale: "pa-IN",
    dateLocale: "pa-IN",
    isComplete: true,
  },
  or: {
    code: "or",
    nativeName: "ଓଡ଼ିଆ",
    englishName: "Odia",
    script: "odia",
    isRTL: false,
    numberLocale: "or-IN",
    dateLocale: "or-IN",
    isComplete: true,
  },
  as: {
    code: "as",
    nativeName: "অসমীয়া",
    englishName: "Assamese",
    script: "bengali",
    isRTL: false,
    numberLocale: "as-IN",
    dateLocale: "as-IN",
    isComplete: true,
  },
  ur: {
    code: "ur",
    nativeName: "اردو",
    englishName: "Urdu",
    script: "arabic",
    isRTL: true,
    numberLocale: "ur-IN",
    dateLocale: "ur-IN",
    isComplete: true,
  },
  sa: {
    code: "sa",
    nativeName: "संस्कृतम्",
    englishName: "Sanskrit",
    script: "devanagari",
    isRTL: false,
    numberLocale: "sa-IN",
    dateLocale: "sa-IN",
    isComplete: true,
  },
  ne: {
    code: "ne",
    nativeName: "नेपाली",
    englishName: "Nepali",
    script: "devanagari",
    isRTL: false,
    numberLocale: "ne-IN",
    dateLocale: "ne-IN",
    isComplete: true,
  },
  kok: {
    code: "kok",
    nativeName: "कोंकणी",
    englishName: "Konkani",
    script: "devanagari",
    isRTL: false,
    numberLocale: "kok-IN",
    dateLocale: "kok-IN",
    isComplete: true,
  },
  mai: {
    code: "mai",
    nativeName: "मैथिली",
    englishName: "Maithili",
    script: "devanagari",
    isRTL: false,
    numberLocale: "mai-IN",
    dateLocale: "mai-IN",
    isComplete: true,
  },
  bho: {
    code: "bho",
    nativeName: "भोजपुरी",
    englishName: "Bhojpuri",
    script: "devanagari",
    isRTL: false,
    numberLocale: "hi-IN",
    dateLocale: "hi-IN",
    isComplete: true,
  },
  doi: {
    code: "doi",
    nativeName: "डोगरी",
    englishName: "Dogri",
    script: "devanagari",
    isRTL: false,
    numberLocale: "doi-IN",
    dateLocale: "doi-IN",
    isComplete: true,
  },
  sat: {
    code: "sat",
    nativeName: "संथाली",
    englishName: "Santali",
    script: "devanagari",
    isRTL: false,
    numberLocale: "sat-IN",
    dateLocale: "sat-IN",
    isComplete: true,
  },
  ks: {
    code: "ks",
    nativeName: "کٲشُر / कश्मीरी",
    englishName: "Kashmiri",
    script: "arabic",
    isRTL: true,
    numberLocale: "ks-IN",
    dateLocale: "ks-IN",
    isComplete: true,
  },
  sd: {
    code: "sd",
    nativeName: "सिंधी",
    englishName: "Sindhi",
    script: "arabic",
    isRTL: true,
    numberLocale: "sd-IN",
    dateLocale: "sd-IN",
    isComplete: true,
  },
  mni: {
    code: "mni",
    nativeName: "মৈতৈলোন্ / মণিপুরি",
    englishName: "Manipuri",
    script: "bengali",
    isRTL: false,
    numberLocale: "mni-IN",
    dateLocale: "mni-IN",
    isComplete: true,
  },
};
