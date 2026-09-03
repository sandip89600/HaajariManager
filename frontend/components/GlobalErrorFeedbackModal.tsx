import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { API_URL, authenticatedFetch } from "@/utils/storage";

export type FeedbackCategory =
  | "Attendance"
  | "Attendance Grid"
  | "Worker Management"
  | "Site Management"
  | "Reports"
  | "PDF"
  | "CSV"
  | "Print"
  | "GPS / Location"
  | "Notifications"
  | "Login / Authentication"
  | "Payments"
  | "Performance / Slow App"
  | "UI / Design"
  | "Network / Server"
  | "Other";

export interface ErrorReportConfig {
  title?: string;
  message?: string;
  category: FeedbackCategory;
  feature: string;
  errorType?: string;
  errorMessage?: string;
  httpStatus?: number;
  durationMs?: number;
  onRetry?: () => void;
}

export interface GlobalErrorFeedbackModalProps {
  visible: boolean;
  config: ErrorReportConfig | null;
  onClose: () => void;
}

const CATEGORIES: FeedbackCategory[] = [
  "Attendance",
  "Attendance Grid",
  "Worker Management",
  "Site Management",
  "Reports",
  "PDF",
  "CSV",
  "Print",
  "GPS / Location",
  "Notifications",
  "Login / Authentication",
  "Payments",
  "Performance / Slow App",
  "UI / Design",
  "Network / Server",
  "Other",
];

const OFFLINE_FEEDBACK_KEY = "@haajari_offline_feedback";

