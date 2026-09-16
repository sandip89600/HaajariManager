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
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { captureLocation } from "@/utils/gps";
import { uploadImageToServer } from "@/utils/upload";
import { siteActivityStorage, WorkerTodayContext } from "@/utils/storage";

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
  } | null>(null);

  const [todayContext, setTodayContext] = useState<WorkerTodayContext | null>(
    null,
  );
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

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
        loc ? { latitude: loc.latitude, longitude: loc.longitude } : undefined,
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
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          t("camera.permissionDenied", "Camera Permission Required"),
          t(
            "camera.permissionDeniedDesc",
            "Please grant camera permission to capture work proof photos.",
          ),
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
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
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          t("camera.permissionDenied", "Gallery Permission Required"),
          t(
            "camera.galleryPermissionDesc",
            "Please grant gallery permission to select photos.",
          ),
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
        t("site.noSiteFound", "No Site Found"),
        t(
          "site.noSiteFoundDesc",
          "Please connect with your contractor to assign a site.",
        ),
      );
      return;
    }

    if (!photoUri && mode !== "ISSUE") {
      Alert.alert(
        t("camera.photoRequired", "Photo Required"),
        t(
          "camera.photoRequiredDesc",
          "Please capture a photo to submit work proof.",
        ),
      );
      return;
    }

    if (mode === "ISSUE" && !description.trim()) {
      Alert.alert(
        t("issue.descRequired", "Description Required"),
        t(
          "issue.descRequiredDesc",
          "Please describe the issue encountered at the site.",
        ),
      );
      return;
    }

    setIsSubmitting(true);
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
      Alert.alert(
        t("common.error", "Error"),
        err?.message ||
          t(
            "common.somethingWentWrong",
            "Something went wrong, please try again",
          ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setPhotoUri(null);
    setDescription("");
    setSubmittedSuccess(false);
    loadContext();
  };

  const cardBg = isDark ? "#1E293B" : "#FFFFFF";
  const borderCol = isDark ? "#334155" : "#E2E8F0";

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
              ? t("issue.reportedSuccess", "Issue Reported Successfully!")
              : mode === "MORNING_WORK"
                ? t("camera.morningSubmitted", "Morning Work Update Submitted!")
                : t(
                    "camera.eveningSubmitted",
                    "Evening Work Update Submitted!",
                  )}
          </Text>

          <Text
            style={[
              styles.successSubtitle,
              { color: isDark ? "#94A3B8" : "#64748B" },
            ]}
          >
            {activeSite?.name ? `📍 ${activeSite.name}` : ""}
            {"\n"}
            {t(
              "camera.proofSavedMessage",
              "Your photo, timestamp, and GPS location are recorded for the contractor.",
            )}
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
              <Text style={styles.successBtnText}>
                {t("nav.siteLogs", "View Site Logs")}
              </Text>
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
                {t("camera.submitAnother", "Submit Another Update")}
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
            {t("camera.title", "📸 Work Photo Update")}
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              { color: isDark ? "#94A3B8" : "#64748B" },
            ]}
          >
            {t(
              "camera.subtitle",
              "Capture photo proof to verify daily progress",
            )}
          </Text>
        </View>
      </View>

      {/* Detected / Working Site Badge */}
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
            {t("site.currentSite", "Current Site")}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.siteBannerName,
              { color: isDark ? "#F8FAFC" : "#0F172A" },
            ]}
          >
            {activeSite
              ? activeSite.name
              : t("site.noSiteDetected", "Detecting site...")}
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

      {/* Mode Selector */}
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
            color={
              mode === "MORNING_WORK"
                ? "#FFFFFF"
                : isDark
                  ? "#94A3B8"
                  : "#64748B"
            }
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
            {t("camera.morning", "🌅 Morning Work")}
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
            color={
              mode === "EVENING_WORK"
                ? "#FFFFFF"
                : isDark
                  ? "#94A3B8"
                  : "#64748B"
            }
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
            {t("camera.evening", "🌆 Evening Work")}
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
            color={
              mode === "ISSUE" ? "#FFFFFF" : isDark ? "#94A3B8" : "#64748B"
            }
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
            {t("camera.reportIssue", "⚠️ Issue")}
          </Text>
        </Pressable>
      </View>

      {/* Photo Capture Area */}
      <View
        style={[
          styles.photoCard,
          { backgroundColor: cardBg, borderColor: borderCol },
        ]}
      >
        {photoUri ? (
          <View style={styles.imagePreviewContainer}>
            <Image
              source={{ uri: photoUri }}
              style={styles.imagePreview}
              resizeMode="cover"
            />

            {/* GPS Stamp Overlay */}
            <View style={styles.gpsStampBadge}>
              <Feather name="map-pin" size={12} color="#FFFFFF" />
              <Text style={styles.gpsStampText}>
                {activeSite?.name || "Site"} •{" "}
                {new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>

            <Pressable
              onPress={() => setPhotoUri(null)}
              style={styles.retakeBtn}
            >
              <Feather name="refresh-cw" size={16} color="#FFFFFF" />
              <Text style={styles.retakeBtnText}>
                {t("camera.retake", "Retake")}
              </Text>
            </Pressable>
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
                ? t(
                    "camera.captureIssuePhoto",
                    "Capture site issue photo (Optional)",
                  )
                : mode === "MORNING_WORK"
                  ? t(
                      "camera.captureMorningPhoto",
                      "Capture photo of work starting in the morning",
                    )
                  : t(
                      "camera.captureEveningPhoto",
                      "Capture photo of work completed by the evening",
                    )}
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
                <Text style={styles.primaryCaptureBtnText}>
                  {t("camera.openCamera", "Open Camera")}
                </Text>
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
                  {t("camera.gallery", "Gallery")}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* If reporting Issue: Severity Selector */}
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
            {t("issue.severityLevel", "Issue Severity Level")}
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
              },
            )}
          </View>
        </View>
      )}

      {/* Short Description Note */}
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: cardBg, borderColor: borderCol },
        ]}
      >
        <Text
          style={[styles.fieldLabel, { color: isDark ? "#F8FAFC" : "#0F172A" }]}
        >
          {mode === "ISSUE"
            ? t("issue.describeIssue", "Issue Description *")
            : t("camera.workDetails", "Work Details (Optional)")}
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={
            mode === "ISSUE"
              ? t("issue.placeholder", "e.g., Cement finished, work halted...")
              : t(
                  "camera.notesPlaceholder",
                  "e.g., Completed first floor brickwork masonry...",
                )
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

      {/* Submit Button */}
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
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Feather name="send" size={20} color="#FFFFFF" />
            <Text style={styles.submitButtonText}>
              {mode === "ISSUE"
                ? t("issue.submitIssueBtn", "Report Issue")
                : mode === "MORNING_WORK"
                  ? t("camera.submitMorningBtn", "Submit Morning Work")
                  : t("camera.submitEveningBtn", "Submit Evening Work")}
            </Text>
          </>
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
    paddingBottom: 40,
  },
  headerRow: {
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 3,
  },
  siteBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  siteBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  siteBannerLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  siteBannerName: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 1,
  },
  modeSelectorContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  modeButtonActive: {
    borderColor: "transparent",
  },
  modeButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  photoCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 16,
  },
  emptyCaptureArea: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  capturePrompt: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 18,
    paddingHorizontal: 16,
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
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
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
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  galleryCaptureBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  imagePreviewContainer: {
    width: "100%",
    height: 280,
    position: "relative",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  gpsStampBadge: {
    position: "absolute",
    bottom: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 6,
  },
  gpsStampText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  retakeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    gap: 6,
  },
  retakeBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  sectionCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
  },
  severityRow: {
    flexDirection: "row",
    gap: 8,
  },
  severityChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  severityChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    textAlignVertical: "top",
    minHeight: 80,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 20,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  successCard: {
    margin: 16,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
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
    gap: 10,
  },
  successPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
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
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 8,
  },
  successSecondaryText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
