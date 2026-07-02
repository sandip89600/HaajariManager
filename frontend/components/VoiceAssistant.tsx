import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Dimensions,
  ScrollView,
} from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
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
import {
  storage,
  API_URL,
  Worker,
  AttendanceRecord,
  PaymentRecord,
} from "@/utils/storage";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { navigationRef } from "@/navigation/navigationRef";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ChatMessage {
  role: "user" | "model";
  text: string;
}

type CopilotMode = "none" | "voice" | "chat" | "live";

export default function VoiceAssistant() {
  const { theme, isDark } = useTheme();

  // Mode Selection State
  const [mode, setMode] = useState<CopilotMode>("none");
  const [isExpanded, setIsExpanded] = useState(false);

  // Core Processing States
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [executedAction, setExecutedAction] = useState<string | null>(null);
  const [actionDetail, setActionDetail] = useState<string | null>(null);

  // Toast System State
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Refs for audio and timing loops
  const recordingRef = useRef<Audio.Recording | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const liveActiveRef = useRef(false);
  const liveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const voiceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Waveform shared values
  const pulse1 = useSharedValue(1);
  const pulse2 = useSharedValue(1);
  const pulse3 = useSharedValue(1);
  const pulse4 = useSharedValue(1);
  const pulse5 = useSharedValue(1);

  const buttonScale = useSharedValue(1);
  const pulseRingScale = useSharedValue(1);
  const pulseRingOpacity = useSharedValue(0.6);
  const menuAnimation = useSharedValue(0);

  // Synchronize waveforms
  useEffect(() => {
    if (isRecording) {
      pulse1.value = withRepeat(
        withSequence(
          withTiming(2.5, { duration: 300 }),
          withTiming(1, { duration: 300 }),
        ),
        -1,
        true,
      );
      pulse2.value = withRepeat(
        withSequence(
          withTiming(1.8, { duration: 250 }),
          withTiming(1, { duration: 250 }),
        ),
        -1,
        true,
      );
      pulse3.value = withRepeat(
        withSequence(
          withTiming(3.0, { duration: 350 }),
          withTiming(1, { duration: 350 }),
        ),
        -1,
        true,
      );
      pulse4.value = withRepeat(
        withSequence(
          withTiming(2.0, { duration: 280 }),
          withTiming(1, { duration: 280 }),
        ),
        -1,
        true,
      );
      pulse5.value = withRepeat(
        withSequence(
          withTiming(1.5, { duration: 200 }),
          withTiming(1, { duration: 200 }),
        ),
        -1,
        true,
      );
    } else {
      pulse1.value = withTiming(1);
      pulse2.value = withTiming(1);
      pulse3.value = withTiming(1);
      pulse4.value = withTiming(1);
      pulse5.value = withTiming(1);
    }
  }, [isRecording, pulse1, pulse2, pulse3, pulse4, pulse5]);

  const animatedWave1 = useAnimatedStyle(() => ({
    transform: [{ scaleY: pulse1.value }],
  }));
  const animatedWave2 = useAnimatedStyle(() => ({
    transform: [{ scaleY: pulse2.value }],
  }));
  const animatedWave3 = useAnimatedStyle(() => ({
    transform: [{ scaleY: pulse3.value }],
  }));
  const animatedWave4 = useAnimatedStyle(() => ({
    transform: [{ scaleY: pulse4.value }],
  }));
  const animatedWave5 = useAnimatedStyle(() => ({
    transform: [{ scaleY: pulse5.value }],
  }));

  const animatedButton = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  // Idle pulse ring animations for premium AI look
  useEffect(() => {
    pulseRingScale.value = withRepeat(
      withTiming(1.35, { duration: 2500 }),
      -1,
      false,
    );
    pulseRingOpacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 2500 }),
        withTiming(0.6, { duration: 0 }),
      ),
      -1,
      false,
    );
  }, [pulseRingOpacity, pulseRingScale]);

  // Sync menu animation shared value
  useEffect(() => {
    menuAnimation.value = withSpring(isExpanded ? 1 : 0, { damping: 15 });
  }, [isExpanded, menuAnimation]);

  const animatedRing = useAnimatedStyle(() => ({
    transform: [{ scale: pulseRingScale.value }],
    opacity: pulseRingOpacity.value,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    width: withSpring(isExpanded ? 260 : 60, { damping: 15 }),
  }));

  const voiceStyle = useAnimatedStyle(() => ({
    opacity: menuAnimation.value,
    pointerEvents: isExpanded ? "auto" : "none",
    transform: [{ translateX: menuAnimation.value * -65 }],
  }));

  const chatStyle = useAnimatedStyle(() => ({
    opacity: menuAnimation.value,
    pointerEvents: isExpanded ? "auto" : "none",
    transform: [{ translateX: menuAnimation.value * -125 }],
  }));

  const liveStyle = useAnimatedStyle(() => ({
    opacity: menuAnimation.value,
    pointerEvents: isExpanded ? "auto" : "none",
    transform: [{ translateX: menuAnimation.value * -185 }],
  }));

  // Toast Timer Hook
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Clean up Live loop on unmount
  useEffect(() => {
    return () => {
      liveActiveRef.current = false;
      if (liveTimeoutRef.current) clearTimeout(liveTimeoutRef.current);
      if (voiceTimeoutRef.current) clearTimeout(voiceTimeoutRef.current);
    };
  }, []);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "success",
  ) => {
    setToast({ message, type });
  };

  // Toggle Menu
  const toggleMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsExpanded(!isExpanded);
  };

  // 1. VOICE MODE SETUP
  const startVoiceMode = async () => {
    Speech.stop();
    setTranscript("");
    setExecutedAction(null);
    setActionDetail(null);
    setMode("voice");
    setIsExpanded(false);

    // Auto start recording for quick command
    setTimeout(startRecording, 100);
  };

  // 2. CHAT MODE SETUP
  const startChatMode = () => {
    Speech.stop();
    setTranscript("");
    setExecutedAction(null);
    setActionDetail(null);
    setMode("chat");
    setIsExpanded(false);

    if (chatHistory.length === 0) {
      setAiResponse(
        "Hi! I'm HAI, your AI-powered workforce assistant. I can help you manage workers, attendance, payments, advances, reports, and navigate the app using voice, chat, or live assistance.",
      );
    }
  };

  // 3. LIVE COPILOT MODE SETUP
  const startLiveMode = async () => {
    Speech.stop();
    setIsExpanded(false);
    liveActiveRef.current = true;
    setMode("live");
    showToast("Live Copilot Mode Activated ⚡", "info");

    runLiveLoop();
  };

  const stopLiveMode = async () => {
    liveActiveRef.current = false;
    if (liveTimeoutRef.current) {
      clearTimeout(liveTimeoutRef.current);
      liveTimeoutRef.current = null;
    }

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {}
      recordingRef.current = null;
    }

    setIsRecording(false);
    setIsProcessing(false);
    setMode("none");
    showToast("Live Copilot Deactivated", "info");
  };

  // Live Copilot continuous listening loop
  const runLiveLoop = async () => {
    if (!liveActiveRef.current) return;

    try {
      setIsRecording(true);
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recordingOptions = {
        android: {
          extension: ".m4a",
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: ".m4a",
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: "audio/webm",
          bitsPerSecond: 128000,
        },
      };

      const { recording } = await Audio.Recording.createAsync(recordingOptions);
      recordingRef.current = recording;

      // Record in 4.5 second listening slots
      liveTimeoutRef.current = setTimeout(async () => {
        if (!liveActiveRef.current) return;

        try {
          setIsRecording(false);
          setIsProcessing(true);

          await recording.stopAndUnloadAsync();
          const uri = recording.getURI();
          recordingRef.current = null;

          if (uri && liveActiveRef.current) {
            const base64Audio = await FileSystem.readAsStringAsync(uri, {
              encoding: "base64",
            });
            await processLiveAudio(base64Audio);
          }
        } catch (e) {
          console.error("Live loop stop recording failed:", e);
        } finally {
          setIsProcessing(false);
          if (liveActiveRef.current) {
            runLiveLoop();
          }
        }
      }, 4500);
    } catch (err) {
      console.error("Failed to run live loop:", err);
      showToast("Microphone error in Live Mode", "error");
      stopLiveMode();
    }
  };

  const processLiveAudio = async (base64Audio: string) => {
    try {
      const auth = await storage.getAuth();
      const token = auth?.token;

      const response = await fetch(`${API_URL}/voice/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          audio: base64Audio,
          mimeType: Platform.OS === "ios" ? "audio/x-m4a" : "audio/mp4",
          history: [],
        }),
      });

      if (response.ok) {
        const result = await response.json();

        if (
          result.transcript &&
          result.action &&
          result.action !== "UNKNOWN" &&
          result.action !== "INCOMPLETE"
        ) {
          if (result.response) {
            speakResponse(result.response);
          }
          await executeAction(result.action, result.data);
          showToast(`Executed: ${result.action}`, "success");
        }
      }
    } catch (err) {
      console.error("Live audio processing failed:", err);
    }
  };

  // Audio Recording Flow
  const startRecording = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recordingOptions = {
        android: {
          extension: ".m4a",
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: ".m4a",
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: "audio/webm",
          bitsPerSecond: 128000,
        },
      };

      const { recording } = await Audio.Recording.createAsync(recordingOptions);
      recordingRef.current = recording;
      setIsRecording(true);
      setTranscript("HAI is listening...");
      Speech.stop();

      // Auto-stop recording after 5.5 seconds in Voice Mode to allow execution without manual interaction
      if (mode === "voice") {
        voiceTimeoutRef.current = setTimeout(() => {
          stopRecording();
        }, 5500);
      }
    } catch (err) {
      console.error("Failed to start recording", err);
      setTranscript("Microphone permission required.");
    }
  };

  const stopRecording = async () => {
    if (voiceTimeoutRef.current) {
      clearTimeout(voiceTimeoutRef.current);
      voiceTimeoutRef.current = null;
    }
    if (!recordingRef.current) return;
    setIsRecording(false);
    setIsProcessing(true);
    setTranscript("HAI is thinking...");

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (uri) {
        const base64Audio = await FileSystem.readAsStringAsync(uri, {
          encoding: "base64",
        });
        await processAudio(base64Audio);
      }
    } catch (err) {
      console.error("Failed to stop recording", err);
      setTranscript("Recording failed. Please try again.");
      setIsProcessing(false);
    }
  };

  const processAudio = async (base64Audio: string) => {
    try {
      const auth = await storage.getAuth();
      const token = auth?.token;

      const response = await fetch(`${API_URL}/voice/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          audio: base64Audio,
          mimeType: Platform.OS === "ios" ? "audio/x-m4a" : "audio/mp4",
          history:
            mode === "chat"
              ? chatHistory.map((ch) => ({
                  role: ch.role,
                  parts: [{ text: ch.text }],
                }))
              : [],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Voice] Backend error response:", errorText);
        throw new Error(`Voice processing server error: ${errorText}`);
      }

      const result = await response.json();

      if (result.transcript) {
        setTranscript(result.transcript);

        if (mode === "chat") {
          const newHistory = [
            ...chatHistory,
            { role: "user" as const, text: result.transcript },
          ];

          if (result.response) {
            setAiResponse(result.response);
            newHistory.push({ role: "model" as const, text: result.response });
            setChatHistory(newHistory);
            speakResponse(result.response);
          }

          if (
            result.action &&
            result.action !== "INCOMPLETE" &&
            result.action !== "UNKNOWN"
          ) {
            await executeAction(result.action, result.data);
          } else {
            setExecutedAction(null);
            setActionDetail(null);
          }
        } else if (mode === "voice") {
          // Voice Mode executes immediately with no chat logs
          if (result.response) {
            speakResponse(result.response);
          }

          if (
            result.action &&
            result.action !== "INCOMPLETE" &&
            result.action !== "UNKNOWN"
          ) {
            await executeAction(result.action, result.data);
            showToast(`Command Executed: ${result.action}`, "success");
          } else if (result.action === "INCOMPLETE") {
            showToast(result.response || "Details incomplete.", "info");
          } else {
            showToast("Command not understood.", "error");
          }

          // Auto close voice mode pill after 2.5s
          setTimeout(() => {
            setMode("none");
          }, 2500);
        }
      }
    } catch (err) {
      console.error("Error processing audio on backend", err);
      const errMsg =
        "Sorry, I couldn't understand your request. Please try again.";
      setTranscript(errMsg);
      setAiResponse(errMsg);
      speakResponse(errMsg);
      showToast("Voice parsing failed.", "error");

      if (mode === "voice") {
        setTimeout(() => setMode("none"), 2500);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const speakResponse = (text: string) => {
    const isHindi =
      /[\u0900-\u097F]/.test(text) ||
      text.toLowerCase().includes("kijiye") ||
      text.toLowerCase().includes("karo") ||
      text.toLowerCase().includes("hai");
    Speech.speak(text, {
      language: isHindi ? "hi-IN" : "en-IN",
      pitch: 1.0,
      rate: 1.0,
    });
  };

  // Helper: Fuzzy match worker name
  const fuzzyMatchWorker = (workers: Worker[], name: string): Worker | null => {
    if (!name) return null;
    const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const target = clean(name);

    let match = workers.find((w) => clean(w.name) === target);
    if (match) return match;

    match = workers.find(
      (w) => clean(w.name).includes(target) || target.includes(clean(w.name)),
    );
    return match || null;
  };

  const executeAction = async (action: string, data: any) => {
    try {
      const workers = await storage.getWorkers();
      let worker: Worker | null = null;

      if (data.name) {
        worker = fuzzyMatchWorker(workers, data.name);
        if (!worker && action !== "ADD_WORKER") {
          const errText = "Worker not found.";
          setAiResponse(errText);
          speakResponse(errText);
          setExecutedAction("ERROR");
          setActionDetail(`Worker "${data.name}" not found in database.`);
          return;
        }
      }

      switch (action) {
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
          setActionDetail(
            `Worker: ${data.name} (Daily Rate: ₹${data.dailyRate || 500})`,
          );
          break;
        }
        case "UPDATE_WORKER": {
          if (worker) {
            const updated = {
              ...worker,
              dailyRate:
                data.dailyRate !== undefined
                  ? data.dailyRate
                  : worker.dailyRate,
              category: data.category || worker.category,
              phone: data.phone || worker.phone,
            };
            await storage.updateWorker(updated);
            setExecutedAction("UPDATE_WORKER");
            setActionDetail(
              `Updated: ${worker.name} (Daily Rate: ₹${updated.dailyRate})`,
            );
          }
          break;
        }
        case "DELETE_WORKER": {
          if (worker) {
            await storage.deleteWorker(worker.id);
            setExecutedAction("DELETE_WORKER");
            setActionDetail(`Deleted Worker: ${worker.name}`);
          }
          break;
        }
        case "MARK_ATTENDANCE": {
          if (worker) {
            const dateObj = data.date ? new Date(data.date) : new Date();

            let val: AttendanceRecord["value"] = "P";
            if (data.status === "Absent") val = "A";
            else if (data.status === "Half Day") val = "H";
            else if (data.status === "Overtime") val = "OT";

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

            let details = `Attendance: ${worker.name} — ${data.status}`;
            if (data.advance) details += ` (Advance: ₹${data.advance})`;
            if (data.overtimeHours)
              details += ` (OT Hours: ${data.overtimeHours})`;

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
            setActionDetail(
              `Payment Paid: ${worker.name} — ₹${data.amount} (${payment.method})`,
            );
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
            setActionDetail(
              `Advance Recorded: ${worker.name} — ₹${data.amount}`,
            );
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
            setActionDetail(`Searching workers for: "${data.query}"`);
          }
          break;
        }
        case "OPEN_SCREEN": {
          if (navigationRef.isReady()) {
            const target = data.screen;
            let navTarget = "MainTabs";
            let subScreen = "AttendanceTab";

            if (target === "Workers") subScreen = "WorkersTab";
            else if (target === "Attendance") subScreen = "AttendanceTab";
            else if (target === "Summary") subScreen = "SummaryTab";
            else if (target === "Settings") subScreen = "SettingsTab";

            if (target === "Dashboard") {
              navigationRef.navigate("AdminDashboard");
            } else {
              navigationRef.navigate(navTarget, { screen: subScreen });
            }

            setExecutedAction("OPEN_SCREEN");
            setActionDetail(`Navigated to: ${target}`);
          }
          break;
        }
        case "SHOW_SUMMARY": {
          if (navigationRef.isReady()) {
            navigationRef.navigate("MainTabs", { screen: "SummaryTab" });
            setExecutedAction("SHOW_SUMMARY");
            setActionDetail("Opened Payment Summary Screen");
          }
          break;
        }
        case "SHOW_REPORT": {
          if (navigationRef.isReady()) {
            navigationRef.navigate("MainTabs", { screen: "SummaryTab" });
            setExecutedAction("SHOW_REPORT");
            setActionDetail("Opened Reports Screen");
          }
          break;
        }
        default:
          break;
      }
    } catch (err) {
      console.error("Action execution error:", err);
      setExecutedAction("ERROR");
      setActionDetail("Execution failed. Please check local database state.");
    }
  };

  const closeAssistant = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMode("none");
    if (voiceTimeoutRef.current) {
      clearTimeout(voiceTimeoutRef.current);
      voiceTimeoutRef.current = null;
    }
    if (recordingRef.current) {
      try {
        recordingRef.current.stopAndUnloadAsync();
      } catch {}
      recordingRef.current = null;
    }
    setIsRecording(false);
    setIsProcessing(false);
    Speech.stop();
  };

  useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatHistory, aiResponse]);

  return (
    <>
      {/* Dynamic Top-level Toast Notification system */}
      {toast && (
        <Animated.View
          entering={SlideInDown.duration(300)}
          exiting={FadeOut.duration(200)}
          style={[
            styles.toastContainer,
            {
              backgroundColor:
                toast.type === "success"
                  ? "rgba(16, 185, 129, 0.95)"
                  : toast.type === "error"
                    ? "rgba(239, 68, 68, 0.95)"
                    : "rgba(59, 130, 246, 0.95)",
            },
          ]}
        >
          <Feather
            name={
              toast.type === "success"
                ? "check-circle"
                : toast.type === "error"
                  ? "alert-circle"
                  : "info"
            }
            size={18}
            color="#FFFFFF"
          />
          <ThemedText style={styles.toastText}>{toast.message}</ThemedText>
        </Animated.View>
      )}

      {/* Floating AI Button & Expandable Fan Menu */}
      {mode === "none" && (
        <Animated.View style={[styles.floatingButtonContainer, containerStyle]}>
          {/* Main Button */}
          <Pressable
            onPress={toggleMenu}
            onPressIn={() => {
              buttonScale.value = withSpring(0.9, { damping: 10 });
            }}
            onPressOut={() => {
              buttonScale.value = withSpring(1, { damping: 10 });
            }}
            style={styles.mainFloatingButtonWrapper}
          >
            {/* Pulsing ring when idle */}
            {!isExpanded && (
              <Animated.View style={[styles.pulseRing, animatedRing]} />
            )}
            <Animated.View
              style={[styles.floatingButtonContent, animatedButton]}
            >
              <LinearGradient
                colors={["#FF6B35", "#FF8C35"]}
                style={styles.floatingButton}
              >
                <Feather
                  name={isExpanded ? "x" : "cpu"}
                  size={26}
                  color="#FFFFFF"
                />
              </LinearGradient>
            </Animated.View>
          </Pressable>

          {/* Fan Button 1: 🎙 Voice */}
          <Animated.View style={[styles.fanButtonWrapper, voiceStyle]}>
            <Pressable onPress={startVoiceMode}>
              <LinearGradient
                colors={["#FF6B35", "#FF8C35"]}
                style={styles.fanButton}
              >
                <Feather name="mic" size={20} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
            <ThemedText type="small" style={styles.fanLabel}>
              HAI Voice
            </ThemedText>
          </Animated.View>

          {/* Fan Button 2: 💬 Chat */}
          <Animated.View style={[styles.fanButtonWrapper, chatStyle]}>
            <Pressable onPress={startChatMode}>
              <LinearGradient
                colors={["#3B82F6", "#4F46E5"]}
                style={styles.fanButton}
              >
                <Feather name="message-square" size={20} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
            <ThemedText type="small" style={styles.fanLabel}>
              HAI Chat
            </ThemedText>
          </Animated.View>

          {/* Fan Button 3: ⚡ Live */}
          <Animated.View style={[styles.fanButtonWrapper, liveStyle]}>
            <Pressable onPress={startLiveMode}>
              <LinearGradient
                colors={["#F59E0B", "#D97706"]}
                style={styles.fanButton}
              >
                <Feather name="zap" size={20} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
            <ThemedText type="small" style={styles.fanLabel}>
              HAI Live
            </ThemedText>
          </Animated.View>
        </Animated.View>
      )}

      {/* Voice Mode Floating Pill Overlay */}
      {mode === "voice" && (
        <View style={styles.voiceModeOverlay} pointerEvents="box-none">
          <BlurView
            intensity={95}
            tint={isDark ? "dark" : "light"}
            style={styles.voiceModePill}
          >
            <View style={styles.voiceModeContent}>
              <Feather
                name="mic"
                size={20}
                color="#FF6B35"
                style={{ marginRight: Spacing.sm }}
              />
              {isRecording ? (
                <>
                  <ThemedText style={styles.voiceModeStatus}>
                    HAI is listening...
                  </ThemedText>
                  <View style={styles.miniWaveform}>
                    <Animated.View
                      style={[styles.miniWaveBar, animatedWave1]}
                    />
                    <Animated.View
                      style={[styles.miniWaveBar, animatedWave2]}
                    />
                    <Animated.View
                      style={[styles.miniWaveBar, animatedWave3]}
                    />
                  </View>
                  <Pressable
                    onPress={stopRecording}
                    style={{
                      marginRight: Spacing.sm,
                      padding: 6,
                      backgroundColor: "rgba(239, 68, 68, 0.1)",
                      borderRadius: BorderRadius.sm,
                    }}
                  >
                    <Feather name="square" size={14} color="#EF4444" />
                  </Pressable>
                </>
              ) : isProcessing ? (
                <>
                  <ActivityIndicator
                    size="small"
                    color="#FF6B35"
                    style={{ marginRight: Spacing.sm }}
                  />
                  <ThemedText style={styles.voiceModeStatus}>
                    HAI is thinking...
                  </ThemedText>
                </>
              ) : (
                <ThemedText style={styles.voiceModeStatus}>
                  {transcript || "Speak command"}
                </ThemedText>
              )}

              <Pressable
                onPress={closeAssistant}
                style={styles.voiceCloseButton}
              >
                <Feather name="x" size={18} color={theme.text} />
              </Pressable>
            </View>
          </BlurView>
        </View>
      )}

      {/* Live Copilot Floating Pill Status (Continuous listening) */}
      {mode === "live" && (
        <View style={styles.liveModeOverlay} pointerEvents="box-none">
          <BlurView
            intensity={95}
            tint={isDark ? "dark" : "light"}
            style={styles.liveModePill}
          >
            <View style={styles.liveModeContent}>
              <View style={styles.liveDot} />
              <ThemedText style={styles.liveModeText}>
                {isRecording
                  ? "HAI is listening... ⚡"
                  : isProcessing
                    ? "HAI is thinking... ⚡"
                    : "HAI Live ⚡"}
              </ThemedText>
              <Pressable onPress={stopLiveMode} style={styles.liveStopBtn}>
                <Feather name="square" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          </BlurView>
        </View>
      )}

      {/* Chat Mode bottom sheet */}
      {mode === "chat" && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Pressable style={styles.backdrop} onPress={closeAssistant} />

          <Animated.View
            entering={SlideInDown.springify().damping(18)}
            exiting={SlideOutDown.duration(200)}
            style={[
              styles.assistantPanel,
              {
                backgroundColor: isDark
                  ? "rgba(15, 23, 42, 0.94)"
                  : "rgba(255, 255, 255, 0.96)",
                borderTopColor: isDark
                  ? "rgba(255, 255, 255, 0.1)"
                  : "rgba(0, 0, 0, 0.1)",
              },
            ]}
          >
            {Platform.OS === "ios" && (
              <BlurView
                intensity={95}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            )}

            <View style={styles.panelHeader}>
              <View style={styles.panelHeaderTitle}>
                <LinearGradient
                  colors={["#FF6B35", "#FF8C35"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.headerIndicator}
                />
                <ThemedText type="h3" style={{ fontWeight: "800" }}>
                  Ask HAI
                </ThemedText>
              </View>
              <Pressable onPress={closeAssistant} style={styles.closeButton}>
                <Feather name="x" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              ref={scrollViewRef}
              style={styles.chatArea}
              contentContainerStyle={{ paddingBottom: Spacing.md }}
              showsVerticalScrollIndicator={false}
            >
              {chatHistory.map((chat, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.chatBubble,
                    chat.role === "user" ? styles.userBubble : styles.aiBubble,
                    chat.role === "user"
                      ? { backgroundColor: theme.primary }
                      : {
                          backgroundColor: isDark
                            ? "rgba(255, 255, 255, 0.05)"
                            : "rgba(0, 0, 0, 0.03)",
                        },
                  ]}
                >
                  <ThemedText
                    type="body"
                    style={{
                      color: chat.role === "user" ? "#FFFFFF" : theme.text,
                    }}
                  >
                    {chat.text}
                  </ThemedText>
                </View>
              ))}

              {chatHistory.length === 0 && (
                <View style={styles.aiHomeScreen}>
                  <View style={styles.aiLogoContainer}>
                    <LinearGradient
                      colors={["#FF6B35", "#FF8C35"]}
                      style={styles.aiLogoBadge}
                    >
                      <Feather name="cpu" size={32} color="#FFFFFF" />
                    </LinearGradient>
                  </View>
                  <ThemedText type="h1" style={styles.aiHomeHeader}>
                    HAI
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={[styles.aiHomeSubtitle, { color: theme.primary }]}
                  >
                    Haajari Artificial Intelligence
                  </ThemedText>
                  <ThemedText
                    type="body"
                    style={[
                      styles.aiHomeDescription,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {
                      "Your intelligent workforce assistant for managing workers, attendance, payments, advances, reports, and app navigation."
                    }
                  </ThemedText>
                  <View style={styles.aiGreetingBox}>
                    <ThemedText
                      type="body"
                      style={{ fontWeight: "700", textAlign: "center" }}
                    >
                      {
                        "Hi! I'm HAI, your AI-powered workforce assistant. I can help you manage workers, attendance, payments, advances, reports, and navigate the app using voice, chat, or live assistance."
                      }
                    </ThemedText>
                  </View>
                </View>
              )}
            </ScrollView>

            {executedAction && (
              <Animated.View
                entering={FadeIn.duration(300)}
                exiting={FadeOut.duration(200)}
                style={[
                  styles.actionIndicatorBox,
                  {
                    backgroundColor:
                      executedAction === "ERROR"
                        ? "rgba(239, 68, 68, 0.1)"
                        : "rgba(16, 185, 129, 0.1)",
                    borderColor:
                      executedAction === "ERROR"
                        ? "rgba(239, 68, 68, 0.2)"
                        : "rgba(16, 185, 129, 0.2)",
                  },
                ]}
              >
                <Feather
                  name={
                    executedAction === "ERROR" ? "alert-circle" : "check-circle"
                  }
                  size={16}
                  color={executedAction === "ERROR" ? "#EF4444" : "#10B981"}
                />
                <View style={{ marginLeft: Spacing.sm, flex: 1 }}>
                  <ThemedText
                    type="small"
                    style={{
                      fontWeight: "700",
                      color: executedAction === "ERROR" ? "#EF4444" : "#10B981",
                    }}
                  >
                    {executedAction === "ERROR"
                      ? "Action Failed"
                      : "Action Executed"}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    {actionDetail}
                  </ThemedText>
                </View>
              </Animated.View>
            )}

            <View
              style={[
                styles.interactionArea,
                {
                  borderTopColor: isDark
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(0,0,0,0.05)",
                },
              ]}
            >
              {isRecording ? (
                <View style={styles.waveformContainer}>
                  <Animated.View
                    style={[
                      styles.waveBar,
                      { backgroundColor: "#FF6B35" },
                      animatedWave1,
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.waveBar,
                      { backgroundColor: "#FF7C35" },
                      animatedWave2,
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.waveBar,
                      { backgroundColor: "#FF8C35" },
                      animatedWave3,
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.waveBar,
                      { backgroundColor: "#FF9C35" },
                      animatedWave4,
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.waveBar,
                      { backgroundColor: "#FFAC35" },
                      animatedWave5,
                    ]}
                  />
                </View>
              ) : isProcessing ? (
                <View style={styles.waveformContainer}>
                  <ActivityIndicator size="small" color="#FF6B35" />
                </View>
              ) : (
                <View style={styles.waveformContainer}>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    {transcript || "Tap mic to speak"}
                  </ThemedText>
                </View>
              )}

              <Pressable
                onPress={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                style={styles.micButtonWrapper}
              >
                <LinearGradient
                  colors={
                    isRecording
                      ? ["#EF4444", "#FF5C5C"]
                      : ["#FF6B35", "#FF8C35"]
                  }
                  style={styles.micBtn}
                >
                  <Feather
                    name={isRecording ? "square" : "mic"}
                    size={22}
                    color="#FFFFFF"
                  />
                </LinearGradient>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  floatingButtonContainer: {
    position: "absolute",
    bottom: 90,
    right: 20,
    height: 60,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    zIndex: 9999,
  },
  mainFloatingButtonWrapper: {
    zIndex: 10002,
    width: 60,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FF6B35",
    zIndex: -1,
  },
  floatingButtonContent: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  floatingButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    ...Shadows.md,
  },
  fanButtonWrapper: {
    position: "absolute",
    alignItems: "center",
    zIndex: 10001,
  },
  fanButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    ...Shadows.md,
  },
  fanLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#888",
    marginTop: 2,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    zIndex: 9998,
  },
  assistantPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.42,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderTopWidth: 1,
    overflow: "hidden",
    zIndex: 9999,
    paddingTop: Spacing.md,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  panelHeaderTitle: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIndicator: {
    width: 4,
    height: 16,
    borderRadius: 2,
    marginRight: Spacing.xs,
  },
  closeButton: {
    padding: 6,
  },
  chatArea: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  chatBubble: {
    maxWidth: "85%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    marginVertical: 4,
  },
  userBubble: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 2,
  },
  aiBubble: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 2,
  },
  interactionArea: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: "transparent",
  },
  waveformContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    paddingRight: Spacing.sm,
  },
  waveBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
    marginHorizontal: 3,
  },
  micButtonWrapper: {
    ...Shadows.sm,
  },
  micBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  actionIndicatorBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
  },
  toastContainer: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10005,
    ...Shadows.lg,
  },
  toastText: {
    color: "#FFFFFF",
    marginLeft: Spacing.sm,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  voiceModeOverlay: {
    position: "absolute",
    bottom: 160,
    left: 20,
    right: 20,
    zIndex: 9999,
  },
  voiceModePill: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
    ...Shadows.lg,
  },
  voiceModeContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    justifyContent: "space-between",
  },
  voiceModeStatus: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  miniWaveform: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  miniWaveBar: {
    width: 3,
    height: 12,
    borderRadius: 1.5,
    marginHorizontal: 1.5,
  },
  voiceCloseButton: {
    padding: 4,
  },
  liveModeOverlay: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    zIndex: 9999,
  },
  liveModePill: {
    borderRadius: 25,
    borderWidth: 1,
    overflow: "hidden",
    ...Shadows.lg,
  },
  liveModeContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F59E0B",
    marginRight: 8,
  },
  liveModeText: {
    fontSize: 14,
    fontWeight: "700",
    marginRight: 12,
  },
  liveStopBtn: {
    backgroundColor: "#EF4444",
    padding: 6,
    borderRadius: 12,
  },
  aiHomeScreen: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    marginTop: Spacing.xl,
  },
  aiLogoContainer: {
    marginBottom: Spacing.md,
  },
  aiLogoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    ...Shadows.md,
  },
  aiHomeHeader: {
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 4,
  },
  aiHomeSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
  },
  aiHomeDescription: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  aiGreetingBox: {
    width: "100%",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(255, 107, 53, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 107, 53, 0.15)",
  },
});
