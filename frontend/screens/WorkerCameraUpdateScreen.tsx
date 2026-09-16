import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { captureLocation } from "@/utils/gps";
import { uploadImageToServer } from "@/utils/upload";
import { siteActivityStorage, WorkerTodayContext } from "@/utils/storage";
import { BorderRadius } from "@/constants/theme";

type UpdateMode = "MORNING_WORK" | "EVENING_WORK" | "ISSUE";
type IssueSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export default function WorkerCameraUpdateScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<UpdateMode>("MORNING_WORK");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<IssueSeverity>("MEDIUM");

  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string;
  } | null>(null);

  const [todayContext, setTodayContext] = useState<WorkerTodayContext | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const formattedCurrentTime = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Fetch worker today context (detected site / active site)
  const loadContext = useCallback(async () => {
    setIsLoadingContext(true);
    try {
      setIsCapturingLocation(true);
      const loc = await captureLocation();
      if (loc) {
        setGpsLocation(loc);
      }
      setIsCapturingLocation(false);

      const ctx = await siteActivityStorage.getWorkerTodayContext(
        loc ? { latitude: loc.latitude, longitude: loc.longitude } : undefined
      );
      setTodayContext(ctx);

      // Auto select mode based on what is pending
      if (
        ctx.workUpdates?.morning?.submitted &&
        !ctx.workUpdates?.evening?.submitted
      ) {
        setMode("EVENING_WORK");
      } else if (!ctx.workUpdates?.morning?.submitted) {
        setMode("MORNING_WORK");
      }
    } catch (err) {
      console.warn("Error loading worker context for camera update:", err);
    } finally {
      setIsLoadingContext(false);
      setIsCapturingLocation(false);
    }
  }, []);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  const activeSite =
    todayContext?.activeWorkingSite ||
    todayContext?.detectedNearbySite ||
    todayContext?.defaultSite;

  const takePhoto = async () => {
    setUploadError(null);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Camera Permission Required",
          "Please grant camera permission to capture work proof photos."
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7, // Good compression for mobile upload without quality loss
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        // Refresh GPS when photo is captured
        captureLocation().then((loc) => {
          if (loc) setGpsLocation(loc);
        });
      }
    } catch (e) {
      console.warn("Error opening camera:", e);
    }
  };

  const pickFromGallery = async () => {
    setUploadError(null);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Gallery Permission Required",
          "Please grant gallery permission to select photos."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      console.warn("Error opening gallery:", e);
    }
  };

  const handleSubmit = async () => {
    if (!activeSite?.id) {
      Alert.alert(
        "No Site Assigned",
        "Please connect with your contractor to assign a site."
      );
      return;
    }

    if (!photoUri && mode !== "ISSUE") {
      Alert.alert(
        "Photo Required",
        "Please capture a work photo before submitting."
      );
      return;
    }

    if (mode === "ISSUE" && !description.trim()) {
      Alert.alert(
        "Description Required",
        "Please describe the issue encountered at the site."
      );
      return;
    }

    setIsSubmitting(true);
    setUploadError(null);

    try {
      let uploadedUrl = "";
      if (photoUri) {
        uploadedUrl = await uploadImageToServer(photoUri);
      }

      if (mode === "ISSUE") {
        await siteActivityStorage.reportSiteIssue(activeSite.id, {
          description: description.trim(),
          photoUrl: uploadedUrl || undefined,
          severity,
          latitude: gpsLocation?.latitude,
          longitude: gpsLocation?.longitude,
          accuracy: gpsLocation?.accuracy,
          address: activeSite.address,
        });
      } else {
        await siteActivityStorage.submitWorkUpdate(activeSite.id, {
          type: mode,
          photoUrl: uploadedUrl,
          description: description.trim() || undefined,
          latitude: gpsLocation?.latitude,
          longitude: gpsLocation?.longitude,
          accuracy: gpsLocation?.accuracy,
          address: activeSite.address,
          clientRequestId: `${user?.id || "worker"}_${mode}_${Date.now()}`,
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmittedSuccess(true);
    } catch (err: any) {
      console.warn("Submit error:", err);
      const friendlyMessage =
        err?.message && !err.message.includes("500") && !err.message.includes("Multer")
          ? err.message
          : "Unable to upload photo. Please check your internet connection and try again.";
      setUploadError(friendlyMessage);
      Alert.alert("Unable to Upload", friendlyMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setPhotoUri(null);
    setDescription("");
    setSubmittedSuccess(false);
    setUploadError(null);
    loadContext();
  };

  const cardBg = isDark ? "#1E293B" : "#FFFFFF";
  const borderCol = isDark ? "#334155" : "#E2E8F0";

  // SUCCESS CONFIRMATION SCREEN
  if (submittedSuccess) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
            paddingTop: insets.top + 30,
            paddingBottom: insets.bottom + 20,
          },
        ]}
      >
        <View
          style={[
            styles.successCard,
            { backgroundColor: cardBg, borderColor: borderCol },
          ]}
        >
          <View style={styles.successIconCircle}>
            <Feather name="check" size={44} color="#FFFFFF" />
          </View>

          <Text
            style={[
              styles.successTitle,
              { color: isDark ? "#F8FAFC" : "#0F172A" },
            ]}
          >
            {mode === "ISSUE"
              ? "✓ Issue Reported Successfully!"
              : mode === "MORNING_WORK"
              ? "✓ Morning Work Update Uploaded!"
              : "✓ Evening Work Update Uploaded!"}
          </Text>

          <Text
            style={[
              styles.successSubtitle,
              { color: isDark ? "#94A3B8" : "#64748B" },
            ]}
          >
            {activeSite?.name ? `🏗️ ${activeSite.name}` : ""}
            {"\n"}
            Photo and GPS proof are now instantly visible to your contractor in Site Control.
          </Text>

          <View style={styles.successActions}>
            <Pressable
              onPress={() => {
                resetForm();
                navigation.navigate("SiteLogsTab");
              }}
              style={[
                styles.successPrimaryBtn,
                { backgroundColor: theme.primary },
              ]}
            >
              <Feather name="file-text" size={18} color="#FFFFFF" />
              <Text style={styles.successBtnText}>View Site Logs</Text>
            </Pressable>

            <Pressable
              onPress={resetForm}
              style={[
                styles.successSecondaryBtn,
                {
                  borderColor: theme.primary,
                  backgroundColor: isDark ? "#1E293B" : "#F0FDF4",
                },
              ]}
            >
              <Feather name="camera" size={18} color={theme.primary} />
              <Text
                style={[styles.successSecondaryText, { color: theme.primary }]}
              >
                Submit Another Update
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[
        styles.container,
        {
          backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
          paddingTop: insets.top + 12,
        },
      ]}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingBottom: insets.bottom + 40 },
      ]}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text
            style={[
              styles.headerTitle,
              { color: isDark ? "#F8FAFC" : "#0F172A" },
            ]}
          >
            📸 Work Photo Update
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              { color: isDark ? "#94A3B8" : "#64748B" },
            ]}
          >
            Capture photo proof to verify daily site progress
          </Text>
        </View>
      </View>

      {/* Detected / Working Site Banner */}
      <View
        style={[
          styles.siteBanner,
          {
            backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
            borderColor: borderCol,
          },
        ]}
      >
        <View style={styles.siteBannerIcon}>
          <Feather name="map-pin" size={18} color={theme.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.siteBannerLabel,
              { color: isDark ? "#94A3B8" : "#64748B" },
            ]}
          >
            Current Site
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.siteBannerName,
              { color: isDark ? "#F8FAFC" : "#0F172A" },
            ]}
          >
            {activeSite ? activeSite.name : "Detecting site..."}
          </Text>
        </View>
        {isCapturingLocation && (
          <ActivityIndicator
            size="small"
            color={theme.primary}
            style={{ marginLeft: 8 }}
          />
        )}
      </View>

      {/* Mode Selector (Morning / Evening / Issue) */}
      <View style={styles.modeSelectorContainer}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setMode("MORNING_WORK");
          }}
          style={[
            styles.modeButton,
            mode === "MORNING_WORK"
              ? [styles.modeButtonActive, { backgroundColor: "#F59E0B" }]
              : { backgroundColor: cardBg, borderColor: borderCol },
          ]}
        >
          <MaterialCommunityIcons
            name="weather-sunny"
            size={18}
            color={mode === "MORNING_WORK" ? "#FFFFFF" : isDark ? "#94A3B8" : "#64748B"}
          />
          <Text
            style={[
              styles.modeButtonText,
              {
                color:
                  mode === "MORNING_WORK"
                    ? "#FFFFFF"
                    : isDark
                    ? "#CBD5E1"
                    : "#475569",
              },
            ]}
          >
            🌅 Morning
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setMode("EVENING_WORK");
          }}
          style={[
            styles.modeButton,
            mode === "EVENING_WORK"
              ? [styles.modeButtonActive, { backgroundColor: "#3B82F6" }]
              : { backgroundColor: cardBg, borderColor: borderCol },
          ]}
        >
          <MaterialCommunityIcons
            name="weather-sunset"
            size={18}
            color={mode === "EVENING_WORK" ? "#FFFFFF" : isDark ? "#94A3B8" : "#64748B"}
          />
          <Text
            style={[
              styles.modeButtonText,
              {
                color:
                  mode === "EVENING_WORK"
                    ? "#FFFFFF"
                    : isDark
                    ? "#CBD5E1"
                    : "#475569",
              },
            ]}
          >
            🌆 Evening
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setMode("ISSUE");
          }}
          style={[
            styles.modeButton,
            mode === "ISSUE"
              ? [styles.modeButtonActive, { backgroundColor: "#EF4444" }]
              : { backgroundColor: cardBg, borderColor: borderCol },
          ]}
        >
          <Feather
            name="alert-triangle"
            size={16}
            color={mode === "ISSUE" ? "#FFFFFF" : isDark ? "#94A3B8" : "#64748B"}
          />
          <Text
            style={[
              styles.modeButtonText,
              {
                color:
                  mode === "ISSUE" ? "#FFFFFF" : isDark ? "#CBD5E1" : "#475569",
              },
            ]}
          >
            ⚠️ Issue
          </Text>
        </Pressable>
      </View>

      {/* Photo Capture & Structured Preview Area */}
      <View
        style={[
          styles.photoCard,
          { backgroundColor: cardBg, borderColor: borderCol },
        ]}
      >
        {photoUri ? (
          <View style={styles.imagePreviewContainer}>
            <View style={styles.previewHeaderRow}>
              <Text style={styles.previewHeaderTitle}>📸 WORK UPDATE</Text>
              <Pressable onPress={() => setPhotoUri(null)} style={styles.retakeTopBtn}>
                <Feather name="refresh-cw" size={14} color="#64748B" />
                <Text style={styles.retakeTopBtnText}>Retake</Text>
              </Pressable>
            </View>

            <Image
              source={{ uri: photoUri }}
              style={styles.imagePreview}
              resizeMode="cover"
            />

            {/* Structured Metadata Card */}
            <View
              style={[
                styles.metadataContainer,
                { backgroundColor: isDark ? "#0F172A" : "#F8FAFC", borderColor: borderCol },
              ]}
            >
              {/* Site */}
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Site:</Text>
                <Text style={[styles.metaVal, { color: theme.text }]}>
                  🏗️ {activeSite?.name || "Site"}
                </Text>
              </View>

              {/* Location */}
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Location:</Text>
                <Text style={[styles.metaVal, { color: "#16A34A", fontWeight: "700" }]}>
                  ✓ GPS Captured {gpsLocation?.accuracy ? `(±${Math.round(gpsLocation.accuracy)}m)` : ""}
                </Text>
              </View>

              {/* Time */}
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Time:</Text>
                <Text style={[styles.metaVal, { color: theme.text }]}>
                  🕘 {formattedCurrentTime}
                </Text>
              </View>

              {/* Worker */}
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Worker:</Text>
                <Text style={[styles.metaVal, { color: theme.text }]}>
                  👷 {user?.name || "Worker"} ({user?.workerCategory || "Labour"})
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.emptyCaptureArea}>
            <View
              style={[
                styles.cameraIconCircle,
                { backgroundColor: theme.primary + "1A" },
              ]}
            >
              <Feather name="camera" size={36} color={theme.primary} />
            </View>
            <Text
              style={[
                styles.capturePrompt,
                { color: isDark ? "#F8FAFC" : "#0F172A" },
              ]}
            >
              {mode === "ISSUE"
                ? "Capture site issue photo (Optional)"
                : mode === "MORNING_WORK"
                ? "Capture photo of work starting in the morning"
                : "Capture photo of work completed by the evening"}
            </Text>

            <View style={styles.captureButtonsRow}>
              <Pressable
                onPress={takePhoto}
                style={[
                  styles.primaryCaptureBtn,
                  { backgroundColor: theme.primary },
                ]}
              >
                <Feather name="camera" size={20} color="#FFFFFF" />
                <Text style={styles.primaryCaptureBtnText}>Open Camera</Text>
              </Pressable>

              <Pressable
                onPress={pickFromGallery}
                style={[
                  styles.galleryCaptureBtn,
                  {
                    borderColor: borderCol,
                    backgroundColor: isDark ? "#334155" : "#F1F5F9",
                  },
                ]}
              >
                <Feather
                  name="image"
                  size={20}
                  color={isDark ? "#CBD5E1" : "#475569"}
                />
                <Text
                  style={[
                    styles.galleryCaptureBtnText,
                    { color: isDark ? "#CBD5E1" : "#475569" },
                  ]}
                >
                  Gallery
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Severity Selector (if Issue) */}
      {mode === "ISSUE" && (
        <View
          style={[
            styles.sectionCard,
            { backgroundColor: cardBg, borderColor: borderCol },
          ]}
        >
          <Text
            style={[
              styles.fieldLabel,
              { color: isDark ? "#F8FAFC" : "#0F172A" },
            ]}
          >
            Issue Severity Level
          </Text>
          <View style={styles.severityRow}>
            {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as IssueSeverity[]).map(
              (lvl) => {
                const isActive = severity === lvl;
                const lvlColor =
                  lvl === "LOW"
                    ? "#10B981"
                    : lvl === "MEDIUM"
                    ? "#F59E0B"
                    : lvl === "HIGH"
                    ? "#F97316"
                    : "#EF4444";
                return (
                  <Pressable
                    key={lvl}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSeverity(lvl);
                    }}
                    style={[
                      styles.severityChip,
                      {
                        borderColor: isActive ? lvlColor : borderCol,
                        backgroundColor: isActive
                          ? lvlColor + "20"
                          : isDark
                          ? "#0F172A"
                          : "#F8FAFC",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.severityChipText,
                        {
                          color: isActive
                            ? lvlColor
                            : isDark
                            ? "#94A3B8"
                            : "#64748B",
                        },
                      ]}
                    >
                      {lvl}
                    </Text>
                  </Pressable>
                );
              }
            )}
          </View>
        </View>
      )}

      {/* Description Note */}
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: cardBg, borderColor: borderCol },
        ]}
      >
        <Text
          style={[styles.fieldLabel, { color: isDark ? "#F8FAFC" : "#0F172A" }]}
        >
          {mode === "ISSUE" ? "Issue Description *" : "Description Note"}
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={
            mode === "ISSUE"
              ? "e.g., Cement finished, work halted..."
              : 'e.g., "आज plaster work शुरू किया."'
          }
          placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
          multiline
          numberOfLines={3}
          style={[
            styles.textInput,
            {
              backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
              color: isDark ? "#F8FAFC" : "#0F172A",
              borderColor: borderCol,
            },
          ]}
        />
      </View>

      {/* Error Message Display */}
      {uploadError ? (
        <View style={styles.errorBanner}>
          <Feather name="alert-circle" size={16} color="#DC2626" />
          <Text style={styles.errorBannerText}>{uploadError}</Text>
        </View>
      ) : null}

      {/* SUBMIT BUTTON */}
      <Pressable
        onPress={handleSubmit}
        disabled={isSubmitting}
        style={[
          styles.submitButton,
          {
            backgroundColor:
              mode === "ISSUE"
                ? "#EF4444"
                : mode === "MORNING_WORK"
                ? "#F59E0B"
                : "#10B981",
            opacity: isSubmitting ? 0.7 : 1,
          },
        ]}
      >
        {isSubmitting ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.submitButtonText}>Uploading photo...</Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Feather name="send" size={20} color="#FFFFFF" />
            <Text style={styles.submitButtonText}>
              {uploadError ? "TRY AGAIN" : "SUBMIT UPDATE"}
            </Text>
          </View>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
  },
  headerRow: {
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },

  siteBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: 14,
    gap: 10,
  },
  siteBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  siteBannerLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  siteBannerName: {
    fontSize: 14,
    fontWeight: "800",
  },

  // Mode Selector
  modeSelectorContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  modeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  modeButtonActive: {
    borderWidth: 0,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  modeButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // Photo Card
  photoCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  emptyCaptureArea: {
    alignItems: "center",
    paddingVertical: 24,
  },
  cameraIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  capturePrompt: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18,
    paddingHorizontal: 12,
  },
  captureButtonsRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  primaryCaptureBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: BorderRadius.lg,
  },
  primaryCaptureBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  galleryCaptureBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  galleryCaptureBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Image Preview & Structured Metadata
  imagePreviewContainer: {
    width: "100%",
  },
  previewHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  previewHeaderTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#64748B",
  },
  retakeTopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 4,
  },
  retakeTopBtnText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  imagePreview: {
    width: "100%",
    height: 220,
    borderRadius: BorderRadius.lg,
    backgroundColor: "#1E293B",
    marginBottom: 12,
  },
  metadataContainer: {
    padding: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 6,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  metaVal: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Severity & Notes
  sectionCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  severityRow: {
    flexDirection: "row",
    gap: 8,
  },
  severityChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  severityChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  textInput: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: 12,
    fontSize: 13,
    textAlignVertical: "top",
  },

  // Error Banner
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    padding: 12,
    borderRadius: BorderRadius.md,
    marginBottom: 14,
  },
  errorBannerText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },

  // Submit Button
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: BorderRadius.lg,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  // Success Screen
  successCard: {
    borderRadius: BorderRadius.xl || 24,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  successActions: {
    width: "100%",
    gap: 12,
  },
  successPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
  },
  successBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  successSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
  },
  successSecondaryText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
