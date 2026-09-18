import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { captureLocation } from "@/utils/gps";
import { uploadImageToServer } from "@/utils/upload";
import { siteActivityStorage, WorkerTodayContext } from "@/utils/storage";
import { BorderRadius } from "@/constants/theme";

export default function WorkerCameraUpdateScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [todayContext, setTodayContext] = useState<WorkerTodayContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCapturing, setIsCapturing] = useState<"MORNING" | "EVENING" | null>(null);

  const loadContext = useCallback(async () => {
    try {
      const loc = await captureLocation().catch(() => null);
      const ctx = await siteActivityStorage.getWorkerTodayContext(
        loc ? { latitude: loc.latitude, longitude: loc.longitude } : undefined
      );
      setTodayContext(ctx);
    } catch (err) {
      console.warn("Failed to load worker today context:", err);
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

  const handleCapturePhoto = async (type: "MORNING" | "EVENING") => {
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

    setIsCapturing(type);

    try {
      // 1. Mandatory GPS Location check
      let location = await captureLocation().catch(() => null);
      if (!location || !location.latitude || !location.longitude) {
        Alert.alert(
          "Location Required",
          "Location permission is required to capture this work photo. Please enable location services in your device settings."
        );
        setIsCapturing(null);
        return;
      }

      // 2. Camera Permission check
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Camera Permission Required",
          "Camera permission is required to capture work proof photos."
        );
        setIsCapturing(null);
        return;
      }

      // 3. Launch Camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.7,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setIsCapturing(null);
        return;
      }

      const localUri = result.assets[0].uri;
      if (!localUri) {
        setIsCapturing(null);
        return;
      }

      // 4. Upload photo to server
      const uploadedUrl = await uploadImageToServer(localUri);

      // 5. Submit work update to backend
      const activityType = isMorning ? "MORNING_WORK" : "EVENING_WORK";
      const clientRequestId = `${user?.id || "worker"}_${type}_${new Date().toISOString().split("T")[0]}`;

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

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_) {}

      Alert.alert(
        "Upload Successful",
        `${isMorning ? "Morning" : "Evening"} photo uploaded successfully.`
      );

      // Refresh context
      await loadContext();
    } catch (err: any) {
      console.warn("Work photo capture error:", err);
      Alert.alert(
        "Upload Error",
        err?.message || "Failed to upload photo. Please check your internet connection and try again."
      );
    } finally {
      setIsCapturing(null);
    }
  };

  const cardBg = isDark ? "#1E293B" : "#FFFFFF";
  const borderCol = isDark ? "#334155" : "#E2E8F0";

  const morningSubmitted = todayContext?.workUpdates?.morning?.submitted;
  const morningTime = todayContext?.workUpdates?.morning?.time;

  const eveningSubmitted = todayContext?.workUpdates?.evening?.submitted;
  const eveningTime = todayContext?.workUpdates?.evening?.time;

  return (
    <ScrollView
      style={[
        styles.container,
        {
          backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
          paddingTop: insets.top + 16,
        },
      ]}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingBottom: insets.bottom + 100 },
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
          📸 Work Photos
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
            {activeSite?.name || "Detecting Site..."}
          </Text>
          {activeSite?.address && (
            <Text
              numberOfLines={1}
              style={[
                styles.siteBannerAddress,
                { color: isDark ? "#64748B" : "#94A3B8" },
              ]}
            >
              {activeSite.address}
            </Text>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <View style={styles.cardsWrap}>
          {/* 1. MORNING WORK PHOTO CARD */}
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
                  size={24}
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
                  Morning Work
                </Text>
                <Text
                  style={[
                    styles.cardSubtitle,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  {morningSubmitted
                    ? `✓ Morning Photo Uploaded${morningTime ? ` • ${morningTime}` : ""}`
                    : "Take today's morning site photo"}
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
                onPress={() => handleCapturePhoto("MORNING")}
                disabled={isCapturing !== null}
                style={[
                  styles.captureBtn,
                  { backgroundColor: "#F59E0B" },
                  isCapturing === "MORNING" && styles.btnDisabled,
                ]}
              >
                {isCapturing === "MORNING" ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="camera" size={18} color="#FFFFFF" />
                    <Text style={styles.captureBtnText}>
                      Capture Morning Photo
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>

          {/* 2. EVENING WORK PHOTO CARD */}
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
                  size={24}
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
                  Evening Work
                </Text>
                <Text
                  style={[
                    styles.cardSubtitle,
                    { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  {eveningSubmitted
                    ? `✓ Evening Photo Uploaded${eveningTime ? ` • ${eveningTime}` : ""}`
                    : "Take today's completed-work photo"}
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
                onPress={() => handleCapturePhoto("EVENING")}
                disabled={isCapturing !== null}
                style={[
                  styles.captureBtn,
                  { backgroundColor: "#3B82F6" },
                  isCapturing === "EVENING" && styles.btnDisabled,
                ]}
              >
                {isCapturing === "EVENING" ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="camera" size={18} color="#FFFFFF" />
                    <Text style={styles.captureBtnText}>
                      Capture Evening Photo
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        </View>
      )}
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
  btnDisabled: {
    opacity: 0.7,
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
});
