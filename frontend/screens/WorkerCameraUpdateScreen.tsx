import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  Image,
  Modal,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { captureLocation } from "@/utils/gps";
import { uploadImageToServer } from "@/utils/upload";
import { siteActivityStorage, WorkerTodayContext } from "@/utils/storage";
import { BorderRadius } from "@/constants/theme";

type CameraMode = "MORNING" | "EVENING";
type CameraStep = "CAMERA" | "PREVIEW" | "CONFIRMED" | "UPLOADING" | "SUCCESS" | "ERROR";

export default function WorkerCameraUpdateScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  // In-App Camera Experience State
  const [activeCameraMode, setActiveCameraMode] = useState<CameraMode | null>(null);
  const [cameraStep, setCameraStep] = useState<CameraStep>("CAMERA");
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);

  // Context & Site Data
  const [todayContext, setTodayContext] = useState<WorkerTodayContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadContext = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      let loc = null;
      try {
        loc = await captureLocation();
      } catch (gpsErr) {
        console.warn("GPS capture non-fatal:", gpsErr);
      }
      const ctx = await siteActivityStorage.getWorkerTodayContext(
        loc ? { latitude: loc.latitude, longitude: loc.longitude } : undefined
      );
      setTodayContext(ctx);
    } catch (err: any) {
      const msg = err?.message || err?.toString() || "Failed to load worker site context";
      console.error("Worker today context error:", err);
      setLoadError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  const onRefresh = () => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadContext();
  };

  const activeSite =
    todayContext?.activeWorkingSite ||
    todayContext?.detectedNearbySite ||
    todayContext?.defaultSite;

  // Open the Camera experience inside Site Cam
  const handleStartCamera = async (type: CameraMode) => {
    const isMorning = type === "MORNING";
    const alreadyUploaded = isMorning
      ? todayContext?.workUpdates?.morning?.submitted
      : todayContext?.workUpdates?.evening?.submitted;

    if (alreadyUploaded) {
      Alert.alert(
        "Already Uploaded",
        `${isMorning ? "Morning" : "Evening"} photo has already been uploaded for today.`
      );
      return;
    }

    if (!activeSite?.id) {
      Alert.alert(
        "No Site Assigned",
        "Please connect with your contractor to assign an active work site."
      );
      return;
    }

    // Auto-request permission if not granted
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert(
          "Camera Permission Required",
          "Camera permission is required to capture site proof photos. Please enable it in device settings.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => Linking.openSettings().catch(() => {}),
            },
          ]
        );
        return;
      }
    }

    setActiveCameraMode(type);
    setCameraStep("CAMERA");
    setCapturedPhotoUri(null);
    setUploadError(null);
    setTorchOn(false);
  };

  const handleCloseCameraExperience = () => {
    if (cameraStep === "UPLOADING") return; // Prevent closing mid-upload
    setActiveCameraMode(null);
    setCameraStep("CAMERA");
    setCapturedPhotoUri(null);
    setUploadError(null);
    setTorchOn(false);
  };

  // Step 3: Capture Photo with In-App Camera
  const handleCapturePhoto = async () => {
    if (isTakingPhoto || !cameraRef.current) return;
    setIsTakingPhoto(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: false,
      });

      if (photo && photo.uri) {
        setCapturedPhotoUri(photo.uri);
        setCameraStep("PREVIEW");
      }
    } catch (err: any) {
      console.warn("Failed to capture picture:", err);
      Alert.alert("Camera Error", "Could not take photo. Please try again.");
    } finally {
      setIsTakingPhoto(false);
    }
  };

  // Step 5: Retake
  const handleRetake = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCapturedPhotoUri(null);
    setUploadError(null);
    setCameraStep("CAMERA");
  };

  // Step 5: Right / Confirm
  const handleConfirmPhoto = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCameraStep("CONFIRMED");
  };

  // Step 7: Send to Contractor
  const handleSendToContractor = async () => {
    if (!capturedPhotoUri || !activeCameraMode) return;
    if (!activeSite?.id) {
      Alert.alert(
        "No Site Assigned",
        "Please connect with your contractor to assign an active work site."
      );
      return;
    }

    setCameraStep("UPLOADING");
    setUploadError(null);

    try {
      // 1. Mandatory GPS Location check
      let location: any = null;
      try {
        location = await captureLocation();
      } catch (locErr) {
        console.warn("Location capture failed:", locErr);
      }

      if (!location || !location.latitude || !location.longitude) {
        setCameraStep("ERROR");
        setUploadError(
          "Location permission and GPS coordinates are required for work photos. Please enable location services in device settings."
        );
        return;
      }

      // 2. Upload image file to server storage
      const uploadedUrl = await uploadImageToServer(capturedPhotoUri);

      // 3. Submit work update to backend
      const isMorning = activeCameraMode === "MORNING";
      const activityType = isMorning ? "MORNING_WORK" : "EVENING_WORK";
      const todayDate = new Date().toISOString().split("T")[0];
      const clientRequestId = `${user?.id || "worker"}_${activeCameraMode}_${todayDate}_${Date.now()}`;

      await siteActivityStorage.submitWorkUpdate(activeSite.id, {
        activityType,
        photo: uploadedUrl,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          address: activeSite.address,
        },
        clientRequestId,
      });

      // 4. Server confirmed success
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCameraStep("SUCCESS");

      // Auto close and refresh after 1.5 seconds
      setTimeout(() => {
        handleCloseCameraExperience();
        loadContext();
      }, 1600);
    } catch (err: any) {
      console.warn("Upload work photo error:", err);
      setCameraStep("ERROR");
      setUploadError(
        err?.message ||
          "Failed to upload work photo. Please check your network and retry."
      );
    }
  };

  const cardBg = isDark ? "#1E293B" : "#FFFFFF";
  const borderCol = isDark ? "#334155" : "#E2E8F0";

  const morningSubmitted = todayContext?.workUpdates?.morning?.submitted;
  const morningTime = todayContext?.workUpdates?.morning?.time;

  const eveningSubmitted = todayContext?.workUpdates?.evening?.submitted;
  const eveningTime = todayContext?.workUpdates?.evening?.time;

  return (
    <View style={[styles.root, { backgroundColor: isDark ? "#0F172A" : "#F8FAFC" }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 100,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text
            style={[
              styles.headerTitle,
              { color: isDark ? "#F8FAFC" : "#0F172A" },
            ]}
          >
            📸 Site Cam
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              { color: isDark ? "#94A3B8" : "#64748B" },
            ]}
          >
            Capture daily morning and evening work proof photos
          </Text>
        </View>

        {/* Site Info Banner */}
        <View
          style={[
            styles.siteBanner,
            { backgroundColor: cardBg, borderColor: borderCol },
          ]}
        >
          <View style={styles.siteIconWrap}>
            <Feather name="map-pin" size={18} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.siteBannerLabel,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              Current Work Site
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.siteBannerName,
                { color: isDark ? "#F8FAFC" : "#0F172A" },
              ]}
            >
              {activeSite?.name ||
                (isLoading
                  ? "Detecting Site..."
                  : todayContext?.worker?.contractorName
                  ? "No Site Assigned"
                  : "No Contractor Connected")}
            </Text>
            {activeSite?.address ? (
              <Text
                numberOfLines={1}
                style={[
                  styles.siteBannerAddress,
                  { color: isDark ? "#64748B" : "#94A3B8" },
                ]}
              >
                {activeSite.address}
              </Text>
            ) : todayContext?.worker?.contractorName ? (
              <Text
                numberOfLines={1}
                style={[
                  styles.siteBannerAddress,
                  { color: isDark ? "#64748B" : "#94A3B8" },
                ]}
              >
                Contractor: {todayContext.worker.contractorName}
              </Text>
            ) : (
              <Text
                numberOfLines={1}
                style={[
                  styles.siteBannerAddress,
                  { color: isDark ? "#EF4444" : "#DC2626" },
                ]}
              >
                Connect with contractor to enable site photos
              </Text>
            )}
          </View>
        </View>

        {/* Error Banner with Retry */}
        {loadError && !isLoading ? (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: isDark ? "#451A1A" : "#FEF2F2",
                borderColor: "#FCA5A5",
              },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <Feather name="alert-circle" size={18} color="#EF4444" />
              <Text
                style={[
                  styles.errorBannerText,
                  { color: isDark ? "#FCA5A5" : "#991B1B" },
                ]}
                numberOfLines={3}
              >
                {loadError}
              </Text>
            </View>
            <Pressable onPress={loadContext} style={styles.retryBtn}>
              <Feather name="refresh-cw" size={13} color="#FFFFFF" />
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingArea}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <View style={styles.cardsWrap}>
            {/* 1. MORNING CAMERA CARD */}
            <View
              style={[
                styles.photoCard,
                {
                  backgroundColor: cardBg,
                  borderColor: morningSubmitted ? "#10B981" : borderCol,
                },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <View
                  style={[
                    styles.cardIconCircle,
                    {
                      backgroundColor: morningSubmitted
                        ? "#DCFCE7"
                        : isDark
                        ? "#334155"
                        : "#FEF3C7",
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="weather-sunny"
                    size={26}
                    color={morningSubmitted ? "#10B981" : "#F59E0B"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.cardTitle,
                      { color: isDark ? "#F8FAFC" : "#0F172A" },
                    ]}
                  >
                    Morning Camera
                  </Text>
                  <Text
                    style={[
                      styles.cardSubtitle,
                      { color: isDark ? "#94A3B8" : "#64748B" },
                    ]}
                  >
                    {morningSubmitted
                      ? `✓ Morning Photo Uploaded${morningTime ? ` • ${morningTime}` : ""}`
                      : "Start of shift work photo"}
                  </Text>
                </View>
              </View>

              {morningSubmitted ? (
                <View style={styles.submittedBadge}>
                  <Feather name="check-circle" size={16} color="#10B981" />
                  <Text style={styles.submittedBadgeText}>
                    Uploaded at {morningTime || "Morning"}
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => handleStartCamera("MORNING")}
                  style={[styles.captureBtn, { backgroundColor: "#F59E0B" }]}
                >
                  <Feather name="camera" size={18} color="#FFFFFF" />
                  <Text style={styles.captureBtnText}>Open Morning Camera</Text>
                </Pressable>
              )}
            </View>

            {/* 2. EVENING CAMERA CARD */}
            <View
              style={[
                styles.photoCard,
                {
                  backgroundColor: cardBg,
                  borderColor: eveningSubmitted ? "#10B981" : borderCol,
                },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <View
                  style={[
                    styles.cardIconCircle,
                    {
                      backgroundColor: eveningSubmitted
                        ? "#DCFCE7"
                        : isDark
                        ? "#334155"
                        : "#DBEAFE",
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="weather-sunset"
                    size={26}
                    color={eveningSubmitted ? "#10B981" : "#3B82F6"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.cardTitle,
                      { color: isDark ? "#F8FAFC" : "#0F172A" },
                    ]}
                  >
                    Evening Camera
                  </Text>
                  <Text
                    style={[
                      styles.cardSubtitle,
                      { color: isDark ? "#94A3B8" : "#64748B" },
                    ]}
                  >
                    {eveningSubmitted
                      ? `✓ Evening Photo Uploaded${eveningTime ? ` • ${eveningTime}` : ""}`
                      : "End of shift completed-work photo"}
                  </Text>
                </View>
              </View>

              {eveningSubmitted ? (
                <View style={styles.submittedBadge}>
                  <Feather name="check-circle" size={16} color="#10B981" />
                  <Text style={styles.submittedBadgeText}>
                    Uploaded at {eveningTime || "Evening"}
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => handleStartCamera("EVENING")}
                  style={[styles.captureBtn, { backgroundColor: "#3B82F6" }]}
                >
                  <Feather name="camera" size={18} color="#FFFFFF" />
                  <Text style={styles.captureBtnText}>Open Evening Camera</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ─── IN-APP CAMERA EXPERIENCE MODAL ─── */}
      <Modal
        visible={activeCameraMode !== null}
        animationType="slide"
        transparent={false}
        onRequestClose={handleCloseCameraExperience}
      >
        <View style={styles.cameraScreenRoot}>
          {/* STEP 1: LIVE IN-APP CAMERA */}
          {cameraStep === "CAMERA" && (
            <View style={StyleSheet.absoluteFill}>
              {permission?.granted ? (
                <CameraView
                  ref={cameraRef}
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  enableTorch={torchOn}
                />
              ) : (
                <View style={[styles.permissionFallback, { backgroundColor: "#0F172A" }]}>
                  <Feather name="camera-off" size={48} color="#94A3B8" />
                  <Text style={styles.permTitle}>Camera Permission Required</Text>
                  <Text style={styles.permDesc}>
                    Please grant camera access to capture site proof photos.
                  </Text>
                  <Pressable
                    onPress={async () => {
                      if (permission && !permission.canAskAgain) {
                        Linking.openSettings().catch(() => {});
                      } else {
                        await requestPermission();
                      }
                    }}
                    style={styles.permBtn}
                  >
                    <Text style={styles.permBtnText}>Grant Permission</Text>
                  </Pressable>
                </View>
              )}

              {/* Viewfinder Overlay Frame */}
              <View style={styles.viewfinderFrame}>
                <View style={styles.vfCornerTL} />
                <View style={styles.vfCornerTR} />
                <View style={styles.vfCornerBL} />
                <View style={styles.vfCornerBR} />
              </View>

              {/* Top Bar Controls */}
              <View style={[styles.cameraTopBar, { paddingTop: insets.top + 10 }]}>
                <Pressable
                  onPress={handleCloseCameraExperience}
                  style={styles.circleIconBtn}
                  hitSlop={12}
                >
                  <Feather name="x" size={22} color="#FFFFFF" />
                </Pressable>

                <View style={styles.cameraTitleBadge}>
                  <MaterialCommunityIcons
                    name={activeCameraMode === "MORNING" ? "weather-sunny" : "weather-sunset"}
                    size={16}
                    color="#FFFFFF"
                  />
                  <Text style={styles.cameraTitleBadgeText}>
                    {activeCameraMode === "MORNING" ? "Morning Camera" : "Evening Camera"}
                  </Text>
                </View>

                <Pressable
                  onPress={() => setTorchOn((prev) => !prev)}
                  style={[styles.circleIconBtn, torchOn && { backgroundColor: "#F59E0B" }]}
                  hitSlop={12}
                >
                  <Feather
                    name={torchOn ? "zap" : "zap-off"}
                    size={20}
                    color="#FFFFFF"
                  />
                </Pressable>
              </View>

              {/* Bottom Shutter Action Bar */}
              <View style={[styles.shutterBar, { paddingBottom: insets.bottom + 20 }]}>
                <Pressable
                  onPress={handleCapturePhoto}
                  disabled={isTakingPhoto || !permission?.granted}
                  style={styles.shutterOuter}
                >
                  <View style={styles.shutterInner}>
                    {isTakingPhoto ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Feather name="camera" size={26} color="#0F172A" />
                    )}
                  </View>
                </Pressable>
                <Text style={styles.shutterHint}>Tap to capture</Text>
              </View>
            </View>
          )}

          {/* STEP 2: PREVIEW WITH RETAKE OR RIGHT / CONFIRM */}
          {cameraStep === "PREVIEW" && capturedPhotoUri && (
            <View style={StyleSheet.absoluteFill}>
              <Image
                source={{ uri: capturedPhotoUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />

              {/* Top Banner */}
              <View style={[styles.cameraTopBar, { paddingTop: insets.top + 10 }]}>
                <View style={styles.cameraTitleBadge}>
                  <Text style={styles.cameraTitleBadgeText}>Photo Preview</Text>
                </View>
                <Pressable
                  onPress={handleCloseCameraExperience}
                  style={styles.circleIconBtn}
                  hitSlop={12}
                >
                  <Feather name="x" size={20} color="#FFFFFF" />
                </Pressable>
              </View>

              {/* Bottom Dual Action Bar: Retake vs Confirm */}
              <View style={[styles.previewActionsBar, { paddingBottom: insets.bottom + 24 }]}>
                <Text style={styles.previewInstruction}>
                  Is this photo clear and ready for the contractor?
                </Text>
                <View style={styles.dualActionRow}>
                  {/* Retake Button */}
                  <Pressable onPress={handleRetake} style={styles.retakeBtn}>
                    <Feather name="refresh-cw" size={18} color="#FFFFFF" />
                    <Text style={styles.retakeBtnText}>Retake</Text>
                  </Pressable>

                  {/* Right / Confirm Button */}
                  <Pressable onPress={handleConfirmPhoto} style={styles.confirmBtn}>
                    <Feather name="check" size={20} color="#FFFFFF" />
                    <Text style={styles.confirmBtnText}>Confirm ✓</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* STEP 3: CONFIRMED PHOTO → SEND TO CONTRACTOR */}
          {(cameraStep === "CONFIRMED" || cameraStep === "UPLOADING" || cameraStep === "ERROR") &&
            capturedPhotoUri && (
              <View style={StyleSheet.absoluteFill}>
                <Image
                  source={{ uri: capturedPhotoUri }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />

                {/* Top Banner */}
                <View style={[styles.cameraTopBar, { paddingTop: insets.top + 10 }]}>
                  <View style={[styles.cameraTitleBadge, { backgroundColor: "#10B981" }]}>
                    <Feather name="check-circle" size={14} color="#FFFFFF" />
                    <Text style={styles.cameraTitleBadgeText}>Photo Confirmed</Text>
                  </View>
                  <Pressable
                    onPress={handleCloseCameraExperience}
                    disabled={cameraStep === "UPLOADING"}
                    style={styles.circleIconBtn}
                    hitSlop={12}
                  >
                    <Feather name="x" size={20} color="#FFFFFF" />
                  </Pressable>
                </View>

                {/* Error Banner if upload failed */}
                {uploadError && (
                  <View style={[styles.modalErrorBanner, { top: insets.top + 60 }]}>
                    <Feather name="alert-triangle" size={18} color="#FFFFFF" />
                    <Text style={styles.modalErrorText}>{uploadError}</Text>
                  </View>
                )}

                {/* Bottom Final Action Bar */}
                <View style={[styles.previewActionsBar, { paddingBottom: insets.bottom + 24 }]}>
                  <View style={styles.dualActionRow}>
                    {/* Retake Option */}
                    <Pressable
                      onPress={handleRetake}
                      disabled={cameraStep === "UPLOADING"}
                      style={[styles.retakeBtn, { flex: 0.4 }]}
                    >
                      <Feather name="rotate-ccw" size={16} color="#FFFFFF" />
                      <Text style={styles.retakeBtnText}>Retake</Text>
                    </Pressable>

                    {/* Send to Contractor Button */}
                    <Pressable
                      onPress={handleSendToContractor}
                      disabled={cameraStep === "UPLOADING"}
                      style={[
                        styles.sendToContractorBtn,
                        cameraStep === "UPLOADING" && { opacity: 0.7 },
                      ]}
                    >
                      {cameraStep === "UPLOADING" ? (
                        <>
                          <ActivityIndicator size="small" color="#FFFFFF" />
                          <Text style={styles.sendToContractorText}>Sending...</Text>
                        </>
                      ) : (
                        <>
                          <Feather name="send" size={18} color="#FFFFFF" />
                          <Text style={styles.sendToContractorText}>
                            {uploadError ? "Retry Send" : "Send to Contractor"}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

          {/* STEP 4: SUCCESS STATE */}
          {cameraStep === "SUCCESS" && (
            <View style={[styles.successOverlay, { backgroundColor: "rgba(15, 23, 42, 0.94)" }]}>
              <View style={styles.successIconCircle}>
                <Feather name="check" size={48} color="#10B981" />
              </View>
              <Text style={styles.successTitle}>Upload Successful!</Text>
              <Text style={styles.successDesc}>
                Photo has been sent to your contractor with GPS verification.
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
  },
  header: {
    marginBottom: 16,
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
    padding: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: 20,
    gap: 12,
  },
  siteIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  siteBannerLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  siteBannerName: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 1,
  },
  siteBannerAddress: {
    fontSize: 11,
    marginTop: 1,
  },
  loadingArea: {
    paddingVertical: 50,
    alignItems: "center",
  },
  cardsWrap: {
    gap: 16,
  },
  photoCard: {
    borderRadius: BorderRadius.xl || 20,
    borderWidth: 1.5,
    padding: 18,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  cardIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  captureBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
  },
  captureBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  submittedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#DCFCE7",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.md,
    alignSelf: "flex-start",
  },
  submittedBadgeText: {
    color: "#15803D",
    fontSize: 13,
    fontWeight: "700",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  errorBannerText: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EF4444",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },

  /* In-App Camera Experience Styles */
  cameraScreenRoot: {
    flex: 1,
    backgroundColor: "#000000",
  },
  cameraTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  circleIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraTitleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  cameraTitleBadgeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  viewfinderFrame: {
    position: "absolute",
    top: "22%",
    left: "10%",
    right: "10%",
    bottom: "28%",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    borderRadius: 16,
  },
  vfCornerTL: {
    position: "absolute",
    top: -2,
    left: -2,
    width: 24,
    height: 24,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: "#FFFFFF",
    borderTopLeftRadius: 16,
  },
  vfCornerTR: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 24,
    height: 24,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: "#FFFFFF",
    borderTopRightRadius: 16,
  },
  vfCornerBL: {
    position: "absolute",
    bottom: -2,
    left: -2,
    width: 24,
    height: 24,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: "#FFFFFF",
    borderBottomLeftRadius: 16,
  },
  vfCornerBR: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: "#FFFFFF",
    borderBottomRightRadius: 16,
  },
  shutterBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 16,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterHint: {
    color: "#CBD5E1",
    fontSize: 12,
    marginTop: 8,
    fontWeight: "600",
  },
  previewActionsBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
  },
  previewInstruction: {
    color: "#F8FAFC",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 14,
  },
  dualActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  retakeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  retakeBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  confirmBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    backgroundColor: "#10B981",
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  sendToContractorBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: BorderRadius.lg,
    backgroundColor: "#2563EB",
  },
  sendToContractorText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  modalErrorBanner: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(220, 38, 38, 0.95)",
    padding: 12,
    borderRadius: 12,
  },
  modalErrorText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  successOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  successIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(16, 185, 129, 0.18)",
    borderWidth: 3,
    borderColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  successDesc: {
    color: "#94A3B8",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  permissionFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  permTitle: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
  },
  permDesc: {
    color: "#94A3B8",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 20,
  },
  permBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  permBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
