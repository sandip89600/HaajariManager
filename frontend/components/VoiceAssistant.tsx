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

export default function VoiceAssistant() {
  const { theme, isDark } = useTheme();

  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [executedAction, setExecutedAction] = useState<string | null>(null);
  const [actionDetail, setActionDetail] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Waveform shared values
  const pulse1 = useSharedValue(1);
  const pulse2 = useSharedValue(1);
  const pulse3 = useSharedValue(1);
  const pulse4 = useSharedValue(1);
  const pulse5 = useSharedValue(1);

  // Floating button entry animation
  const buttonScale = useSharedValue(1);

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

  const startAssistant = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsOpen(true);
    setTranscript("");
    setAiResponse(
      "Hello! How can I help you today? Aap voice commands de sakte hain.",
    );
    setExecutedAction(null);
    setActionDetail(null);
  };

  const closeAssistant = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsOpen(false);
    stopRecording();
    Speech.stop();
  };

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
      setTranscript("Listening...");
      Speech.stop();
    } catch (err) {
      console.error("Failed to start recording", err);
      setTranscript("Microphone permission required.");
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    setIsRecording(false);
    setIsProcessing(true);
    setTranscript("Processing voice command...");

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (uri) {
        // Read file as base64 (Google / JSON workflow style)
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
          history: chatHistory.map((ch) => ({
            role: ch.role,
            parts: [{ text: ch.text }],
          })),
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

        // Append user transcript to chat history
        const newHistory = [
          ...chatHistory,
          { role: "user" as const, text: result.transcript },
        ];

        if (result.response) {
          setAiResponse(result.response);
          newHistory.push({ role: "model" as const, text: result.response });
          setChatHistory(newHistory);

          // Speak back
          speakResponse(result.response);
        }

        // Execute action if understood
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
      }
    } catch (err) {
      console.error("Error processing audio on backend", err);
      const errMsg =
        "Sorry, I couldn't understand your request. Please try again.";
      setTranscript(errMsg);
      setAiResponse(errMsg);
      speakResponse(errMsg);
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

    // Exact Match
    let match = workers.find((w) => clean(w.name) === target);
    if (match) return match;

    // Fuzzy Match (inclusion)
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
            id: "", // generated on backend
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

            // Map status text to valid AttendanceValue
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
              finalPay: 0, // Backend calculates this
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
            // Save advance as customWage in AttendanceRecord
            const dateObj = data.date ? new Date(data.date) : new Date();

            // Try to find if there is an existing record today
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
              value: existing ? existing.value : "P", // default to Present if no record exists
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

  useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatHistory, aiResponse]);

  return (
    <>
      {/* Floating Microphone Button */}
      {!isOpen && (
        <Animated.View style={[styles.floatingButtonContainer, animatedButton]}>
          <Pressable
            onPress={startAssistant}
            onPressIn={() => {
              buttonScale.value = withSpring(0.9, { damping: 10 });
            }}
            onPressOut={() => {
              buttonScale.value = withSpring(1, { damping: 10 });
            }}
          >
            <LinearGradient
              colors={["#FF6B35", "#FF8C35"]}
              style={styles.floatingButton}
            >
              <Feather name="mic" size={26} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
        </Animated.View>
      )}

      {/* Voice Assistant Sheet */}
      {isOpen && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Backdrop */}
          <Pressable style={styles.backdrop} onPress={closeAssistant} />

          {/* Sliding Bottom Panel */}
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

            {/* Header */}
            <View style={styles.panelHeader}>
              <View style={styles.panelHeaderTitle}>
                <LinearGradient
                  colors={["#FF6B35", "#FF8C35"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.headerIndicator}
                />
                <ThemedText type="h3" style={{ fontWeight: "800" }}>
                  Haajari AI Voice
                </ThemedText>
              </View>
              <Pressable onPress={closeAssistant} style={styles.closeButton}>
                <Feather name="x" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            {/* Scrolling Chat History Area */}
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

              {/* Latest AI response if history is empty */}
              {chatHistory.length === 0 && (
                <View
                  style={[
                    styles.chatBubble,
                    styles.aiBubble,
                    {
                      backgroundColor: isDark
                        ? "rgba(255, 255, 255, 0.05)"
                        : "rgba(0, 0, 0, 0.03)",
                    },
                  ]}
                >
                  <ThemedText type="body" style={{ color: theme.text }}>
                    {aiResponse}
                  </ThemedText>
                </View>
              )}
            </ScrollView>

            {/* Action Execution Visual Indicator */}
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

            {/* Bottom Interaction Area */}
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
              {/* Voice equalizer/waveform animation */}
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

              {/* Record Button */}
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
    zIndex: 9999,
  },
  floatingButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    ...Shadows.md,
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
});
