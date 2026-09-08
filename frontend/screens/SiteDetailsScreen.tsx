import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  TextInput,
  Image,
  Text,
  Linking,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { storage, Site } from "@/utils/storage";
import { uploadImageToServer } from "@/utils/upload";
import { captureLocation, requestLocationPermission } from "@/utils/gps";

const WORK_CATEGORIES = [
  { key: "Brick Work", label: "Brick Work", icon: "🧱", color: "#F97316" },
  { key: "Plaster", label: "Plaster", icon: "🏗️", color: "#3B82F6" },
  { key: "Painting", label: "Painting", icon: "🎨", color: "#A855F7" },
  { key: "Electrician", label: "Electrician", icon: "⚡", color: "#EAB308" },
  { key: "Concrete", label: "Concrete", icon: "🧱", color: "#64748B" },
];

const UNIT_OPTIONS = ["Bags", "Tons", "Bricks", "Trips", "Liters", "Brass", "Pcs"];

export default function SiteDetailsScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const { siteId } = route.params || {};

  const userRole = user?.role || "supervisor";
  const isContractorOrAdmin = userRole === "contractor" || userRole === "admin" || userRole === "builder";

  // Data States
  const [site, setSite] = useState<Site | null>(null);
  const [updates, setUpdates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  // Modal Visibility States (work | material | photo | gps | issue)
  const [activeModal, setActiveModal] = useState<"work" | "material" | "photo" | "gps" | "issue" | null>(null);

  // Work-wise Dashboard Navigation State inside Daily Site Logs
  const [selectedWorkCategory, setSelectedWorkCategory] = useState<string | null>(null);
  const [showAddUpdateSheet, setShowAddUpdateSheet] = useState(false);

  // Form Fields - Work
  const [progressPercent, setProgressPercent] = useState("");
  const [workNotes, setWorkNotes] = useState("");

  // Form Fields - Material
  const [materialName, setMaterialName] = useState("");
  const [materialQty, setMaterialQty] = useState("");
  const [materialUnit, setMaterialUnit] = useState("Bags");
  const [materialNotes, setMaterialNotes] = useState("");

  // Form Fields - Photos (Separated Morning & Evening)
  const [morningPhotoUri, setMorningPhotoUri] = useState<string>("");
  const [morningPhotoTime, setMorningPhotoTime] = useState<string>("");
  const [morningPhotoNotes, setMorningPhotoNotes] = useState<string>("");

  const [eveningPhotoUri, setEveningPhotoUri] = useState<string>("");
  const [eveningPhotoTime, setEveningPhotoTime] = useState<string>("");
  const [eveningPhotoNotes, setEveningPhotoNotes] = useState<string>("");
  const [isPhotoPicking, setIsPhotoPicking] = useState(false);

  // Form Fields - GPS
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsAddress, setGpsAddress] = useState("");
  const [isFetchingGps, setIsFetchingGps] = useState(false);

  // Form Fields - Issues
  const [issueDescription, setIssueDescription] = useState("");
  const [issuePriority, setIssuePriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [issueStatus, setIssueStatus] = useState<"Open" | "Resolved">("Open");

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleMakeCall = (phoneNumber: string) => {
    if (!phoneNumber) {
      Alert.alert("Notice", "Phone number not available.");
      return;
    }
    const cleanNumber = phoneNumber.replace(/[^0-9+]/g, "");
    Linking.openURL(`tel:${cleanNumber}`).catch(() => {
      Alert.alert("Error", `Unable to place phone call to ${phoneNumber}.`);
    });
  };

  const loadData = async () => {
    if (!siteId) return;
    setIsLoading(true);
    try {
      const siteDetails = await storage.getSiteById(siteId);
      if (siteDetails) {
        setSite(siteDetails);
      } else {
        Alert.alert("Error", "Site details could not be found");
        navigation.goBack();
        return;
      }

      const updatesList = await storage.getSiteUpdates(siteId);
      setUpdates(updatesList || []);
    } catch (e) {
      console.warn("Failed to load site details and history", e);
      Alert.alert("Error", "Failed to retrieve site configuration.");
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [siteId])
  );

  const handleCreateUpdate = async (type: string, data: any) => {
    triggerHaptic();
    setIsActionSubmitting(true);
    try {
      const newUpdate = await storage.createSiteUpdate(siteId, {
        type,
        ...data
      });

      if (newUpdate) {
        setUpdates(prev => [newUpdate, ...prev]);

        setSite(prev => {
          if (!prev) return null;
          const updatedSite = { ...prev };
          updatedSite.lastUpdateAt = newUpdate.timestamp;
          updatedSite.lastUpdatedBy = newUpdate.updatedBy;
          updatedSite.lastUpdateType = type;
          
          if (type === "work") {
            if (newUpdate.workType) updatedSite.currentWork = newUpdate.workType;
            if (newUpdate.progressPercent !== undefined) updatedSite.currentProgress = newUpdate.progressPercent;
          }
          return updatedSite;
        });

        Alert.alert("Success", "Update logged successfully.");
        setShowAddUpdateSheet(false);
        resetFormFields();
      } else {
        Alert.alert("Error", "Failed to log update. Please check connection.");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to submit update.");
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const resetFormFields = () => {
    setWorkNotes("");
    setProgressPercent("");
    
    setMaterialName("");
    setMaterialQty("");
    setMaterialNotes("");
    
    setMorningPhotoUri("");
    setMorningPhotoTime("");
    setMorningPhotoNotes("");
    
    setEveningPhotoUri("");
    setEveningPhotoTime("");
    setEveningPhotoNotes("");
    
    setGpsCoords(null);
    setGpsAddress("");
    
    setIssueDescription("");
    setIssuePriority("Medium");
    setIssueStatus("Open");
  };

  // Helper functions for Work Categories Data
  const getWorkCategoryProgress = (workKey: string) => {
    const catUpdates = updates.filter(u => u.type === "work" && u.workType === workKey);
    if (catUpdates.length > 0) {
      return catUpdates[0].progressPercent || 0;
    }
    if (site?.currentWork === workKey) {
      return site.currentProgress || 0;
    }
    return 0;
  };

  const getWorkCategoryStatus = (workKey: string) => {
    const catUpdates = updates.filter(u => u.type === "work" && u.workType === workKey);
    if (catUpdates.length > 0) {
      const latestDate = new Date(catUpdates[0].timestamp);
      const today = new Date();
      const isToday =
        latestDate.getDate() === today.getDate() &&
        latestDate.getMonth() === today.getMonth() &&
        latestDate.getFullYear() === today.getFullYear();
      return isToday ? "Updated Today" : `Updated ${latestDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`;
    }
    return "Not Updated";
  };

  const getWorkCategoryHistory = (workKey: string) => {
    return updates.filter(u => u.type === "work" && u.workType === workKey);
  };

  // Image Selection and Upload handler for Morning/Evening
  const handlePickPhotoSection = async (section: "morning" | "evening", useCamera = false) => {
    triggerHaptic();
    const permissionResult = useCamera 
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert("Permission Denied", "Camera/Gallery access is required to add photos.");
      return;
    }

    setIsPhotoPicking(true);
    try {
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: true });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const localUri = result.assets[0].uri;
        const uploadedUrl = await uploadImageToServer(localUri);
        if (uploadedUrl) {
          const timeNow = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
          if (section === "morning") {
            setMorningPhotoUri(uploadedUrl);
            setMorningPhotoTime(timeNow);
          } else {
            setEveningPhotoUri(uploadedUrl);
            setEveningPhotoTime(timeNow);
          }
        }
      }
    } catch (e) {
      console.warn("Failed to capture or upload image", e);
      Alert.alert("Error", "Image upload failed. Please try again.");
    } finally {
      setIsPhotoPicking(false);
    }
  };

  // GPS Coordinates capture handler
  const handleCaptureGps = async () => {
    triggerHaptic();
    setIsFetchingGps(true);
    try {
      const permission = await requestLocationPermission();
      if (permission !== "granted") {
        Alert.alert("Permission Denied", "GPS access is required.");
        setIsFetchingGps(false);
        return;
      }

      const location = await captureLocation();
      if (location) {
        setGpsCoords({
          latitude: location.latitude,
          longitude: location.longitude
        });
        setGpsAddress(`Lat: ${location.latitude.toFixed(5)}, Long: ${location.longitude.toFixed(5)}`);
      } else {
        Alert.alert("GPS Error", "Failed to resolve coordinates. Try again.");
      }
    } catch (e) {
      console.warn("GPS fetching failed", e);
    } finally {
      setIsFetchingGps(false);
    }
  };

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.loadingCenter, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  if (!site) return null;

  const supervisorName = typeof site.supervisor === "object" ? site.supervisor?.name : (site.supervisor || "Ramesh");
  const supervisorPhone = typeof site.supervisor === "object" ? site.supervisor?.phone : (site as any).supervisorPhone;
  const todayDateFormatted = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  // Calculate stats for Today's Summary
  const workUpdatedCount = WORK_CATEGORIES.filter(cat => {
    const catUpdates = updates.filter(u => u.type === "work" && u.workType === cat.key);
    if (catUpdates.length > 0) {
      const latestDate = new Date(catUpdates[0].timestamp);
      const today = new Date();
      return latestDate.getDate() === today.getDate() &&
             latestDate.getMonth() === today.getMonth() &&
             latestDate.getFullYear() === today.getFullYear();
    }
    return false;
  }).length;

  const latestPhotoUpdate = updates.find(u => u.type === "photo");
  const morningUploaded = Boolean(morningPhotoUri || latestPhotoUpdate?.morningPhoto || (latestPhotoUpdate?.photoUris && latestPhotoUpdate.photoUris.length > 0));
  const eveningUploaded = Boolean(eveningPhotoUri || latestPhotoUpdate?.eveningPhoto || (latestPhotoUpdate?.photoUris && latestPhotoUpdate.photoUris.length > 1));

  const latestWorkUpdate = updates.find(u => u.type === "work");
  const lastUpdatedTimeStr = latestWorkUpdate?.timestamp
    ? new Date(latestWorkUpdate.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : "6:12 PM";

  const latestMaterialUpdate = updates.find(u => u.type === "material");
  const lastMaterialSummary = latestMaterialUpdate
    ? `${latestMaterialUpdate.materialName} — ${latestMaterialUpdate.materialQty} ${latestMaterialUpdate.materialUnit}`
    : "Cement — 20 Bags";

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* 1. COMPACT HEADER */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1, paddingHorizontal: 10 }}>
          <ThemedText style={styles.headerControlTitle}>Site Control</ThemedText>
          <ThemedText numberOfLines={1} style={styles.headerSiteTitle}>{site.name}</ThemedText>
        </View>
        
        <View style={styles.statusBadgeActive}>
          <Text style={styles.statusDotActive}>●</Text>
          <Text style={styles.statusTextActive}>Active</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* 2. SITE INFORMATION CARD */}
        <View style={[styles.card, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <ThemedText style={styles.cardHeaderTitle}>SITE INFORMATION</ThemedText>
          <View style={styles.infoRowBlock}>
            <ThemedText style={styles.infoLabelText}>Site Name</ThemedText>
            <ThemedText style={styles.infoValueText}>{site.name}</ThemedText>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.infoRowBlock}>
            <ThemedText style={styles.infoLabelText}>Site Address</ThemedText>
            <ThemedText style={styles.infoValueText}>{site.address || (site as any).location || "Not specified"}</ThemedText>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.infoRowWithAction}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.infoLabelText}>Supervisor / Site Contact</ThemedText>
              <ThemedText style={styles.infoValueText}>{supervisorName}</ThemedText>
            </View>
            <Pressable onPress={() => handleMakeCall(supervisorPhone || "9876543210")} style={[styles.callActionBtn, { backgroundColor: "#2563EB" }]}>
              <Feather name="phone-call" size={14} color="#FFFFFF" />
              <Text style={styles.callActionBtnText}>Call</Text>
            </Pressable>
          </View>
        </View>

        {/* 3. TODAY'S SITE SUMMARY */}
        <View style={[styles.card, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <ThemedText style={styles.cardHeaderTitle}>TODAY'S SITE SUMMARY</ThemedText>
            <Text style={[styles.todayDateBadge, { color: theme.textSecondary }]}>{todayDateFormatted}</Text>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <ThemedText style={{ fontSize: 14, fontWeight: "700" }}>Overall Progress</ThemedText>
            <ThemedText style={{ fontSize: 24, fontWeight: "900", color: theme.primary }}>{site.currentProgress || 65}%</ThemedText>
          </View>

          <View style={[styles.largeProgressBarBg, { backgroundColor: isDark ? "#334155" : "#F1F5F9" }]}>
            <View style={[styles.largeProgressBarFill, { width: `${site.currentProgress || 65}%`, backgroundColor: theme.primary }]} />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border, marginVertical: 14 }]} />

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <ThemedText style={styles.summarySubLabel}>Work Updated</ThemedText>
              <ThemedText style={styles.summarySubVal}>{workUpdatedCount} / 5</ThemedText>
            </View>

            <View style={{ alignItems: "flex-end" }}>
              <ThemedText style={styles.summarySubLabel}>Photos</ThemedText>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 2 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: morningUploaded ? "#16A34A" : "#64748B" }}>
                  Morning {morningUploaded ? "✓" : "○"}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: eveningUploaded ? "#16A34A" : "#64748B" }}>
                  Evening {eveningUploaded ? "✓" : "○"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 4. DAILY SITE LOGS — MAIN FEATURE */}
        <View style={[styles.card, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <ThemedText style={styles.cardHeaderTitle}>DAILY SITE LOGS</ThemedText>
            <View style={{ backgroundColor: "rgba(37,99,235,0.1)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: "#2563EB" }}>MAIN FEATURE</Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 8 }}>
            <View>
              <ThemedText style={{ fontSize: 12, color: "#64748B", fontWeight: "600" }}>Today's Work Progress</ThemedText>
              <ThemedText style={{ fontSize: 20, fontWeight: "800" }}>{site.currentProgress || 65}%</ThemedText>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <ThemedText style={{ fontSize: 12, color: "#64748B", fontWeight: "600" }}>Last Updated</ThemedText>
              <ThemedText style={{ fontSize: 14, fontWeight: "700" }}>{lastUpdatedTimeStr}</ThemedText>
            </View>
          </View>

          <Pressable
            onPress={() => {
              triggerHaptic();
              setSelectedWorkCategory(null);
              setActiveModal("work");
            }}
            style={[styles.openMainBtn, { backgroundColor: theme.primary }]}
          >
            <Text style={styles.openMainBtnText}>Open Daily Site Logs</Text>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* 5. QUICK ACTIONS */}
        <ThemedText style={styles.sectionTitle}>QUICK ACTIONS</ThemedText>
        <View style={styles.quickGridContainer}>
          <Pressable onPress={() => { triggerHaptic(); setSelectedWorkCategory(null); setActiveModal("work"); }} style={[styles.quickCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <Text style={{ fontSize: 22 }}>🧱</Text>
            <Text style={[styles.quickCardText, { color: theme.text }]}>Daily Logs</Text>
          </Pressable>

          <Pressable onPress={() => { triggerHaptic(); setActiveModal("material"); }} style={[styles.quickCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <Text style={{ fontSize: 22 }}>📦</Text>
            <Text style={[styles.quickCardText, { color: theme.text }]}>Materials</Text>
          </Pressable>

          <Pressable onPress={() => { triggerHaptic(); setActiveModal("photo"); }} style={[styles.quickCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <Text style={{ fontSize: 22 }}>📷</Text>
            <Text style={[styles.quickCardText, { color: theme.text }]}>Photos</Text>
          </Pressable>

          <Pressable onPress={() => { triggerHaptic(); setActiveModal("gps"); }} style={[styles.quickCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <Text style={{ fontSize: 22 }}>📍</Text>
            <Text style={[styles.quickCardText, { color: theme.text }]}>GPS</Text>
          </Pressable>

          <Pressable onPress={() => { triggerHaptic(); setActiveModal("issue"); }} style={[styles.quickCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <Text style={{ fontSize: 22 }}>⚠️</Text>
            <Text style={[styles.quickCardText, { color: theme.text }]}>Issues</Text>
          </Pressable>
        </View>

        {/* 6. MATERIALS CARD */}
        <View style={[styles.card, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <ThemedText style={styles.cardHeaderTitle}>MATERIALS</ThemedText>
          <ThemedText style={{ fontSize: 13, color: "#64748B", marginTop: 4, marginBottom: 12 }}>
            Last Update: <Text style={{ fontWeight: "800", color: theme.text }}>{lastMaterialSummary}</Text>
          </ThemedText>
          <Pressable onPress={() => { triggerHaptic(); setActiveModal("material"); }} style={[styles.outlineActionBtn, { borderColor: theme.primary }]}>
            <Text style={[styles.outlineActionBtnText, { color: theme.primary }]}>Open Materials</Text>
          </Pressable>
        </View>

        {/* 7. SITE PHOTOS CARD */}
        <View style={[styles.card, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <ThemedText style={styles.cardHeaderTitle}>SITE PHOTOS</ThemedText>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginVertical: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Feather name={morningUploaded ? "check-circle" : "clock"} size={16} color={morningUploaded ? "#16A34A" : "#64748B"} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text }}>Morning</Text>
              <Text style={{ fontSize: 12, color: morningUploaded ? "#16A34A" : "#64748B", fontWeight: "700" }}>
                {morningUploaded ? "✓ Uploaded" : "Pending"}
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Feather name={eveningUploaded ? "check-circle" : "clock"} size={16} color={eveningUploaded ? "#16A34A" : "#64748B"} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text }}>Evening</Text>
              <Text style={{ fontSize: 12, color: eveningUploaded ? "#16A34A" : "#64748B", fontWeight: "700" }}>
                {eveningUploaded ? "✓ Uploaded" : "Pending"}
              </Text>
            </View>
          </View>

          <Pressable onPress={() => { triggerHaptic(); setActiveModal("photo"); }} style={[styles.outlineActionBtn, { borderColor: theme.primary }]}>
            <Text style={[styles.outlineActionBtnText, { color: theme.primary }]}>Open Photos</Text>
          </Pressable>
        </View>

        {/* 8. SITE LOCATION / GPS CARD */}
        <View style={[styles.card, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <ThemedText style={styles.cardHeaderTitle}>SITE LOCATION</ThemedText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 8 }}>
            <Feather name="map-pin" size={16} color="#EF4444" />
            <ThemedText numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: "600" }}>
              {site.address || (site as any).location || "Location recorded"}
            </ThemedText>
          </View>
          <Pressable onPress={() => { triggerHaptic(); setActiveModal("gps"); }} style={[styles.outlineActionBtn, { borderColor: theme.primary }]}>
            <Text style={[styles.outlineActionBtnText, { color: theme.primary }]}>View Location</Text>
          </Pressable>
        </View>

        {/* 9. ISSUES + EMERGENCY CONTACTS CARD */}
        <View style={[styles.card, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <ThemedText style={styles.cardHeaderTitle}>ISSUES</ThemedText>
          <Pressable onPress={() => { triggerHaptic(); setActiveModal("issue"); }} style={[styles.outlineActionBtn, { borderColor: "#DC2626", marginVertical: 10 }]}>
            <Feather name="alert-triangle" size={16} color="#DC2626" style={{ marginRight: 6 }} />
            <Text style={[styles.outlineActionBtnText, { color: "#DC2626" }]}>Report Issue</Text>
          </Pressable>

          <View style={[styles.divider, { backgroundColor: theme.border, marginVertical: 12 }]} />

          <ThemedText style={styles.emergencyHeaderTitle}>EMERGENCY CONTACTS</ThemedText>
          <View style={styles.emergencyCardRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 18 }}>🚨</Text>
              <View>
                <Text style={{ fontWeight: "800", color: theme.text }}>Police</Text>
                <Text style={{ fontSize: 12, color: "#64748B" }}>Dial 100</Text>
              </View>
            </View>
            <Pressable onPress={() => handleMakeCall("100")} style={[styles.callActionBtn, { backgroundColor: "#DC2626" }]}>
              <Feather name="phone" size={14} color="#FFFFFF" />
              <Text style={styles.callActionBtnText}>Call</Text>
            </Pressable>
          </View>

          <View style={[styles.emergencyCardRow, { marginTop: 10 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 18 }}>🚑</Text>
              <View>
                <Text style={{ fontWeight: "800", color: theme.text }}>Ambulance</Text>
                <Text style={{ fontSize: 12, color: "#64748B" }}>Dial 108</Text>
              </View>
            </View>
            <Pressable onPress={() => handleMakeCall("108")} style={[styles.callActionBtn, { backgroundColor: "#16A34A" }]}>
              <Feather name="phone" size={14} color="#FFFFFF" />
              <Text style={styles.callActionBtnText}>Call</Text>
            </Pressable>
          </View>
        </View>

      </ScrollView>

      {/* ─── MODAL 1: WORK-WISE DAILY SITE LOGS DASHBOARD & DEDICATED SCREENS ─── */}
      <Modal visible={activeModal === "work"} animationType="slide" transparent={false}>
        <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
          {/* HEADER */}
          <View style={[styles.header, { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
            <Pressable
              onPress={() => {
                if (selectedWorkCategory !== null) {
                  setSelectedWorkCategory(null);
                } else {
                  setActiveModal(null);
                }
              }}
              style={styles.backBtn}
            >
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
            <View style={{ flex: 1, paddingHorizontal: 10 }}>
              <ThemedText numberOfLines={1} style={styles.headerTitle}>
                {selectedWorkCategory !== null ? `${selectedWorkCategory} Site Logs` : "Daily Site Logs"}
              </ThemedText>
              <ThemedText numberOfLines={1} style={styles.headerSubtitle}>
                {site.name} • {todayDateFormatted}
              </ThemedText>
            </View>
            <Pressable onPress={() => setActiveModal(null)} style={styles.backBtn}>
              <Feather name="x" size={22} color={theme.text} />
            </Pressable>
          </View>

          {/* VIEW A: DAILY SITE LOGS DASHBOARD (WHEN selectedWorkCategory === null) */}
          {selectedWorkCategory === null && (
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* OVERALL SITE PROGRESS SUMMARY BOX */}
              <View style={[styles.card, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <ThemedText style={styles.summaryBoxHeaderTitle}>Today's Site Progress</ThemedText>
                
                {WORK_CATEGORIES.map((cat) => {
                  const pct = getWorkCategoryProgress(cat.key);
                  return (
                    <View key={cat.key} style={styles.summaryProgressRow}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, width: 140 }}>
                        <Text style={{ fontSize: 16 }}>{cat.icon}</Text>
                        <ThemedText style={styles.summaryProgressLabel}>{cat.label}</ThemedText>
                      </View>
                      <View style={[styles.summaryProgressBarBg, { backgroundColor: isDark ? "#334155" : "#F1F5F9" }]}>
                        <View style={[styles.summaryProgressBarFill, { width: `${pct}%`, backgroundColor: cat.color }]} />
                      </View>
                      <Text style={[styles.summaryProgressPctText, { color: cat.color }]}>{pct}%</Text>
                    </View>
                  );
                })}
              </View>

              {/* INDIVIDUAL WORK CARDS GRID */}
              <ThemedText style={styles.sectionTitle}>Work Categories</ThemedText>
              <View style={{ gap: 12 }}>
                {WORK_CATEGORIES.map((cat) => {
                  const pct = getWorkCategoryProgress(cat.key);
                  const status = getWorkCategoryStatus(cat.key);
                  const isUpdatedToday = status === "Updated Today";

                  return (
                    <Pressable
                      key={cat.key}
                      onPress={() => {
                        triggerHaptic();
                        setSelectedWorkCategory(cat.key);
                        setProgressPercent(pct > 0 ? String(pct) : "");
                      }}
                      style={({ pressed }) => [
                        styles.workCategoryCard,
                        {
                          backgroundColor: theme.backgroundDefault,
                          borderColor: theme.border,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <View style={[styles.workCategoryIconCircle, { backgroundColor: `${cat.color}15` }]}>
                          <Text style={{ fontSize: 24 }}>{cat.icon}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.workCategoryTitle}>{cat.label}</ThemedText>
                          <ThemedText style={styles.workCategorySubText}>
                            Current Progress: <Text style={{ fontWeight: "800", color: cat.color }}>{pct}%</Text>
                          </ThemedText>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 4 }}>
                          <View
                            style={[
                              styles.workStatusBadge,
                              { backgroundColor: isUpdatedToday ? "rgba(22,163,74,0.12)" : "rgba(100,116,139,0.12)" },
                            ]}
                          >
                            <Text
                              style={[
                                styles.workStatusBadgeText,
                                { color: isUpdatedToday ? "#16A34A" : "#64748B" },
                              ]}
                            >
                              {status}
                            </Text>
                          </View>
                          <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {/* VIEW B: DEDICATED WORK SITE LOGS SCREEN (e.g. BRICK WORK SITE LOGS) */}
          {selectedWorkCategory !== null && (
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* TODAY'S PROGRESS CARD */}
              <View style={[styles.card, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Text style={{ fontSize: 28 }}>
                      {WORK_CATEGORIES.find((c) => c.key === selectedWorkCategory)?.icon || "🧱"}
                    </Text>
                    <View>
                      <ThemedText style={styles.dedicatedWorkTitle}>{selectedWorkCategory}</ThemedText>
                      <ThemedText style={styles.dedicatedWorkSub}>Today's Progress</ThemedText>
                    </View>
                  </View>
                  <Text style={[styles.dedicatedWorkPct, { color: WORK_CATEGORIES.find((c) => c.key === selectedWorkCategory)?.color || theme.primary }]}>
                    {getWorkCategoryProgress(selectedWorkCategory)}%
                  </Text>
                </View>

                {/* VISUAL PROGRESS BAR */}
                <View style={[styles.largeProgressBarBg, { backgroundColor: isDark ? "#334155" : "#F1F5F9" }]}>
                  <View
                    style={[
                      styles.largeProgressBarFill,
                      {
                        width: `${getWorkCategoryProgress(selectedWorkCategory)}%`,
                        backgroundColor: WORK_CATEGORIES.find((c) => c.key === selectedWorkCategory)?.color || theme.primary,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* + ADD DAILY UPDATE BUTTON */}
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  const currentPct = getWorkCategoryProgress(selectedWorkCategory);
                  setProgressPercent(currentPct > 0 ? String(currentPct) : "");
                  setWorkNotes("");
                  setShowAddUpdateSheet(true);
                }}
                style={[styles.addDailyUpdateBtn, { backgroundColor: theme.primary }]}
              >
                <Feather name="plus-circle" size={20} color="#FFFFFF" />
                <Text style={styles.addDailyUpdateBtnText}>+ Add Daily Update</Text>
              </Pressable>

              {/* RECENT DAILY LOGS FOR THIS WORK CATEGORY */}
              <ThemedText style={styles.sectionTitle}>RECENT DAILY LOGS</ThemedText>
              <View style={[styles.card, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                {getWorkCategoryHistory(selectedWorkCategory).length === 0 ? (
                  <View style={{ paddingVertical: 20, alignItems: "center" }}>
                    <Feather name="clock" size={32} color={theme.textSecondary} style={{ opacity: 0.5, marginBottom: 8 }} />
                    <ThemedText style={{ color: theme.textSecondary, fontWeight: "600" }}>
                      No daily logs recorded for {selectedWorkCategory} yet.
                    </ThemedText>
                  </View>
                ) : (
                  getWorkCategoryHistory(selectedWorkCategory).map((item, idx) => {
                    const itemDate = new Date(item.timestamp).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });
                    const updaterName = typeof item.updatedBy === "object" ? item.updatedBy?.name : "Supervisor";

                    return (
                      <View key={item._id || idx} style={styles.historyItemRow}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <Text style={styles.historyDateText}>{itemDate}</Text>
                            <View style={[styles.historyPctBadge, { backgroundColor: "rgba(37,99,235,0.1)" }]}>
                              <Text style={styles.historyPctText}>Progress: {item.progressPercent}%</Text>
                            </View>
                          </View>
                          <Text style={[styles.historyNotesText, { color: isDark ? "#CBD5E1" : "#334155" }]}>
                            "{item.workNotes || "Daily progress update logged."}"
                          </Text>
                          <Text style={styles.historyUpdaterText}>Logged by {updaterName}</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </ScrollView>
          )}
        </ThemedView>

        {/* BOTTOM SHEET FOR ADDING WORK CATEGORY UPDATE */}
        <Modal visible={showAddUpdateSheet} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>
                  Add {selectedWorkCategory} Update
                </ThemedText>
                <Pressable onPress={() => setShowAddUpdateSheet(false)} style={styles.modalCloseBtn}>
                  <Feather name="x" size={20} color={theme.text} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.modalScroll}>
                <ThemedText style={styles.label}>Date</ThemedText>
                <View style={[styles.readOnlyDateBox, { backgroundColor: isDark ? "#0F172A" : "#F1F5F9", borderColor: theme.border }]}>
                  <Feather name="calendar" size={16} color={theme.textSecondary} />
                  <Text style={[styles.readOnlyDateText, { color: theme.text }]}>
                    Today ({todayDateFormatted})
                  </Text>
                </View>

                <ThemedText style={styles.label}>Work Progress (%) *</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? "#0F172A" : "#F8FAFC", borderColor: theme.border, color: theme.text }]}
                  keyboardType="numeric"
                  maxLength={3}
                  placeholder="e.g. 65"
                  placeholderTextColor={theme.textSecondary}
                  value={progressPercent}
                  onChangeText={setProgressPercent}
                />

                <ThemedText style={styles.label}>Notes</ThemedText>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: isDark ? "#0F172A" : "#F8FAFC", borderColor: theme.border, color: theme.text }]}
                  multiline
                  numberOfLines={3}
                  placeholder="What was completed today?"
                  placeholderTextColor={theme.textSecondary}
                  value={workNotes}
                  onChangeText={setWorkNotes}
                />

                <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
                  <Pressable
                    disabled={isActionSubmitting}
                    onPress={() => setShowAddUpdateSheet(false)}
                    style={[styles.cancelModalBtn, { borderColor: theme.border }]}
                  >
                    <Text style={[styles.cancelModalBtnText, { color: isDark ? "#CBD5E1" : "#475569" }]}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      const pct = parseInt(progressPercent);
                      if (isNaN(pct) || pct < 0 || pct > 100) {
                        Alert.alert("Validation Error", "Please specify progress percentage between 0 and 100.");
                        return;
                      }
                      handleCreateUpdate("work", {
                        workType: selectedWorkCategory,
                        progressPercent: pct,
                        workNotes: workNotes.trim(),
                      });
                    }}
                    disabled={isActionSubmitting}
                    style={[styles.submitModalBtn, { backgroundColor: theme.primary }]}
                  >
                    {isActionSubmitting ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={styles.submitModalBtnText}>Save Update</Text>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </Modal>

      {/* ─── MODAL 2: MATERIALS ─── */}
      <Modal visible={activeModal === "material"} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>📦 Material Section</ThemedText>
              <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <ThemedText style={styles.label}>Material Name</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: isDark ? "#0F172A" : "#F8FAFC", borderColor: theme.border, color: theme.text }]}
                placeholder="e.g. Cement"
                placeholderTextColor={theme.textSecondary}
                value={materialName}
                onChangeText={setMaterialName}
              />

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.label}>Quantity</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: isDark ? "#0F172A" : "#F8FAFC", borderColor: theme.border, color: theme.text }]}
                    keyboardType="numeric"
                    placeholder="e.g. 20"
                    placeholderTextColor={theme.textSecondary}
                    value={materialQty}
                    onChangeText={setMaterialQty}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.label}>Unit</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: isDark ? "#0F172A" : "#F8FAFC", borderColor: theme.border, color: theme.text }]}
                    placeholder="e.g. Bags"
                    placeholderTextColor={theme.textSecondary}
                    value={materialUnit}
                    onChangeText={setMaterialUnit}
                  />
                </View>
              </View>

              {/* Quick Unit Chips */}
              <View style={styles.unitChipGrid}>
                {UNIT_OPTIONS.map((unit) => {
                  const isSelected = materialUnit.toLowerCase() === unit.toLowerCase();
                  return (
                    <Pressable
                      key={unit}
                      onPress={() => setMaterialUnit(unit)}
                      style={[
                        styles.unitChip,
                        { borderColor: theme.border },
                        isSelected && { backgroundColor: theme.primary, borderColor: theme.primary }
                      ]}
                    >
                      <Text style={[styles.unitChipText, { color: isSelected ? "#FFFFFF" : (isDark ? "#CBD5E1" : "#475569") }]}>
                        {unit}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <ThemedText style={styles.label}>Notes</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: isDark ? "#0F172A" : "#F8FAFC", borderColor: theme.border, color: theme.text }]}
                multiline
                numberOfLines={2}
                placeholder="Required for slab work"
                placeholderTextColor={theme.textSecondary}
                value={materialNotes}
                onChangeText={setMaterialNotes}
              />

              <Pressable
                onPress={() => {
                  const qty = parseFloat(materialQty);
                  if (!materialName.trim()) {
                    Alert.alert("Validation Error", "Please provide a material name.");
                    return;
                  }
                  if (isNaN(qty) || qty <= 0) {
                    Alert.alert("Validation Error", "Please provide a valid quantity.");
                    return;
                  }
                  handleCreateUpdate("material", {
                    materialName: materialName.trim(),
                    materialQty: qty,
                    materialUnit: materialUnit.trim(),
                    materialNotes: materialNotes.trim()
                  });
                }}
                disabled={isActionSubmitting}
                style={[styles.submitBtn, { backgroundColor: theme.primary, marginTop: 10 }]}
              >
                {isActionSubmitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <ThemedText style={styles.submitBtnText}>Save Log</ThemedText>
                )}
              </Pressable>

              {/* DISABLED FUTURE HARDWARE SHOP INTEGRATION */}
              <View style={styles.futureHardwareBox}>
                <Pressable disabled={true} style={styles.disabledHardwareBtn}>
                  <Feather name="shopping-bag" size={16} color="#94A3B8" />
                  <Text style={styles.disabledHardwareBtnText}>Send to Hardware Shop</Text>
                </Pressable>
                <Text style={styles.futureMaterialNotice}>This is future material.</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 3: SEPARATED MORNING & EVENING PHOTOS ─── */}
      <Modal visible={activeModal === "photo"} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>📷 Site Photos</ThemedText>
              <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {/* SECTION A: MORNING SITE PHOTO */}
              <View style={[styles.photoSectionCard, { backgroundColor: isDark ? "#1E293B" : "#F8FAFC", borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
                <ThemedText style={styles.photoSectionTitle}>MORNING SITE PHOTO</ThemedText>

                {morningPhotoUri ? (
                  <View style={styles.photoPreviewBox}>
                    <Image source={{ uri: morningPhotoUri }} style={styles.photoPreviewImg} />
                    <View style={styles.photoMetaRow}>
                      <Text style={styles.photoTimeText}>Time: {morningPhotoTime}</Text>
                      <Pressable onPress={() => setMorningPhotoUri("")} style={styles.removePhotoBtn}>
                        <Feather name="trash-2" size={14} color="#EF4444" />
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.photoUploadBtnRow}>
                    <Pressable onPress={() => handlePickPhotoSection("morning", true)} style={styles.photoUploadBtn}>
                      <Feather name="camera" size={18} color="#2563EB" />
                      <Text style={styles.photoUploadBtnText}>Upload Morning Photo</Text>
                    </Pressable>
                    <Pressable onPress={() => handlePickPhotoSection("morning", false)} style={styles.photoUploadBtn}>
                      <Feather name="image" size={18} color="#2563EB" />
                      <Text style={styles.photoUploadBtnText}>Gallery</Text>
                    </Pressable>
                  </View>
                )}

                <ThemedText style={[styles.label, { marginTop: 10 }]}>Notes</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? "#0F172A" : "#FFFFFF", borderColor: theme.border, color: theme.text }]}
                  placeholder="Brick work started from east wall"
                  placeholderTextColor={theme.textSecondary}
                  value={morningPhotoNotes}
                  onChangeText={setMorningPhotoNotes}
                />
              </View>

              <View style={{ height: 16 }} />

              {/* SECTION B: EVENING SITE PHOTO */}
              <View style={[styles.photoSectionCard, { backgroundColor: isDark ? "#1E293B" : "#F8FAFC", borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
                <ThemedText style={styles.photoSectionTitle}>EVENING SITE PHOTO</ThemedText>

                {eveningPhotoUri ? (
                  <View style={styles.photoPreviewBox}>
                    <Image source={{ uri: eveningPhotoUri }} style={styles.photoPreviewImg} />
                    <View style={styles.photoMetaRow}>
                      <Text style={styles.photoTimeText}>Time: {eveningPhotoTime}</Text>
                      <Pressable onPress={() => setEveningPhotoUri("")} style={styles.removePhotoBtn}>
                        <Feather name="trash-2" size={14} color="#EF4444" />
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.photoUploadBtnRow}>
                    <Pressable onPress={() => handlePickPhotoSection("evening", true)} style={styles.photoUploadBtn}>
                      <Feather name="camera" size={18} color="#2563EB" />
                      <Text style={styles.photoUploadBtnText}>Upload Evening Photo</Text>
                    </Pressable>
                    <Pressable onPress={() => handlePickPhotoSection("evening", false)} style={styles.photoUploadBtn}>
                      <Feather name="image" size={18} color="#2563EB" />
                      <Text style={styles.photoUploadBtnText}>Gallery</Text>
                    </Pressable>
                  </View>
                )}

                <ThemedText style={[styles.label, { marginTop: 10 }]}>Notes</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: isDark ? "#0F172A" : "#FFFFFF", borderColor: theme.border, color: theme.text }]}
                  placeholder="Work completed till 17 ft"
                  placeholderTextColor={theme.textSecondary}
                  value={eveningPhotoNotes}
                  onChangeText={setEveningPhotoNotes}
                />
              </View>

              <Pressable
                onPress={() => {
                  if (!morningPhotoUri && !eveningPhotoUri) {
                    Alert.alert("Validation Error", "Please upload at least one site photo (Morning or Evening).");
                    return;
                  }
                  handleCreateUpdate("photo", {
                    morningPhoto: morningPhotoUri ? { uri: morningPhotoUri, time: morningPhotoTime, notes: morningPhotoNotes } : null,
                    eveningPhoto: eveningPhotoUri ? { uri: eveningPhotoUri, time: eveningPhotoTime, notes: eveningPhotoNotes } : null,
                    photoUris: [morningPhotoUri, eveningPhotoUri].filter(Boolean)
                  });
                }}
                disabled={isActionSubmitting}
                style={[styles.submitBtn, { backgroundColor: theme.primary, marginTop: 20 }]}
              >
                {isActionSubmitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <ThemedText style={styles.submitBtnText}>Save Update</ThemedText>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 4: GPS LOCATION ─── */}
      <Modal visible={activeModal === "gps"} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>📍 GPS / Location</ThemedText>
              <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <ThemedText style={styles.modalDescText}>
                Confirm your physical presence at the site to record location authenticity.
              </ThemedText>

              <Pressable
                onPress={handleCaptureGps}
                disabled={isFetchingGps}
                style={[styles.gpsCaptureBtn, { borderColor: theme.primary }]}
              >
                {isFetchingGps ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <>
                    <Feather name="navigation" size={16} color={theme.primary} />
                    <ThemedText style={[styles.gpsCaptureBtnText, { color: theme.primary }]}>
                      {gpsCoords ? "Recapture Location" : "Get Current Location"}
                    </ThemedText>
                  </>
                )}
              </Pressable>

              {gpsCoords && (
                <View style={[styles.gpsDisplayCard, { backgroundColor: isDark ? "#0F172A" : "#F8FAFC", borderColor: theme.border }]}>
                  <Feather name="check-circle" size={18} color="#10B981" />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ fontWeight: "700" }}>Location Captured</ThemedText>
                    <ThemedText style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>{gpsAddress}</ThemedText>
                  </View>
                </View>
              )}

              <Pressable
                onPress={() => {
                  if (!gpsCoords) {
                    Alert.alert("Validation Error", "Please capture GPS location coordinates first.");
                    return;
                  }
                  handleCreateUpdate("gps", {
                    location: {
                      latitude: gpsCoords.latitude,
                      longitude: gpsCoords.longitude,
                      address: gpsAddress
                    }
                  });
                }}
                disabled={isActionSubmitting}
                style={[styles.submitBtn, { backgroundColor: theme.primary, marginTop: 20 }]}
              >
                {isActionSubmitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <ThemedText style={styles.submitBtnText}>Save Update</ThemedText>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 5: ISSUES & EMERGENCY CONTACTS ─── */}
      <Modal visible={activeModal === "issue"} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>⚠️ Site Issues & Emergency</ThemedText>
              <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {/* EMERGENCY CONTACTS QUICK ACCESS */}
              <ThemedText style={[styles.label, { color: "#EF4444", fontWeight: "800" }]}>Emergency Contacts</ThemedText>
              <View style={[styles.emergencyModalBox, { borderColor: theme.border, backgroundColor: isDark ? "#0F172A" : "#FEF2F2" }]}>
                <View style={styles.emergencyCardRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>🚨</Text>
                    <View>
                      <Text style={{ fontWeight: "800", color: isDark ? "#FFF" : "#0F172A" }}>Police</Text>
                      <Text style={{ fontSize: 12, color: isDark ? "#94A3B8" : "#64748B" }}>100</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => handleMakeCall("100")} style={[styles.callActionBtn, { backgroundColor: "#DC2626" }]}>
                    <Feather name="phone" size={12} color="#FFFFFF" />
                    <Text style={styles.callActionBtnText}>Call</Text>
                  </Pressable>
                </View>

                <View style={[styles.emergencyCardRow, { marginTop: 8 }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>🚑</Text>
                    <View>
                      <Text style={{ fontWeight: "800", color: isDark ? "#FFF" : "#0F172A" }}>Ambulance</Text>
                      <Text style={{ fontSize: 12, color: isDark ? "#94A3B8" : "#64748B" }}>108</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => handleMakeCall("108")} style={[styles.callActionBtn, { backgroundColor: "#16A34A" }]}>
                    <Feather name="phone" size={12} color="#FFFFFF" />
                    <Text style={styles.callActionBtnText}>Call</Text>
                  </Pressable>
                </View>
              </View>

              <ThemedText style={[styles.label, { marginTop: 16 }]}>Report New Issue</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: isDark ? "#0F172A" : "#F8FAFC", borderColor: theme.border, color: theme.text }]}
                multiline
                numberOfLines={3}
                placeholder="Describe the site issue..."
                placeholderTextColor={theme.textSecondary}
                value={issueDescription}
                onChangeText={setIssueDescription}
              />

              <ThemedText style={styles.label}>Priority Level</ThemedText>
              <View style={styles.selectorGrid}>
                {(["Low", "Medium", "High"] as const).map((pri) => {
                  const isSelected = issuePriority === pri;
                  return (
                    <Pressable
                      key={pri}
                      onPress={() => setIssuePriority(pri)}
                      style={[
                        styles.selectorOption,
                        { borderColor: theme.border },
                        isSelected && { 
                          backgroundColor: pri === "High" ? "#DC2626" : pri === "Medium" ? "#2563EB" : "#64748B",
                          borderColor: pri === "High" ? "#DC2626" : pri === "Medium" ? "#2563EB" : "#64748B"
                        }
                      ]}
                    >
                      <Text style={[styles.selectorOptionText, { color: isSelected ? "#FFFFFF" : (isDark ? "#CBD5E1" : "#475569") }]}>
                        {pri}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={() => {
                  if (!issueDescription.trim()) {
                    Alert.alert("Validation Error", "Please describe the site issue.");
                    return;
                  }
                  handleCreateUpdate("issue", {
                    issueDescription: issueDescription.trim(),
                    issuePriority,
                    issueStatus
                  });
                }}
                disabled={isActionSubmitting}
                style={[styles.submitBtn, { backgroundColor: theme.primary, marginTop: 20 }]}
              >
                {isActionSubmitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <ThemedText style={styles.submitBtnText}>Save Issue</ThemedText>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  loadingCenter: {
    justifyContent: "center",
    alignItems: "center"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 54 : 16,
    paddingBottom: 12
  },
  backBtn: {
    padding: 6
  },
  headerControlTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  headerSiteTitle: {
    fontSize: 20,
    fontWeight: "900"
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800"
  },
  headerSubtitle: {
    fontSize: 12,
    opacity: 0.7
  },
  statusBadgeActive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(22,163,74,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12
  },
  statusDotActive: {
    color: "#16A34A",
    fontSize: 10
  },
  statusTextActive: {
    color: "#16A34A",
    fontSize: 12,
    fontWeight: "800"
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 60
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 6
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16
  },
  cardHeaderTitle: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: "#475569"
  },
  todayDateBadge: {
    fontSize: 12,
    fontWeight: "700"
  },
  infoRowBlock: {
    marginTop: 8
  },
  infoRowWithAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8
  },
  infoLabelText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    marginBottom: 2
  },
  infoValueText: {
    fontSize: 15,
    fontWeight: "800"
  },
  divider: {
    height: 1,
    marginVertical: 10
  },
  callActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10
  },
  callActionBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800"
  },

  /* Today's Summary & Progress */
  largeProgressBarBg: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden"
  },
  largeProgressBarFill: {
    height: "100%",
    borderRadius: 5
  },
  summarySubLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase"
  },
  summarySubVal: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2
  },

  /* Open Main Daily Logs Button */
  openMainBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 12,
    marginTop: 10
  },
  openMainBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800"
  },

  /* Quick Actions Grid */
  quickGridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16
  },
  quickCard: {
    width: "31%",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  quickCardText: {
    fontSize: 12,
    fontWeight: "800"
  },

  /* Outline Action Buttons */
  outlineActionBtn: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center"
  },
  outlineActionBtnText: {
    fontSize: 14,
    fontWeight: "800"
  },

  /* Emergency Contacts */
  emergencyHeaderTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#DC2626",
    marginBottom: 10
  },
  emergencyCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end"
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "88%"
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800"
  },
  modalCloseBtn: {
    padding: 4
  },
  modalScroll: {
    paddingBottom: 20
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 12,
    color: "#475569"
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "600"
  },
  textArea: {
    height: 80,
    textAlignVertical: "top"
  },
  readOnlyDateBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  readOnlyDateText: {
    fontSize: 15,
    fontWeight: "700"
  },
  selectorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  selectorOption: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1
  },
  selectorOptionText: {
    fontSize: 13,
    fontWeight: "700"
  },
  unitChipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8
  },
  unitChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1
  },
  unitChipText: {
    fontSize: 12,
    fontWeight: "700"
  },
  submitBtn: {
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800"
  },

  /* Work Dashboard & Categories */
  summaryBoxHeaderTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12
  },
  summaryProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10
  },
  summaryProgressLabel: {
    fontSize: 13,
    fontWeight: "700"
  },
  summaryProgressBarBg: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    overflow: "hidden"
  },
  summaryProgressBarFill: {
    height: "100%",
    borderRadius: 5
  },
  summaryProgressPctText: {
    fontSize: 13,
    fontWeight: "800",
    width: 40,
    textAlign: "right"
  },
  workCategoryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14
  },
  workCategoryIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center"
  },
  workCategoryTitle: {
    fontSize: 16,
    fontWeight: "800"
  },
  workCategorySubText: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2
  },
  workStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  workStatusBadgeText: {
    fontSize: 11,
    fontWeight: "800"
  },

  /* Dedicated Work Screen Styles */
  dedicatedWorkTitle: {
    fontSize: 18,
    fontWeight: "800"
  },
  dedicatedWorkSub: {
    fontSize: 12,
    color: "#64748B"
  },
  dedicatedWorkPct: {
    fontSize: 32,
    fontWeight: "900"
  },
  addDailyUpdateBtn: {
    height: 50,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20
  },
  addDailyUpdateBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800"
  },
  historyItemRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0"
  },
  historyDateText: {
    fontSize: 14,
    fontWeight: "800"
  },
  historyPctBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8
  },
  historyPctText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563EB"
  },
  historyNotesText: {
    fontSize: 14,
    fontStyle: "italic",
    marginVertical: 4
  },
  historyUpdaterText: {
    fontSize: 11,
    color: "#64748B"
  },

  /* Modal Bottom Sheet Actions */
  cancelModalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  cancelModalBtnText: {
    fontSize: 15,
    fontWeight: "700"
  },
  submitModalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center"
  },
  submitModalBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF"
  },

  /* Hardware Shop Future Disabled Section */
  futureHardwareBox: {
    marginTop: 20,
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0"
  },
  disabledHardwareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    height: 48,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
    opacity: 0.6
  },
  disabledHardwareBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B"
  },
  futureMaterialNotice: {
    fontSize: 13,
    fontWeight: "700",
    color: "#94A3B8",
    marginTop: 8
  },

  /* Separated Photo Sections */
  photoSectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14
  },
  photoSectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2563EB",
    marginBottom: 10
  },
  photoUploadBtnRow: {
    flexDirection: "row",
    gap: 10
  },
  photoUploadBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2563EB",
    backgroundColor: "rgba(37,99,235,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  photoUploadBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2563EB"
  },
  photoPreviewBox: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#CBD5E1"
  },
  photoPreviewImg: {
    width: "100%",
    height: 160,
    resizeMode: "cover"
  },
  photoMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#0F172A"
  },
  photoTimeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700"
  },
  removePhotoBtn: {
    padding: 4
  },

  /* GPS & Issues */
  modalDescText: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 16
  },
  gpsCaptureBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 12,
    borderWidth: 1
  },
  gpsCaptureBtnText: {
    fontSize: 14,
    fontWeight: "800"
  },
  gpsDisplayCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14
  },
  emergencyModalBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1
  }
});