export function GlobalErrorFeedbackModal({
  visible,
  config,
  onClose,
}: GlobalErrorFeedbackModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [step, setStep] = useState<"alert" | "form" | "submitted">("alert");
  const [selectedCategory, setSelectedCategory] = useState<FeedbackCategory>("Other");
  const [userMessage, setUserMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  useEffect(() => {
    if (config) {
      setSelectedCategory(config.category || "Other");
      setUserMessage("");
      setStatusNotice(null);
      setStep("alert");
    }
  }, [config]);

  if (!visible || !config) return null;

  const handleOpenForm = () => {
    setStep("form");
  };

  const handleRetry = () => {
    onClose();
    if (config.onRetry) {
      config.onRetry();
    }
  };

  const handleSubmit = async () => {
    if (!userMessage.trim()) {
      setStatusNotice("Please describe what went wrong before submitting.");
      return;
    }

    setIsSubmitting(true);
    setStatusNotice(null);

    const payload = {
      category: selectedCategory,
      feature: config.feature || "General Feature",
      message: userMessage.trim(),
      errorType: config.errorType || "OPERATION_FAILED",
      errorMessage: config.errorMessage || config.message || "",
      httpStatus: config.httpStatus,
      durationMs: config.durationMs,
      platform: Platform.OS,
      appVersion: "1.0.0",
      guestName: user?.name || "Anonymous User",
      guestPhone: user?.phone || "",
    };

    try {
      const response = await authenticatedFetch(`${API_URL}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.success) {
        setStep("submitted");
      } else {
        await saveFeedbackOffline(payload);
        setStep("submitted");
      }
    } catch {
      // Network failure resilience: save locally for background sync
      await saveFeedbackOffline(payload);
      setStep("submitted");
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveFeedbackOffline = async (payload: any) => {
    try {
      const existing = await AsyncStorage.getItem(OFFLINE_FEEDBACK_KEY);
      const items = existing ? JSON.parse(existing) : [];
      items.push({ ...payload, savedAt: new Date().toISOString() });
      await AsyncStorage.setItem(OFFLINE_FEEDBACK_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("Failed to store offline feedback:", e);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.backgroundDefault || "#0F172A" }]}>
          {/* Top Bar Indicator */}
          <View style={styles.handleIndicator} />

          {step === "alert" && (
            <View style={styles.stepContent}>
              <View style={styles.iconCircle}>
                <Feather name="alert-triangle" size={32} color="#F97316" />
              </View>

              <Text style={[styles.title, { color: theme.text }]}>
                {config.title || `${config.feature} Failed`}
              </Text>

              <Text style={[styles.subtitle, { color: theme.textSecondary || "#94A3B8" }]}>
                {config.message || "Unable to complete this action right now. Tell us what went wrong so we can improve Haajari Manager."}
              </Text>

              <View style={styles.buttonRow}>
                {config.onRetry && (
                  <Pressable
                    onPress={handleRetry}
                    style={({ pressed }) => [
                      styles.retryButton,
                      { opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <Feather name="rotate-cw" size={16} color="#FFFFFF" />
                    <Text style={styles.retryButtonText}>{t.feedback?.tryAgain || "Try Again"}</Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={handleOpenForm}
                  style={({ pressed }) => [
                    styles.reportButton,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Feather name="message-square" size={16} color="#F97316" />
                  <Text style={styles.reportButtonText}>{t.feedback?.reportProblem || "Report a Problem"}</Text>
                </Pressable>
              </View>

              <Pressable onPress={onClose} style={styles.dismissButton}>
                <Text style={styles.dismissText}>{t.common?.cancel || "Dismiss"}</Text>
              </Pressable>
            </View>
          )}

          {step === "form" && (
            <ScrollView style={styles.scrollForm} showsVerticalScrollIndicator={false}>
              <View style={styles.formHeader}>
                <Text style={[styles.title, { color: theme.text }]}>{t.feedback?.title || "Report a Problem"}</Text>
                <Pressable onPress={onClose} style={styles.closeIconBtn}>
                  <Feather name="x" size={22} color={theme.textSecondary || "#94A3B8"} />
                </Pressable>
              </View>

              <Text style={[styles.subtitle, { color: theme.textSecondary || "#94A3B8", marginBottom: 16 }]}>
                {t.feedback?.subtitle || "Tell us what went wrong. Your feedback helps us improve Haajari Manager."}
              </Text>

              {/* Pre-filled Category Chips */}
              <Text style={styles.inputLabel}>{t.feedback?.category || "Category"}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                {CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setSelectedCategory(cat)}
                      style={[
                        styles.chip,
                        isSelected && styles.chipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Problem Message Input */}
              <Text style={[styles.inputLabel, { marginTop: 16 }]}>{t.feedback?.description || "Problem Description"}</Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={4}
                placeholder="Please describe what went wrong..."
                placeholderTextColor="#64748B"
                value={userMessage}
                onChangeText={setUserMessage}
              />

              {statusNotice && (
                <Text style={styles.noticeText}>{statusNotice}</Text>
              )}

              {/* Diagnostics Summary Box */}
              <View style={styles.diagnosticsBox}>
                <Text style={styles.diagTitle}>{t.feedback?.attachedDiagnostics || "Attached Diagnostics Context"}</Text>
                <Text style={styles.diagText}>Feature: {config.feature}</Text>
                <Text style={styles.diagText}>Category: {selectedCategory}</Text>
                {config.httpStatus ? <Text style={styles.diagText}>HTTP Status: {config.httpStatus}</Text> : null}
                {config.durationMs ? <Text style={styles.diagText}>Duration: {(config.durationMs / 1000).toFixed(1)}s</Text> : null}
              </View>

              {/* Submit Button */}
              <Pressable
                onPress={handleSubmit}
                disabled={isSubmitting}
                style={({ pressed }) => [
                  styles.submitBtn,
                  { opacity: pressed || isSubmitting ? 0.8 : 1 },
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Feather name="send" size={16} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>{t.feedback?.submitFeedback || "Submit Feedback"}</Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          )}

          {step === "submitted" && (
            <View style={styles.stepContent}>
              <View style={[styles.iconCircle, { backgroundColor: "rgba(16, 185, 129, 0.1)" }]}>
                <Feather name="check-circle" size={32} color="#10B981" />
              </View>

              <Text style={[styles.title, { color: theme.text }]}>{t.feedback?.feedbackReceived || "Feedback Received"}</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary || "#94A3B8" }]}>
                {t.feedback?.thanksMessage || "Thanks for your feedback! We've received your report."}
              </Text>

              <Pressable onPress={onClose} style={[styles.retryButton, { backgroundColor: "#10B981", marginTop: 20 }]}>
                <Text style={styles.retryButtonText}>{t.common?.ok || "Done"}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.8)",
    justifyContent: "flex-end",
  },
  container: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  handleIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignSelf: "center",
    marginBottom: 16,
  },
  stepContent: {
    alignItems: "center",
    paddingVertical: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(249, 115, 22, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    width: "100%",
  },
  retryButton: {
    flex: 1,
    backgroundColor: "#F97316",
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  reportButton: {
    flex: 1,
    backgroundColor: "rgba(249, 115, 22, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(249, 115, 22, 0.3)",
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  reportButtonText: {
    color: "#F97316",
    fontSize: 14,
    fontWeight: "700",
  },
  dismissButton: {
    marginTop: 16,
    paddingVertical: 8,
  },
  dismissText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },
  scrollForm: {
    paddingBottom: 20,
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  closeIconBtn: {
    padding: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  chipsContainer: {
    flexDirection: "row",
    marginBottom: 8,
  },
  chip: {
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: "#F97316",
    borderColor: "#F97316",
  },
  chipText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "700",
  },
  chipTextSelected: {
    color: "#FFFFFF",
  },
  textArea: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 14,
    padding: 14,
    color: "#FFFFFF",
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: "top",
  },
  noticeText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 6,
  },
  diagnosticsBox: {
    backgroundColor: "rgba(30, 41, 59, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  diagTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  diagText: {
    fontSize: 11,
    color: "#CBD5E1",
  },
  submitBtn: {
    backgroundColor: "#F97316",
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
