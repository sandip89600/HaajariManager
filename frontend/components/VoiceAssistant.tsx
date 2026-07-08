import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Dimensions,
  ScrollView,
  DeviceEventEmitter,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { appContextTracker } from "@/utils/appContextTracker";
import { BlurView } from "expo-blur";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useAudioRecorder, AudioModule, RecordingPresets, setAudioModeAsync } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import {
  storage,
  API_URL,
  Worker,
  AttendanceRecord,
  PaymentRecord,
  authenticatedFetch,
  VoiceSettings,
  DEFAULT_VOICE_SETTINGS,
} from "@/utils/storage";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { navigationRef } from "@/navigation/navigationRef";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ─── LOCAL COMMAND PARSER ──────────────────────────────────────────────────────
const parseLocalCommand = (
  text: string,
): { action: string; data: any; response: string } | null => {
  const t = text.toLowerCase().trim();
  if (!t) return null;

  // 1. ADD WORKER
  if (
    t.includes("add worker") ||
    t.startsWith("add worker") ||
    t.includes("add kaamgar") ||
    t.includes("add kamgar")
  ) {
    const clean = t.replace(/add worker|add kaamgar|add kamgar/g, "").trim();
    if (clean) {
      const parts = clean.split(/\s+/);
      const name =
        parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      let dailyRate = 500;
      let category = "labour";
      const rateMatch = clean.match(/\b\d+\b/);
      if (rateMatch) dailyRate = parseInt(rateMatch[0]);
      const categories = [
        "labour", "bai", "mistri", "bandkam", "plaster", "tiles", "sutar",
      ];
      for (const cat of categories) {
        if (clean.includes(cat)) { category = cat; break; }
      }
      return {
        action: "ADD_WORKER",
        data: { name, dailyRate, category },
        response: `Worker "${name}" added — Rs.${dailyRate}/day, ${category}.`,
      };
    } else {
      return {
        action: "ADD_WORKER",
        data: { name: "New Worker", dailyRate: 500, category: "labour" },
        response: 'Worker "New Worker" created with default settings.',
      };
    }
  }

  // 2. ADD DAY RATE / ADD CATEGORY
  if (t.includes("add day rate") || t.includes("add daily rate") || t.includes("add rate")) {
    const rateMatch = t.match(/\b\d+\b/);
    const dailyRate = rateMatch ? parseInt(rateMatch[0]) : 500;
    return {
      action: "ADD_WORKER",
      data: { name: `Worker Rs.${dailyRate}`, dailyRate, category: "labour" },
      response: `Worker created with daily rate of Rs.${dailyRate}.`,
    };
  }

  if (t.includes("add category")) {
    let category = "labour";
    const categories = ["labour", "bai", "mistri", "bandkam", "plaster", "tiles", "sutar"];
    for (const cat of categories) {
      if (t.includes(cat)) { category = cat; break; }
    }
    const name = `Worker ${category.charAt(0).toUpperCase() + category.slice(1)}`;
    return {
      action: "ADD_WORKER",
      data: { name, dailyRate: 500, category },
      response: `Worker created with category "${category}".`,
    };
  }

  // 3. READ IT
  if (
    t.includes("read it") || t.includes("read") || t.includes("list") ||
    t.includes("padho") || t.includes("suno")
  ) {
    return { action: "READ_LIST", data: {}, response: "Reading worker list..." };
  }

  // 4. DELETE IT / EDIT THIS (only for "last" or generic "delete it")
  const isDeleteLast = 
    t === "delete" || 
    t === "delete it" || 
    t === "hata do" || 
    t === "edit" ||
    t.includes("delete last") || 
    t.includes("delete last worker") ||
    t.includes("hata do last") ||
    t.includes("last kaamgar delete") ||
    t.includes("last worker delete");

  if (isDeleteLast) {
    return {
      action: "DELETE_LAST_WORKER",
      data: {},
      response: "Deleting the last added worker.",
    };
  }

  // Navigation
  if (t.includes("worker") || t.includes("kaamgar") || t.includes("kamgar")) {
    if (t.includes("open") || t.includes("kholo") || t.includes("navigate") || t.includes("go to") || t.includes("view")) {
      return { action: "OPEN_SCREEN", data: { screen: "Workers" }, response: "Opening Workers screen." };
    }
  }
  if (t.includes("summary") || t.includes("payment") || t.includes("bhugtan") || t.includes("hisab") || t.includes("pay")) {
    if (t.includes("open") || t.includes("kholo") || t.includes("navigate") || t.includes("go to") || t.includes("view")) {
      return { action: "OPEN_SCREEN", data: { screen: "Summary" }, response: "Opening Summary screen." };
    }
  }
  if (t.includes("attendance") || t.includes("haajari") || t.includes("hajiri") || t.includes("presence")) {
    if (t.includes("open") || t.includes("kholo") || t.includes("navigate") || t.includes("go to") || t.includes("view")) {
      return { action: "OPEN_SCREEN", data: { screen: "Attendance" }, response: "Opening Attendance screen." };
    }
  }
  if (t.includes("setting") || t.includes("vinyas") || t.includes("bhavana")) {
    if (t.includes("open") || t.includes("kholo") || t.includes("navigate") || t.includes("go to") || t.includes("view")) {
      return { action: "OPEN_SCREEN", data: { screen: "Settings" }, response: "Opening Settings screen." };
    }
  }
  if (t.includes("profile") || t.includes("account") || t.includes("khata") || t.includes("user")) {
    if (t.includes("open") || t.includes("kholo") || t.includes("navigate") || t.includes("go to")) {
      return { action: "OPEN_SCREEN", data: { screen: "Profile" }, response: "Opening Profile screen." };
    }
  }
  if (t.includes("back") || t.includes("piche") || t.includes("wapas") || t.includes("pichhe")) {
    return { action: "GO_BACK", data: {}, response: "Going back." };
  }
  if (t.includes("theme") || t.includes("dark") || t.includes("light") || t.includes("color")) {
    if (t.includes("switch") || t.includes("change") || t.includes("badlo") || t.includes("toggle")) {
      return { action: "SWITCH_THEME", data: {}, response: "Switching app theme." };
    }
  }

  return null;
};

// ─── TYPES ─────────────────────────────────────────────────────────────────────
interface ChatMessage {
  role: "user" | "model";
  text: string;
  timestamp?: number;
}

type CopilotMode = "none" | "launcher" | "voice" | "chat" | "live";

// ─── QUICK LAUNCHER CARDS ──────────────────────────────────────────────────────
const LAUNCHER_CARDS = [
  {
    id: "voice",
    icon: "mic" as const,
    title: "Voice Command",
    subtitle: "Say what you need done",
    color: "#F97316",
    bg: "rgba(249,115,22,0.12)",
  },
  {
    id: "chat",
    icon: "message-square" as const,
    title: "Chat with AI",
    subtitle: "Ask questions, get reports",
    color: "#3B82F6",
    bg: "rgba(59,130,246,0.12)",
  },
  {
    id: "live",
    icon: "zap" as const,
    title: "Live Mode",
    subtitle: "Hands-free continuous listening",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.12)",
  },
  {
    id: "summary",
    icon: "bar-chart-2" as const,
    title: "Today's Summary",
    subtitle: "Quick overview of site status",
    color: "#22C55E",
    bg: "rgba(34,197,94,0.12)",
  },
  {
    id: "add_worker",
    icon: "user-plus" as const,
    title: "Add Worker",
    subtitle: "Register a new site worker",
    color: "#8B5CF6",
    bg: "rgba(139,92,246,0.12)",
  },
];

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function VoiceAssistant() {
  const { theme, isDark, setThemeMode } = useTheme();
  const { language, t } = useLanguage();
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const isRecordingActiveRef = useRef(false);

  // Language → BCP-47 locale map for Speech engine
  const LANG_TO_LOCALE: Record<string, string> = {
    en: "en-IN",
    hi: "hi-IN",
    mr: "mr-IN",
    gu: "gu-IN",
    ta: "ta-IN",
    te: "te-IN",
    kn: "kn-IN",
    bn: "bn-IN",
  };

  // Voice settings (loaded from storage on mount)
  const [voiceSettings, setVoiceSettingsState] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const voiceSettingsRef = useRef<VoiceSettings>(DEFAULT_VOICE_SETTINGS);

  // Mode
  const [mode, setMode] = useState<CopilotMode>("none");

  // Core processing states
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [voiceTranscriptPreview, setVoiceTranscriptPreview] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [executedAction, setExecutedAction] = useState<string | null>(null);
  const [actionDetail, setActionDetail] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    action: string;
    data: any;
    message: string;
  } | null>(null);

  // Input states
  const [chatInput, setChatInput] = useState("");
  const [liveTextCommand, setLiveTextCommand] = useState("");
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [hasProactiveHint, setHasProactiveHint] = useState(false);

  // Toast
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Refs
  const scrollViewRef = useRef<ScrollView>(null);
  const liveActiveRef = useRef(false);
  const liveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const voiceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPreparingRecordingRef = useRef(false);
  const chatInputRef = useRef<TextInput>(null);
  const liveAccumulatedTextRef = useRef("");

  // Waveform shared values
  const pulse1 = useSharedValue(1);
  const pulse2 = useSharedValue(1);
  const pulse3 = useSharedValue(1);
  const pulse4 = useSharedValue(1);
  const pulse5 = useSharedValue(1);

  // Button animations
  const buttonScale = useSharedValue(1);
  const pulseRingScale = useSharedValue(1);
  const pulseRingOpacity = useSharedValue(0);

  // ─── LOAD VOICE SETTINGS ────────────────────────────────────────────────────
  useEffect(() => {
    storage.getVoiceSettings().then((vs) => {
      setVoiceSettingsState(vs);
      voiceSettingsRef.current = vs;
    });
  }, []);

  // Listen for voice settings changes (from SettingsScreen)
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("voiceSettingsChanged", (vs: VoiceSettings) => {
      setVoiceSettingsState(vs);
      voiceSettingsRef.current = vs;
    });
    return () => sub.remove();
  }, []);

  // ─── PROACTIVE HINT ─────────────────────────────────────────────────────────
  useEffect(() => {
    const ctx = appContextTracker.getContext();
    setHasProactiveHint(ctx.currentScreen === "AttendanceTab");
  }, []);

  // ─── PROACTIVE GLOW ANIMATION ────────────────────────────────────────────────
  useEffect(() => {
    if (hasProactiveHint && mode === "none") {
      pulseRingScale.value = withRepeat(
        withSequence(
          withTiming(1.4, { duration: 1800 }),
          withTiming(1.0, { duration: 1800 }),
        ),
        -1, false,
      );
      pulseRingOpacity.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: 1800 }),
          withTiming(0, { duration: 1800 }),
        ),
        -1, false,
      );
    } else {
      pulseRingScale.value = withTiming(1, { duration: 300 });
      pulseRingOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [hasProactiveHint, mode, pulseRingOpacity, pulseRingScale]);

  // ─── WAVEFORM ANIMATIONS ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isRecording) {
      pulse1.value = withRepeat(withSequence(withTiming(2.5, { duration: 300 }), withTiming(1, { duration: 300 })), -1, true);
      pulse2.value = withRepeat(withSequence(withTiming(1.8, { duration: 250 }), withTiming(1, { duration: 250 })), -1, true);
      pulse3.value = withRepeat(withSequence(withTiming(3.0, { duration: 350 }), withTiming(1, { duration: 350 })), -1, true);
      pulse4.value = withRepeat(withSequence(withTiming(2.0, { duration: 280 }), withTiming(1, { duration: 280 })), -1, true);
      pulse5.value = withRepeat(withSequence(withTiming(1.5, { duration: 200 }), withTiming(1, { duration: 200 })), -1, true);
    } else {
      pulse1.value = withTiming(1);
      pulse2.value = withTiming(1);
      pulse3.value = withTiming(1);
      pulse4.value = withTiming(1);
      pulse5.value = withTiming(1);
    }
  }, [isRecording, pulse1, pulse2, pulse3, pulse4, pulse5]);

  // ─── ANIMATED STYLES ─────────────────────────────────────────────────────────
  const animatedWave1 = useAnimatedStyle(() => ({ transform: [{ scaleY: pulse1.value }] }));
  const animatedWave2 = useAnimatedStyle(() => ({ transform: [{ scaleY: pulse2.value }] }));
  const animatedWave3 = useAnimatedStyle(() => ({ transform: [{ scaleY: pulse3.value }] }));
  const animatedWave4 = useAnimatedStyle(() => ({ transform: [{ scaleY: pulse4.value }] }));
  const animatedWave5 = useAnimatedStyle(() => ({ transform: [{ scaleY: pulse5.value }] }));

  const animatedButton = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));
  const animatedRing = useAnimatedStyle(() => ({
    transform: [{ scale: pulseRingScale.value }],
    opacity: pulseRingOpacity.value,
  }));

  // ─── TOAST ───────────────────────────────────────────────────────────────────
  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── TTS ─────────────────────────────────────────────────────────────────────
  const speakResponse = (text: string, onDone?: () => void) => {
    const vs = voiceSettingsRef.current;

    // If voice response is disabled, just call onDone immediately
    if (!vs.enabled) {
      if (onDone) onDone();
      return;
    }

    // Stop any in-progress speech
    Speech.stop();

    // Determine the locale based on current app language
    const locale = LANG_TO_LOCALE[language] || "en-IN";

    // Truncate long text (keep spoken confirmations short — under 3 seconds)
    const maxLen = 120;
    const spokenText = text.length > maxLen ? text.substring(0, maxLen) + "..." : text;

    setIsSpeaking(true);

    Speech.speak(spokenText, {
      language: locale,
      rate: vs.speed,
      pitch: vs.pitch,
      volume: vs.volume,
      onStart: () => setIsSpeaking(true),
      onDone: () => {
        setIsSpeaking(false);
        if (onDone) onDone();
      },
      onStopped: () => {
        setIsSpeaking(false);
      },
      onError: () => {
        setIsSpeaking(false);
        if (onDone) onDone();
      },
    });
  };

  // ─── FUZZY WORKER MATCH ───────────────────────────────────────────────────────
  const fuzzyMatchWorker = (workers: Worker[], name: string): Worker | null => {
    const normalized = name.toLowerCase().trim();
    return (
      workers.find((w) => w.name.toLowerCase() === normalized) ||
      workers.find(
        (w) =>
          w.name.toLowerCase().includes(normalized) ||
          normalized.includes(w.name.toLowerCase()),
      ) ||
      null
    );
  };

  // ─── MODE STARTERS ────────────────────────────────────────────────────────────
  const openLauncher = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMode("launcher");
  };

  const startVoiceMode = async () => {
    Speech.stop();
    setMode("voice");
    setVoiceTranscriptPreview("");
    setTranscript("");
    await startRecording();
  };

  const startChatMode = () => {
    Speech.stop();
    setMode("chat");
    setExecutedAction(null);
    setActionDetail(null);
    if (chatHistory.length === 0) {
      setAiResponse(
        "Hi! I'm HAI, your AI assistant. Ask me anything about workers, attendance, payments, or your site.",
      );
    }
    setTimeout(() => chatInputRef.current?.focus(), 400);
  };

  const startLiveMode = async () => {
    Speech.stop();
    setMode("live");
    liveActiveRef.current = true;
    liveAccumulatedTextRef.current = "";
    showToast("Live Mode Active", "info");
    runLiveLoop();
  };

  const stopLiveMode = async () => {
    liveActiveRef.current = false;
    liveAccumulatedTextRef.current = "";
    if (liveTimeoutRef.current) {
      clearTimeout(liveTimeoutRef.current);
      liveTimeoutRef.current = null;
    }
    if (isRecordingActiveRef.current) {
      try { await audioRecorder.stop(); } catch {}
      isRecordingActiveRef.current = false;
    }
    setIsRecording(false);
    setIsProcessing(false);
    setMode("none");
    showToast("Live Mode Stopped", "info");
  };

  const closeLauncher = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMode("none");
  };

  const closeAssistant = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMode("none");
    if (voiceTimeoutRef.current) {
      clearTimeout(voiceTimeoutRef.current);
      voiceTimeoutRef.current = null;
    }
    if (isRecordingActiveRef.current) {
      try { await audioRecorder.stop(); } catch {}
      isRecordingActiveRef.current = false;
    }
    setIsRecording(false);
    setIsProcessing(false);
    Speech.stop();
  };

  // ─── LIVE LOOP ────────────────────────────────────────────────────────────────
  const runLiveLoop = async () => {
    if (!liveActiveRef.current) return;
    if (isSpeaking || pendingConfirmation) return;
    if (isRecordingActiveRef.current || isPreparingRecordingRef.current) return;

    try {
      isPreparingRecordingRef.current = true;
      setIsRecording(true);
      const { status } = await AudioModule.requestRecordingPermissionsAsync();
      if (status !== "granted") {
        showToast("Microphone permission required.", "error");
        stopLiveMode();
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      isRecordingActiveRef.current = true;
      isPreparingRecordingRef.current = false;

      liveTimeoutRef.current = setTimeout(async () => {
        if (!liveActiveRef.current) return;
        try {
          setIsRecording(false);
          setIsProcessing(true);
          await audioRecorder.stop();
          const uri = audioRecorder.uri;
          isRecordingActiveRef.current = false;

          if (liveActiveRef.current && !isSpeaking && !pendingConfirmation) {
            setTimeout(() => {
              if (liveActiveRef.current && !isSpeaking && !pendingConfirmation) runLiveLoop();
            }, 300);
          }

          if (uri && liveActiveRef.current) {
            const fileInfo = await FileSystem.getInfoAsync(uri);
            if (fileInfo.exists) {
              const base64Audio = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
              await processLiveAudio(base64Audio);
            } else {
              console.log("[Live Mode] Audio file not found (chunk too short).");
            }
          }
        } catch (e) {
          console.error("Live loop stop error:", e);
        } finally {
          setIsProcessing(false);
        }
      }, 4500);
    } catch (err) {
      isPreparingRecordingRef.current = false;
      console.error("Live loop create error:", err);
      showToast("Microphone error in Live Mode", "error");
      stopLiveMode();
    }
  };

  // ─── PROCESS LIVE AUDIO ───────────────────────────────────────────────────────
  const processLiveAudio = async (base64Audio: string) => {
    try {
      const auth = await storage.getAuth();
      const token = auth?.token;
      const ctx = appContextTracker.getContext();

      const response = await authenticatedFetch(`${API_URL}/voice/process`, {
        method: "POST",
        body: JSON.stringify({
          audio: base64Audio,
          mimeType: Platform.OS === "ios" ? "audio/x-m4a" : "audio/mp4",
          history: [],
          language,
          currentScreen: ctx.currentScreen,
          screenContext: ctx,
          mode: "live",
          liveContext: liveAccumulatedTextRef.current || undefined,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const transcriptText = result.transcript;
        if (transcriptText) {
          setTranscript(transcriptText);
          const localParsed = parseLocalCommand(transcriptText);
          if (localParsed) {
            setAiResponse(localParsed.response);
            await executeAction(localParsed.action, localParsed.data, localParsed.response);
            showToast(`Done: ${localParsed.action}`, "success");
            liveAccumulatedTextRef.current = "";
            return;
          }
          if (result.action && result.action !== "UNKNOWN" && result.action !== "INCOMPLETE") {
            if (result.response) { setAiResponse(result.response); }
            await executeAction(result.action, result.data, result.response);
            showToast(`Done: ${result.action}`, "success");
            liveAccumulatedTextRef.current = "";
          } else if (result.action === "INCOMPLETE") {
            liveAccumulatedTextRef.current = (liveAccumulatedTextRef.current + " " + transcriptText).trim();
            if (result.response && result.response.trim() !== "") {
              showToast(result.response, "info");
              speakResponse(result.response);
            }
          } else {
            liveAccumulatedTextRef.current = "";
          }
        }
      }
    } catch (err: any) {
      console.error("Live audio processing failed:", err);
      const isTokenError = err.message && (err.message.includes("token") || err.message.includes("Unauthorized"));
      const isGeminiError = err.message && (err.message.includes("Gemini") || err.message.includes("generativelanguage") || err.message.includes("Model"));
      let errorSpeakText = "";
      if (isTokenError) {
        errorSpeakText = "Session expired. Please log in again.";
      } else if (isGeminiError) {
        errorSpeakText = "Gemini AI is not responding. Please check your API key.";
      } else {
        errorSpeakText = "Connection error. Please check your network.";
      }
      showToast(errorSpeakText, "error");
      speakResponse(errorSpeakText);
    }
  };

  // ─── TEXT COMMAND ─────────────────────────────────────────────────────────────
  const handleTextCommand = async (text: string) => {
    setTranscript(text);
    const localParsed = parseLocalCommand(text);
    if (localParsed) {
      setAiResponse(localParsed.response);
      await executeAction(localParsed.action, localParsed.data, localParsed.response);
      showToast(`Done: ${localParsed.action}`, "success");
    } else {
      const resp = `"${text}" not recognized. Try "Add worker Rajesh" or "read it".`;
      setAiResponse(resp);
      speakResponse(resp);
      showToast("Command not recognized", "error");
    }
  };

  // ─── RECORDING ───────────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const { status } = await AudioModule.requestRecordingPermissionsAsync();
      if (status !== "granted") {
        setTranscript("Microphone permission required.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      isRecordingActiveRef.current = true;
      setIsRecording(true);
      Speech.stop();
      if (mode === "voice") {
        voiceTimeoutRef.current = setTimeout(() => stopRecording(), 5500);
      }
    } catch (err) {
      console.error("Failed to start recording", err);
      setTranscript("Microphone permission required.");
    }
  };

  const stopRecording = async () => {
    if (voiceTimeoutRef.current) { clearTimeout(voiceTimeoutRef.current); voiceTimeoutRef.current = null; }
    if (!isRecordingActiveRef.current) return;
    setIsRecording(false);
    setIsProcessing(true);

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      isRecordingActiveRef.current = false;
      if (uri) {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists) {
          const base64Audio = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
          await processAudio(base64Audio);
        } else {
          console.warn("Audio file does not exist (recording was probably too short).");
          showToast("Hold the button longer to speak.", "info");
        }
      }
    } catch (err) {
      console.error("Failed to stop recording", err);
      setIsProcessing(false);
    }
  };

  const processAudio = async (base64Audio: string) => {
    try {
      const auth = await storage.getAuth();
      const token = auth?.token;
      const ctx = appContextTracker.getContext();

      const response = await authenticatedFetch(`${API_URL}/voice/process`, {
        method: "POST",
        body: JSON.stringify({
          audio: base64Audio,
          mimeType: Platform.OS === "ios" ? "audio/x-m4a" : "audio/mp4",
          history: mode === "chat"
            ? chatHistory.map((ch) => ({ role: ch.role, parts: [{ text: ch.text }] }))
            : [],
          language,
          currentScreen: ctx.currentScreen,
          screenContext: ctx,
          mode: mode,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Voice server error: ${errorText}`);
      }

      const result = await response.json();

      if (result.transcript) {
        setTranscript(result.transcript);
        if (mode === "voice") setVoiceTranscriptPreview(result.transcript);

        const localParsed = parseLocalCommand(result.transcript);
        if (localParsed) {
          setAiResponse(localParsed.response);
          await executeAction(localParsed.action, localParsed.data, localParsed.response);
          showToast(`Done: ${localParsed.action}`, "success");
          if (mode === "chat") {
            setChatHistory((prev) => [
              ...prev,
              { role: "user", text: result.transcript, timestamp: Date.now() },
              { role: "model", text: localParsed.response, timestamp: Date.now() },
            ]);
          }
          setIsProcessing(false);
          return;
        }

        if (mode === "chat") {
          const newHistory: ChatMessage[] = [
            ...chatHistory,
            { role: "user", text: result.transcript, timestamp: Date.now() },
          ];
          if (result.response) {
            setAiResponse(result.response);
            newHistory.push({ role: "model", text: result.response, timestamp: Date.now() });
            setChatHistory(newHistory);
            const hasAction = result.action && result.action !== "INCOMPLETE" && result.action !== "UNKNOWN";
            if (!hasAction) {
              speakResponse(result.response);
            }
          }
          if (result.action && result.action !== "INCOMPLETE" && result.action !== "UNKNOWN") {
            await executeAction(result.action, result.data, result.response);
          } else {
            setExecutedAction(null);
            setActionDetail(null);
          }
        } else if (mode === "voice") {
          const hasAction = result.action && result.action !== "INCOMPLETE" && result.action !== "UNKNOWN";
          if (result.response && !hasAction) {
            speakResponse(result.response);
          }
          if (hasAction) {
            await executeAction(result.action, result.data, result.response);
            showToast(`Done: ${result.action}`, "success");
          } else if (result.action === "INCOMPLETE") {
            showToast(result.response || "Details incomplete.", "info");
            if (result.response) speakResponse(result.response);
          } else {
            showToast("Command not understood.", "error");
            speakResponse(t.voiceConfirm?.errorNotUnderstood || "I didn't understand that.");
          }
        }
      }
    } catch (err: any) {
      console.error("Audio processing failed:", err);
      const isTokenError = err.message && (err.message.includes("token") || err.message.includes("Unauthorized"));
      const isGeminiError = err.message && (err.message.includes("Gemini") || err.message.includes("generativelanguage") || err.message.includes("Model"));
      let errorSpeakText = "";
      if (isTokenError) {
        errorSpeakText = "Session expired. Please log in again.";
      } else if (isGeminiError) {
        errorSpeakText = "Gemini AI is not responding. Please check your API key.";
      } else {
        errorSpeakText = "Connection error. Please check your network.";
      }
      showToast(errorSpeakText, "error");
      speakResponse(errorSpeakText);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePickAttachment = async (label: string) => {
    setAttachMenuOpen(false);
    try {
      if (label === "Camera") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          showToast("Camera permission is required to take photos", "error");
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: false,
          base64: true,
          quality: 0.5,
        });
        if (!result.canceled && result.assets && result.assets[0].base64) {
          setAttachedImage(result.assets[0].base64);
          showToast("Photo attached successfully", "success");
        }
      } else if (label === "Image" || label === "Document") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          showToast("Photo library permission is required to select photos", "error");
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: false,
          base64: true,
          quality: 0.5,
        });
        if (!result.canceled && result.assets && result.assets[0].base64) {
          setAttachedImage(result.assets[0].base64);
          showToast("Image attached successfully", "success");
        }
      } else {
        showToast(`${label} integration is coming soon`, "info");
      }
    } catch (err) {
      console.error("Failed to pick attachment:", err);
      showToast("Error picking attachment", "error");
    }
  };

  // ─── CHAT TEXT SUBMIT ─────────────────────────────────────────────────────────
  const submitChatText = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = { role: "user", text: text.trim(), timestamp: Date.now() };
    setChatHistory((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsProcessing(true);

    try {
      const localParsed = parseLocalCommand(text);
      if (localParsed) {
        setAiResponse(localParsed.response);
        speakResponse(localParsed.response);
        await executeAction(localParsed.action, localParsed.data);
        showToast(`Done: ${localParsed.action}`, "success");
        setChatHistory((prev) => [
          ...prev,
          { role: "model", text: localParsed.response, timestamp: Date.now() },
        ]);
        setIsProcessing(false);
        return;
      }

      const auth = await storage.getAuth();
      const token = auth?.token;
      const ctx = appContextTracker.getContext();

      const response = await authenticatedFetch(`${API_URL}/voice/process`, {
        method: "POST",
        body: JSON.stringify({
          text: text.trim(),
          image: attachedImage || undefined,
          history: chatHistory.map((ch) => ({ role: ch.role, parts: [{ text: ch.text }] })),
          language,
          currentScreen: ctx.currentScreen,
          screenContext: ctx,
          mode: "chat",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Voice server error: ${errorText}`);
      }

      const result = await response.json();
      if (result.response) {
        const aiMsg: ChatMessage = { role: "model", text: result.response, timestamp: Date.now() };
        setChatHistory((prev) => [...prev, aiMsg]);
        setAiResponse(result.response);
        const hasAction = result.action && result.action !== "UNKNOWN" && result.action !== "INCOMPLETE";
        if (!hasAction) {
          speakResponse(result.response);
        }
      }
      if (result.action && result.action !== "UNKNOWN" && result.action !== "INCOMPLETE") {
        await executeAction(result.action, result.data, result.response);
      }
    } catch (err: any) {
      console.error("Chat text submit failed:", err);
      const isTokenError = err.message && (err.message.includes("token") || err.message.includes("Unauthorized"));
      const isGeminiError = err.message && (err.message.includes("Gemini") || err.message.includes("generativelanguage") || err.message.includes("Model"));
      const errMsg = isTokenError 
        ? "Session expired. Please log in again." 
        : isGeminiError
        ? "Gemini AI is not responding. Please check your API key."
        : "Connection error. Check your internet and try again.";
      setChatHistory((prev) => [
        ...prev,
        { role: "model", text: errMsg, timestamp: Date.now() },
      ]);
      showToast(errMsg, "error");
      speakResponse(errMsg);
    } finally {
      setAttachedImage(null);
      setIsProcessing(false);
    }
  };

  // ─── EXECUTE ACTION ───────────────────────────────────────────────────────────
  const executeAction = async (action: string, data: any, responseText?: string) => {
    if (["DELETE_WORKER", "DELETE_PAYMENT", "DELETE_ATTENDANCE", "DELETE_ACCOUNT"].includes(action)) {
      let message = "Are you sure you want to delete this?";
      if (action === "DELETE_WORKER" && data.name) message = `Delete worker "${data.name}"?`;
      else if (action === "DELETE_PAYMENT") message = "Delete this payment?";
      else if (action === "DELETE_ATTENDANCE") message = "Delete this attendance record?";
      else if (action === "DELETE_ACCOUNT") message = "Delete your account? This is permanent.";
      setPendingConfirmation({ action, data, message });
      setTranscript(message);
      setAiResponse(message);
      speakResponse(message);
      return;
    }
    await executeActionDirect(action, data, responseText);
  };

  const executeActionDirect = async (action: string, data: any, responseText?: string) => {
    try {
      const workers = await storage.getWorkers();
      let worker: Worker | null = null;

      if (data.name) {
        worker = fuzzyMatchWorker(workers, data.name);
        if (!worker && action !== "ADD_WORKER") {
          const errText = t.voiceConfirm?.errorNotFound || `Worker "${data.name}" not found.`;
          setAiResponse(errText);
          speakResponse(errText);
          setExecutedAction("ERROR");
          setActionDetail(errText);
          return;
        }
      }

      switch (action) {
        case "READ_LIST": {
          const list = await storage.getWorkers();
          if (list.length === 0) {
            const resp = t.voiceConfirm?.errorNotFound || "You have no workers added yet.";
            setAiResponse(resp); speakResponse(resp); setActionDetail(resp);
          } else {
            const names = list.map((w) => w.name).join(", ");
            const resp = `${t.voiceConfirm?.searchResult || "Reading worker list:"} ${names}.`;
            setAiResponse(resp); speakResponse(resp); setActionDetail(`Workers: ${names}`);
          }
          setExecutedAction("READ_LIST");
          break;
        }
        case "DELETE_LAST_WORKER": {
          const list = await storage.getWorkers();
          if (list.length === 0) {
            const resp = t.voiceConfirm?.errorNotFound || "No workers to delete.";
            setAiResponse(resp); speakResponse(resp); setActionDetail(resp);
          } else {
            const last = list[list.length - 1];
            await storage.deleteWorker(last.id);
            setExecutedAction("DELETE_LAST_WORKER");
            setActionDetail(`Deleted: ${last.name}`);
          }
          break;
        }
        case "ADD_WORKER": {
          const newWorker: Worker = {
            id: "",
            name: data.name,
            dailyRate: data.dailyRate || 500,
            category: data.category || "labour",
            phone: data.phone || "",
            address: data.address || "",
            createdAt: Date.now(),
          };
          await storage.addWorker(newWorker);
          setExecutedAction("ADD_WORKER");
          setActionDetail(`Worker: ${data.name} (Rs.${data.dailyRate || 500}/day)`);
          break;
        }
        case "UPDATE_WORKER": {
          if (worker) {
            const updated = {
              ...worker,
              dailyRate: data.dailyRate !== undefined ? data.dailyRate : worker.dailyRate,
              category: data.category || worker.category,
              phone: data.phone || worker.phone,
            };
            await storage.updateWorker(updated);
            setExecutedAction("UPDATE_WORKER");
            setActionDetail(`Updated: ${worker.name} (Rs.${updated.dailyRate}/day)`);
          }
          break;
        }
        case "DELETE_WORKER": {
          if (worker) {
            await storage.deleteWorker(worker.id);
            setExecutedAction("DELETE_WORKER");
            setActionDetail(`Deleted: ${worker.name}`);
          }
          break;
        }
        case "MARK_ATTENDANCE": {
          if (worker) {
            let dateObj = new Date();
            if (data.date) {
              const match = String(data.date).match(/^(\d{4})-(\d{2})-(\d{2})/);
              if (match) {
                const year = parseInt(match[1], 10);
                const month = parseInt(match[2], 10) - 1; // 0-indexed
                const day = parseInt(match[3], 10);
                const parsed = new Date(year, month, day);
                if (!isNaN(parsed.getTime())) {
                  dateObj = parsed;
                }
              } else {
                const parsed = new Date(data.date);
                if (!isNaN(parsed.getTime())) {
                  dateObj = parsed;
                }
              }
            }

            let val: AttendanceRecord["value"] = "P";
            const statusStr = String(data.status || "").trim().toLowerCase();
            if (statusStr === "absent" || statusStr === "a" || statusStr === "anupasthit") {
              val = "A";
            } else if (statusStr === "half day" || statusStr === "h" || statusStr === "half") {
              val = "H";
            } else if (statusStr === "overtime" || statusStr === "ot") {
              val = "OT";
            } else {
              val = "P";
            }

            const record: AttendanceRecord = {
              workerId: worker.id,
              year: dateObj.getFullYear(),
              month: dateObj.getMonth(),
              day: dateObj.getDate(),
              value: val,
              dailyRate: worker.dailyRate,
              customWage: data.advance || undefined,
              finalPay: 0,
              timestamp: Date.now(),
            };
            await storage.setAttendanceRecord(record);
            setExecutedAction("MARK_ATTENDANCE");
            let details = `${worker.name} — ${val === "P" ? "Present" : val === "A" ? "Absent" : val === "H" ? "Half Day" : "Overtime"}`;
            if (data.advance) details += ` (Advance: Rs.${data.advance})`;
            setActionDetail(details);
          }
          break;
        }
        case "ADD_PAYMENT": {
          if (worker) {
            const dateObj = new Date();
            const payment: PaymentRecord = {
              id: "",
              workerId: worker.id,
              year: dateObj.getFullYear(),
              month: dateObj.getMonth(),
              amount: data.amount,
              paidAt: Date.now(),
              note: data.note || "Voice command payment",
              method: data.method || "Cash",
            };
            await storage.addPayment(payment);
            setExecutedAction("ADD_PAYMENT");
            setActionDetail(`${worker.name} — Rs.${data.amount}`);
          }
          break;
        }
        case "ADD_ADVANCE": {
          if (worker) {
            const dateObj = data.date ? new Date(data.date) : new Date();
            const attendanceList = await storage.getAttendance();
            const existing = attendanceList.find(
              (r) =>
                r.workerId === worker!.id &&
                r.year === dateObj.getFullYear() &&
                r.month === dateObj.getMonth() &&
                r.day === dateObj.getDate(),
            );
            const record: AttendanceRecord = {
              workerId: worker.id,
              year: dateObj.getFullYear(),
              month: dateObj.getMonth(),
              day: dateObj.getDate(),
              value: existing ? existing.value : "P",
              dailyRate: worker.dailyRate,
              customWage: data.amount,
              finalPay: 0,
              timestamp: Date.now(),
            };
            await storage.setAttendanceRecord(record);
            setExecutedAction("ADD_ADVANCE");
            setActionDetail(`Advance: ${worker.name} — Rs.${data.amount}`);
          }
          break;
        }
        case "SEARCH_WORKER": {
          if (navigationRef.isReady()) {
            navigationRef.navigate("MainTabs", {
              screen: "WorkersTab",
              params: { voiceSearchQuery: data.query },
            });
            setExecutedAction("SEARCH_WORKER");
            setActionDetail(`Searching: "${data.query}"`);
          }
          break;
        }
        case "OPEN_SCREEN": {
          if (navigationRef.isReady()) {
            const target = data.screen;
            let subScreen = "AttendanceTab";
            if (target === "Workers") subScreen = "WorkersTab";
            else if (target === "Attendance") subScreen = "AttendanceTab";
            else if (target === "Summary") subScreen = "SummaryTab";
            else if (target === "Settings") subScreen = "SettingsTab";
            if (target === "Dashboard") {
              navigationRef.navigate("AdminDashboard");
            } else if (target === "Profile") {
              navigationRef.navigate("UserProfile");
            } else if (target === "Subscription") {
              navigationRef.navigate("MainTabs", { screen: "SettingsTab", params: { openUpgrade: true } });
            } else if (target === "Reports") {
              navigationRef.navigate("MainTabs", { screen: "SummaryTab" });
            } else {
              navigationRef.navigate("MainTabs", { screen: subScreen });
            }
            setExecutedAction("OPEN_SCREEN");
            setActionDetail(`Navigated to: ${target}`);
          }
          break;
        }
        case "SHOW_SUMMARY":
        case "SHOW_REPORT": {
          if (navigationRef.isReady()) {
            navigationRef.navigate("MainTabs", { screen: "SummaryTab" });
            setExecutedAction(action);
            setActionDetail("Opened Summary Screen");
          }
          break;
        }
        case "EXPORT_PDF": {
          const success = await appContextTracker.triggerCallback("exportPDF", data.type);
          if (success !== null) {
            setExecutedAction("EXPORT_PDF");
            setActionDetail("Exported PDF summary report");
          } else {
            showToast("PDF Export only available on Summary screen", "error");
          }
          break;
        }
        case "GO_BACK": {
          if (navigationRef.isReady() && navigationRef.canGoBack()) {
            navigationRef.goBack();
            setExecutedAction("GO_BACK");
            setActionDetail("Navigated back");
          }
          break;
        }
        case "SWITCH_THEME": {
          await setThemeMode(isDark ? "light" : "dark");
          setExecutedAction("SWITCH_THEME");
          setActionDetail("Switched theme");
          break;
        }
        default:
          break;
      }

      DeviceEventEmitter.emit("refreshData");

      // Spoken voice confirmations at the end of the action
      if (action !== "READ_LIST") {
        let confirmText = responseText;
        if (!confirmText) {
          switch (action) {
            case "ADD_WORKER":
              confirmText = t.voiceConfirm?.workerAdded || "Worker added.";
              break;
            case "UPDATE_WORKER":
              confirmText = t.voiceConfirm?.workerUpdated || "Worker updated.";
              break;
            case "DELETE_WORKER":
            case "DELETE_LAST_WORKER":
              confirmText = t.voiceConfirm?.workerDeleted || "Worker deleted.";
              break;
            case "MARK_ATTENDANCE":
              confirmText = t.voiceConfirm?.attendanceMarked || "Attendance marked.";
              break;
            case "ADD_PAYMENT":
              confirmText = t.voiceConfirm?.paymentSaved || "Payment saved.";
              break;
            case "ADD_ADVANCE":
              confirmText = t.voiceConfirm?.advanceRecorded || "Advance recorded.";
              break;
            case "OPEN_SCREEN":
            case "SHOW_SUMMARY":
            case "SHOW_REPORT":
              confirmText = t.voiceConfirm?.screenOpened || "Screen opened.";
              break;
            case "SEARCH_WORKER":
              confirmText = t.voiceConfirm?.searchResult || "Searching workers.";
              break;
            case "EXPORT_PDF":
              confirmText = t.voiceConfirm?.exportStarted || "Export started.";
              break;
            case "GO_BACK":
              confirmText = t.voiceConfirm?.goBack || "Going back.";
              break;
            case "SWITCH_THEME":
              confirmText = t.voiceConfirm?.themeChanged || "Theme updated.";
              break;
          }
        }
        if (confirmText) {
          setAiResponse(confirmText);
          speakResponse(confirmText);
        }
      }
    } catch (err) {
      console.error("Action execution error:", err);
      setExecutedAction("ERROR");
      setActionDetail("Execution failed.");
    }
  };

  // ─── AUTO-SCROLL CHAT ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => { scrollViewRef.current?.scrollToEnd({ animated: true }); }, 100);
    }
  }, [chatHistory, isProcessing]);

  // ─── CONTEXT BANNER ───────────────────────────────────────────────────────────
  const ctx = appContextTracker.getContext();
  const contextBannerText = [
    ctx.currentScreen && ctx.currentScreen !== "Unknown" ? ctx.currentScreen : null,
    ctx.selectedWorkerName ? `Worker: ${ctx.selectedWorkerName}` : null,
  ].filter(Boolean).join(" · ");

  // ─── SIMPLE MARKDOWN RENDERER (bold + bullets) ────────────────────────────────
  const renderAIText = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      const isBullet = line.startsWith("- ") || line.startsWith("• ");
      const cleaned = isBullet ? line.slice(2) : line;
      const parts = cleaned.split(/(\*\*[^*]+\*\*)/g);
      const richParts = parts.map((part, pIdx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <ThemedText key={pIdx} style={{ fontWeight: "700" }}>{part.slice(2, -2)}</ThemedText>;
        }
        return <ThemedText key={pIdx} style={{ fontSize: 14, lineHeight: 20 }}>{part}</ThemedText>;
      });
      return (
        <View key={idx} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: isBullet ? 3 : 0 }}>
          {isBullet && (
            <ThemedText style={{ color: theme.primary, fontWeight: "700", marginRight: 6, fontSize: 14 }}>•</ThemedText>
          )}
          <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap" }}>{richParts}</View>
        </View>
      );
    });
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── TOAST ─────────────────────────────────────────────────────────── */}
      {toast && (
        <Animated.View
          entering={SlideInDown.duration(260)}
          exiting={FadeOut.duration(200)}
          style={[
            styles.toastContainer,
            {
              backgroundColor:
                toast.type === "success" ? "rgba(16,185,129,0.95)"
                  : toast.type === "error" ? "rgba(239,68,68,0.95)"
                  : "rgba(59,130,246,0.95)",
            },
          ]}
        >
          <Feather
            name={toast.type === "success" ? "check-circle" : toast.type === "error" ? "alert-circle" : "info"}
            size={16} color="#FFF"
          />
          <ThemedText style={styles.toastText}>{toast.message}</ThemedText>
        </Animated.View>
      )}

      {/* ── FLOATING AI BUTTON ────────────────────────────────────────────── */}
      {mode !== "chat" && (
        <Pressable
          onPress={openLauncher}
          onPressIn={() => { buttonScale.value = withSpring(0.88, { mass: 0.5, damping: 15 }); }}
          onPressOut={() => { buttonScale.value = withSpring(1, { mass: 0.5, damping: 15 }); }}
          style={styles.fab}
        >
          <Animated.View style={[styles.fabGlowRing, animatedRing]} />
          <Animated.View style={animatedButton}>
            <LinearGradient colors={["#F97316", "#FB923C"]} style={styles.fabGradient}>
              <Ionicons name="sparkles" size={26} color="#FFF" />
            </LinearGradient>
          </Animated.View>
        </Pressable>
      )}

      {/* ── CHAT PANEL ────────────────────────────────────────────────────── */}
      {mode === "chat" && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Pressable style={styles.darkBackdrop} onPress={closeAssistant} />

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.chatKAV}
            keyboardVerticalOffset={0}
            pointerEvents="box-none"
          >
            <Animated.View
              entering={SlideInDown.springify().mass(0.7).damping(18).stiffness(180)}
              exiting={SlideOutDown.duration(220)}
              style={[
                styles.chatPanel,
                {
                  backgroundColor: isDark ? "rgba(10,10,20,0.98)" : "rgba(255,255,255,0.99)",
                  borderTopColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                },
              ]}
            >
              <View style={[styles.handle, { backgroundColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)" }]} />

              {/* Header */}
              <View style={styles.chatHeader}>
                <View style={styles.chatHeaderLeft}>
                  <LinearGradient colors={["#F97316", "#FB923C"]} style={styles.chatAvatar}>
                    <Ionicons name="sparkles" size={14} color="#FFF" />
                  </LinearGradient>
                  <View>
                    <ThemedText style={styles.chatHeaderTitle}>HAI</ThemedText>
                    <ThemedText style={[styles.chatHeaderSub, { color: theme.textSecondary }]}>
                      {isSpeaking ? "Speaking…" : isProcessing ? "Thinking…" : "AI Assistant"}
                    </ThemedText>
                  </View>
                </View>
                <Pressable
                  style={[styles.chatCloseBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}
                  onPress={closeAssistant}
                >
                  <Feather name="x" size={18} color={theme.textSecondary} />
                </Pressable>
              </View>

              {/* Context banner */}
              {contextBannerText ? (
                <View style={[styles.contextBanner, {
                  backgroundColor: isDark ? "rgba(255,107,53,0.1)" : "rgba(255,107,53,0.08)",
                  borderColor: isDark ? "rgba(255,107,53,0.2)" : "rgba(255,107,53,0.15)",
                }]}>
                  <Feather name="map-pin" size={11} color={theme.primary} style={{ marginRight: 6 }} />
                  <ThemedText style={[styles.contextBannerText, { color: theme.primary }]}>
                    {contextBannerText}
                  </ThemedText>
                </View>
              ) : null}

              {/* Messages */}
              <ScrollView
                ref={scrollViewRef}
                style={styles.chatScroll}
                contentContainerStyle={styles.chatScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Empty state */}
                {chatHistory.length === 0 && (
                  <View style={styles.emptyState}>
                    <LinearGradient colors={["#F97316", "#FB923C"]} style={styles.emptyAvatar}>
                      <Ionicons name="sparkles" size={28} color="#FFF" />
                    </LinearGradient>
                    <ThemedText style={styles.emptyTitle}>HAI Assistant</ThemedText>
                    <ThemedText style={[styles.emptySub, { color: theme.textSecondary }]}>
                      Ask me anything about your site — workers, attendance, payments, reports.
                    </ThemedText>
                    {["Who's absent today?", "Add worker Rajesh", "Show this month's summary"].map((s) => (
                      <Pressable
                        key={s}
                        style={[styles.suggestion, { borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)", backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)" }]}
                        onPress={() => submitChatText(s)}
                      >
                        <ThemedText style={{ fontSize: 13 }}>{s}</ThemedText>
                        <Feather name="arrow-up-right" size={14} color={theme.primary} />
                      </Pressable>
                    ))}
                  </View>
                )}

                {/* Bubbles */}
                {chatHistory.map((msg, idx) => {
                  const isUser = msg.role === "user";
                  return (
                    <View key={idx} style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAI]}>
                      {!isUser && (
                        <LinearGradient colors={["#F97316", "#FB923C"]} style={styles.bubbleAvatar}>
                          <Ionicons name="sparkles" size={10} color="#FFF" />
                        </LinearGradient>
                      )}
                      <View style={[styles.bubble, isUser
                        ? [styles.userBubble, { backgroundColor: theme.primary }]
                        : [styles.aiBubble, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]
                      ]}>
                        {isUser
                          ? <ThemedText style={{ fontSize: 14, color: "#FFF", lineHeight: 20 }}>{msg.text}</ThemedText>
                          : <View>{renderAIText(msg.text)}</View>
                        }
                      </View>
                    </View>
                  );
                })}

                {/* Typing indicator */}
                {isProcessing && (
                  <Animated.View entering={FadeIn.duration(200)} style={styles.bubbleRow}>
                    <LinearGradient colors={["#F97316", "#FB923C"]} style={styles.bubbleAvatar}>
                      <Ionicons name="sparkles" size={10} color="#FFF" />
                    </LinearGradient>
                    <View style={[styles.bubble, styles.aiBubble, {
                      backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                      paddingVertical: 14,
                    }]}>
                      <View style={styles.typingDots}>
                        {[0, 1, 2].map((i) => (
                          <View key={i} style={[styles.typingDot, { backgroundColor: theme.primary }]} />
                        ))}
                      </View>
                    </View>
                  </Animated.View>
                )}

                {/* Action chip */}
                {executedAction && executedAction !== "ERROR" && actionDetail && (
                  <View style={[styles.actionChip, { backgroundColor: isDark ? "rgba(16,185,129,0.1)" : "rgba(16,185,129,0.08)", borderColor: isDark ? "rgba(16,185,129,0.2)" : "rgba(16,185,129,0.15)" }]}>
                    <Feather name="check-circle" size={13} color="#10B981" />
                    <ThemedText style={{ fontSize: 12, color: "#10B981", marginLeft: 6 }}>{actionDetail}</ThemedText>
                  </View>
                )}
              </ScrollView>

              {/* Attached Image Preview */}
              {attachedImage && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderTopWidth: 1,
                    borderTopColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
                    backgroundColor: isDark ? "rgba(10,10,20,0.98)" : "rgba(255,255,255,0.99)",
                  }}
                >
                  <View style={{ position: "relative" }}>
                    <Animated.Image
                      source={{ uri: `data:image/jpeg;base64,${attachedImage}` }}
                      style={{ width: 50, height: 50, borderRadius: 8, borderWidth: 1, borderColor: theme.border }}
                    />
                    <Pressable
                      onPress={() => setAttachedImage(null)}
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        backgroundColor: "#EF4444",
                        borderRadius: 10,
                        width: 18,
                        height: 18,
                        justifyContent: "center",
                        alignItems: "center",
                        elevation: 2,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.2,
                        shadowRadius: 1,
                      }}
                    >
                      <Feather name="x" size={10} color="#FFF" />
                    </Pressable>
                  </View>
                  <ThemedText style={{ fontSize: 11, color: theme.textSecondary, marginLeft: 12 }}>
                    Image attached (Ready to analyze)
                  </ThemedText>
                </View>
              )}

              {/* ── INPUT BAR ── */}
              <View style={[styles.inputBar, {
                borderTopColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
                backgroundColor: isDark ? "rgba(10,10,20,0.98)" : "rgba(255,255,255,0.99)",
              }]}>
                {/* Attach */}
                <Pressable
                  style={[styles.inputIconBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" }]}
                  onPress={() => setAttachMenuOpen(!attachMenuOpen)}
                >
                  <Feather name={attachMenuOpen ? "x" : "paperclip"} size={18} color={theme.textSecondary} />
                </Pressable>

                {/* Attach menu */}
                {attachMenuOpen && (
                  <Animated.View
                    entering={FadeIn.duration(180)}
                    style={[styles.attachMenu, { backgroundColor: isDark ? "rgba(20,20,30,0.97)" : "rgba(255,255,255,0.98)", borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }]}
                  >
                    {([
                      { icon: "camera" as const, label: "Camera" },
                      { icon: "image" as const, label: "Image" },
                      { icon: "file" as const, label: "Document" },
                      { icon: "user" as const, label: "Worker" },
                      { icon: "map-pin" as const, label: "Site" },
                    ]).map((item) => (
                      <Pressable
                        key={item.label}
                        style={styles.attachItem}
                        onPress={() => handlePickAttachment(item.label)}
                      >
                        <View style={[styles.attachItemIcon, { backgroundColor: "rgba(249,115,22,0.1)" }]}>
                          <Feather name={item.icon} size={16} color="#F97316" />
                        </View>
                        <ThemedText style={{ fontSize: 11, marginTop: 4 }}>{item.label}</ThemedText>
                      </Pressable>
                    ))}
                  </Animated.View>
                )}

                {/* Text */}
                <TextInput
                  ref={chatInputRef}
                  style={[styles.chatInput, { color: theme.text, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]}
                  placeholder="Ask anything about your site…"
                  placeholderTextColor={theme.textSecondary}
                  value={chatInput}
                  onChangeText={setChatInput}
                  multiline
                  maxLength={500}
                  onSubmitEditing={() => { if (chatInput.trim()) submitChatText(chatInput); }}
                  blurOnSubmit={false}
                />

                {/* Send Button */}
                {(chatInput.trim().length > 0 || attachedImage !== null) && (
                  <Pressable style={[styles.inputIconBtn, { backgroundColor: theme.primary }]} onPress={() => submitChatText(chatInput)}>
                    <Feather name="send" size={18} color="#FFF" />
                  </Pressable>
                )}
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* ── LAUNCHER SHEET ────────────────────────────────────────────────── */}
      {mode === "launcher" && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Pressable style={styles.launcherBackdrop} onPress={closeAssistant} />
          <Animated.View
            entering={SlideInDown.springify().mass(0.7).damping(18).stiffness(180)}
            exiting={SlideOutDown.duration(220)}
            style={[
              styles.launcherSheet,
              {
                backgroundColor: isDark ? "rgba(15, 23, 42, 0.98)" : "rgba(255, 255, 255, 0.99)",
                borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
              },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.12)" }]} />
            
            <View style={styles.launcherHeaderRow}>
              <LinearGradient colors={["#F97316", "#FB923C"]} style={styles.launcherHeaderIcon}>
                <Ionicons name="sparkles" size={18} color="#FFF" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.launcherTitle}>Ask HAI Live</ThemedText>
                <ThemedText style={[styles.launcherSubtitle, { color: theme.textSecondary }]}>
                  Select a tool to manage your site
                </ThemedText>
              </View>
              <Pressable
                style={[styles.chatCloseBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}
                onPress={closeAssistant}
              >
                <Feather name="x" size={18} color={theme.textSecondary} />
              </Pressable>
            </View>

            {LAUNCHER_CARDS.map((card) => {
              const bgOverride = isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0,0,0,0.02)";
              return (
                <Pressable
                  key={card.id}
                  style={({ pressed }) => [
                    styles.launcherCard,
                    {
                      backgroundColor: pressed ? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)") : bgOverride,
                      borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
                    }
                  ]}
                  onPress={async () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    if (card.id === "voice") {
                      await startVoiceMode();
                    } else if (card.id === "chat") {
                      startChatMode();
                    } else if (card.id === "live") {
                      await startLiveMode();
                    } else if (card.id === "summary") {
                      setMode("none");
                      await executeAction("SHOW_SUMMARY", {});
                    } else if (card.id === "add_worker") {
                      setMode("none");
                      await executeAction("OPEN_SCREEN", { screen: "Workers" });
                    }
                  }}
                >
                  <View style={[styles.launcherCardIcon, { backgroundColor: card.bg }]}>
                    <Feather name={card.icon} size={20} color={card.color} />
                  </View>
                  <View style={styles.launcherCardText}>
                    <ThemedText style={styles.launcherCardTitle}>{card.title}</ThemedText>
                    <ThemedText style={[styles.launcherCardSub, { color: theme.textSecondary }]}>
                      {card.subtitle}
                    </ThemedText>
                  </View>
                  <Feather name="chevron-right" size={16} color={theme.textSecondary} />
                </Pressable>
              );
            })}
          </Animated.View>
        </View>
      )}

      {/* ── VOICE COMMAND SHEET ───────────────────────────────────────────── */}
      {mode === "voice" && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Pressable style={styles.launcherBackdrop} onPress={closeAssistant} />
          <Animated.View
            entering={SlideInDown.springify().mass(0.7).damping(18).stiffness(180)}
            exiting={SlideOutDown.duration(220)}
            style={[
              styles.voiceSheet,
              {
                backgroundColor: isDark ? "rgba(15, 23, 42, 0.98)" : "rgba(255, 255, 255, 0.99)",
                borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
              },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.12)" }]} />
            
            <ThemedText style={[styles.voiceLabel, { color: theme.primary }]}>
              {isProcessing ? "Processing command…" : isRecording ? "Listening…" : "Voice Command"}
            </ThemedText>

            {/* Waveform bars */}
            <View style={styles.voiceWaveRow}>
              <Animated.View style={[styles.voiceBar, { backgroundColor: theme.primary }, animatedWave1]} />
              <Animated.View style={[styles.voiceBar, { backgroundColor: theme.primary }, animatedWave2]} />
              <Animated.View style={[styles.voiceBar, { backgroundColor: theme.primary }, animatedWave3]} />
              <Animated.View style={[styles.voiceBar, { backgroundColor: theme.primary }, animatedWave4]} />
              <Animated.View style={[styles.voiceBar, { backgroundColor: theme.primary }, animatedWave5]} />
            </View>

            {/* Preview text */}
            <View style={[styles.previewBox, { backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}>
              <ThemedText style={[styles.previewInput, { color: theme.text }]} numberOfLines={3}>
                {voiceTranscriptPreview || transcript || "Speak your command clearly (e.g. 'Add worker Rahul')"}
              </ThemedText>
            </View>

            {/* Controls */}
            <View style={styles.voiceControls}>
              <Pressable
                style={[styles.voiceCtrlBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}
                onPress={closeAssistant}
              >
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>

              <Pressable
                style={[
                  styles.voiceRecordBtn,
                  {
                    backgroundColor: isRecording ? "#EF4444" : theme.primary,
                  }
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (isRecording) {
                    stopRecording();
                  } else {
                    startRecording();
                  }
                }}
              >
                <Feather name={isRecording ? "square" : "mic"} size={26} color="#FFF" />
              </Pressable>

              <Pressable
                style={[styles.voiceCtrlBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  startChatMode();
                }}
              >
                <Feather name="message-square" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ThemedText style={[styles.voiceHint, { color: theme.textSecondary }]}>
              Support for English, Hindi, Hinglish, Marathi, and regional languages.
            </ThemedText>
          </Animated.View>
        </View>
      )}

      {/* ── LIVE COPILOT PANEL ────────────────────────────────────────────── */}
      {mode === "live" && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Animated.View
            entering={SlideInDown.springify().mass(0.7).damping(18).stiffness(180)}
            exiting={SlideOutDown.duration(220)}
            style={[
              styles.livePanel,
              {
                backgroundColor: isDark ? "rgba(15, 23, 42, 0.98)" : "rgba(255, 255, 255, 0.99)",
                borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
              },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.12)" }]} />

            <Pressable
              style={[styles.liveCloseBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}
              onPress={stopLiveMode}
            >
              <Feather name="x" size={14} color={theme.textSecondary} />
            </Pressable>

            {/* Status indicator row */}
            <View style={styles.liveStatusRow}>
              <View
                style={[
                  styles.liveStatusDot,
                  {
                    backgroundColor: isProcessing ? "#8B5CF6" : isRecording ? "#22C55E" : theme.textSecondary,
                  }
                ]}
              />
              <ThemedText style={[styles.liveStatusText, { color: isProcessing ? "#8B5CF6" : isRecording ? "#22C55E" : theme.textSecondary }]}>
                {isProcessing ? "Thinking" : isRecording ? "Listening" : "Connected"}
              </ThemedText>
            </View>

            {/* Waveform bars */}
            <View style={styles.liveWaveRow}>
              <Animated.View style={[styles.liveBar, { backgroundColor: isProcessing ? "#8B5CF6" : theme.primary }, animatedWave1]} />
              <Animated.View style={[styles.liveBar, { backgroundColor: isProcessing ? "#8B5CF6" : theme.primary }, animatedWave2]} />
              <Animated.View style={[styles.liveBar, { backgroundColor: isProcessing ? "#8B5CF6" : theme.primary }, animatedWave3]} />
              <Animated.View style={[styles.liveBar, { backgroundColor: isProcessing ? "#8B5CF6" : theme.primary }, animatedWave4]} />
              <Animated.View style={[styles.liveBar, { backgroundColor: isProcessing ? "#8B5CF6" : theme.primary }, animatedWave5]} />
            </View>

            {/* Dialogue text box */}
            <View style={styles.liveDialogue}>
              {transcript ? (
                <ThemedText style={[styles.liveTranscriptText, { color: theme.text }]}>
                  "{transcript}"
                </ThemedText>
              ) : null}
              {aiResponse ? (
                <ThemedText style={[styles.liveAiText, { color: theme.textSecondary }]}>
                  {aiResponse}
                </ThemedText>
              ) : null}
            </View>

            {/* Mic trigger and text input back-up */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, width: "100%", paddingHorizontal: Spacing.sm }}>
              <Pressable
                style={[
                  styles.liveMicBtn,
                  {
                    backgroundColor: isRecording ? "#EF4444" : theme.primary,
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    marginBottom: 0,
                  }
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (isRecording) {
                    stopLiveMode();
                  } else {
                    startLiveMode();
                  }
                }}
              >
                <Feather name={isRecording ? "square" : "mic"} size={16} color="#FFF" />
              </Pressable>

              <View style={[styles.liveInputRow, { flex: 1, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)", backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }]}>
                <TextInput
                  placeholder="Type command…"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.liveTextInput, { color: theme.text }]}
                  value={liveTextCommand}
                  onChangeText={setLiveTextCommand}
                  onSubmitEditing={() => {
                    if (liveTextCommand.trim()) {
                      handleTextCommand(liveTextCommand);
                      setLiveTextCommand("");
                    }
                  }}
                />
                <Pressable
                  style={[styles.liveSendBtn, { backgroundColor: theme.primary }]}
                  onPress={() => {
                    if (liveTextCommand.trim()) {
                      handleTextCommand(liveTextCommand);
                      setLiveTextCommand("");
                    }
                  }}
                >
                  <Feather name="arrow-up" size={14} color="#FFF" />
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </View>
      )}
    </>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Toast
  toastContainer: {
    position: "absolute",
    top: 52,
    left: 20,
    right: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10010,
    ...Shadows.lg,
  },
  toastText: {
    color: "#FFF",
    marginLeft: 10,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },

  // FAB
  fab: {
    position: "absolute",
    bottom: 90,
    right: 20,
    width: 60,
    height: 60,
    zIndex: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  fabGlowRing: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F97316",
    zIndex: -1,
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    ...Shadows.lg,
  },

  // Shared handle
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },

  // Shared backdrops
  launcherBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.48)",
    zIndex: 9997,
  },
  darkBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    zIndex: 9997,
  },

  // Launcher sheet
  launcherSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    borderTopWidth: 1,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: Spacing.lg,
    zIndex: 9998,
    ...Shadows.lg,
  },
  launcherHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    gap: 10,
  },
  launcherHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  launcherTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  launcherSubtitle: {
    fontSize: 12,
  },
  launcherCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: 7,
    minHeight: 62,
  },
  launcherCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  launcherCardText: { flex: 1 },
  launcherCardTitle: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  launcherCardSub: { fontSize: 12 },

  // Voice sheet
  voiceSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    borderTopWidth: 1,
    paddingTop: 12,
    paddingBottom: 44,
    paddingHorizontal: Spacing.xl,
    zIndex: 9998,
    alignItems: "center",
    ...Shadows.lg,
  },
  voiceLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 24,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  voiceWaveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 64,
    gap: 6,
    marginBottom: 24,
  },
  voiceBar: {
    width: 6,
    height: 28,
    borderRadius: 3,
  },
  previewBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "100%",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: 20,
  },
  previewInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    maxHeight: 80,
  },
  voiceControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    marginBottom: 18,
  },
  voiceCtrlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  voiceCtrlBtnPlaceholder: {
    width: 52,
    height: 52,
  },
  voiceRecordBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: "center",
    alignItems: "center",
    ...Shadows.lg,
  },
  voiceHint: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 20,
  },

  // Live panel
  livePanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    borderTopWidth: 1,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    zIndex: 9998,
    ...Shadows.lg,
  },
  liveCloseBtn: {
    position: "absolute",
    top: 20,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmBox: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  confirmBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  liveStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  liveStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  liveStatusText: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  liveWaveRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    gap: 5,
    marginBottom: 8,
  },
  liveBar: {
    width: 5,
    height: 20,
    borderRadius: 2.5,
  },
  liveDialogue: {
    width: "100%",
    minHeight: 52,
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  liveTranscriptText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 6,
  },
  liveAiText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    opacity: 0.85,
  },
  liveMicBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
    ...Shadows.lg,
  },
  liveInputRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  liveTextInput: {
    flex: 1,
    fontSize: 13,
    paddingHorizontal: Spacing.xs,
  },
  liveSendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },

  // Chat
  chatKAV: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9998,
    justifyContent: "flex-end",
  },
  chatPanel: {
    height: SCREEN_HEIGHT * 0.86,
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    borderTopWidth: 1,
    overflow: "hidden",
    ...Shadows.lg,
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.15)",
  },
  chatHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  chatAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  chatHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  chatHeaderSub: {
    fontSize: 11,
  },
  chatCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  contextBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  contextBannerText: {
    fontSize: 11,
    fontWeight: "600",
  },
  chatScroll: {
    flex: 1,
  },
  chatScrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingBottom: 8,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
    paddingHorizontal: Spacing.xl,
  },
  emptyAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: 8,
  },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 8,
  },
  bubbleRowUser: {
    justifyContent: "flex-end",
  },
  bubbleRowAI: {
    justifyContent: "flex-start",
  },
  bubbleAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
    marginBottom: 2,
  },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  typingDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    opacity: 0.7,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 8,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingBottom: Platform.OS === "ios" ? 28 : Spacing.md,
    borderTopWidth: 1,
    gap: 8,
    position: "relative",
  },
  inputIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  chatInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 15,
    lineHeight: 20,
  },
  attachMenu: {
    position: "absolute",
    bottom: 68,
    left: 16,
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.md,
    zIndex: 1,
    ...Shadows.lg,
  },
  attachItem: {
    alignItems: "center",
    minWidth: 44,
  },
  attachItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
});
