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
  Dimensions
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

const { width } = Dimensions.get("window");

export default function SiteDetailsScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const { siteId } = route.params;

  const userRole = user?.role || "supervisor";
  const isContractorOrAdmin = userRole === "contractor" || userRole === "admin" || userRole === "builder";

  // Data States
  const [site, setSite] = useState<Site | null>(null);
  const [updates, setUpdates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  // Modal Visibility States
  const [activeModal, setActiveModal] = useState<"work" | "material" | "expense" | "photo" | "gps" | "issue" | null>(null);

  // Form Fields - Work
  const [workType, setWorkType] = useState("Plaster");
  const [progressPercent, setProgressPercent] = useState("");
  const [workNotes, setWorkNotes] = useState("");

  // Form Fields - Material
  const [materialName, setMaterialName] = useState("");
  const [materialQty, setMaterialQty] = useState("");
  const [materialUnit, setMaterialUnit] = useState("bags");
  const [materialNotes, setMaterialNotes] = useState("");

  // Form Fields - Expense
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Labour");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);

  // Form Fields - Photos
  const [photoUris, setPhotoUris] = useState<string[]>([]);
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

  const loadData = async () => {
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
        // Prepend update locally to updates history
        setUpdates(prev => [newUpdate, ...prev]);

        // Update local site cache directly so UI updates without reloading
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
        setActiveModal(null);
        resetFormFields();
      } else {
        Alert.alert("Error", "Failed to log update. Please check connections.");
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
    
    setExpenseAmount("");
    setExpenseNotes("");
    setExpenseDate(new Date().toISOString().split("T")[0]);
    
    setPhotoUris([]);
    
    setGpsCoords(null);
    setGpsAddress("");
    
    setIssueDescription("");
    setIssuePriority("Medium");
    setIssueStatus("Open");
  };

  // Image Selection and Upload handler
  const handlePickPhoto = async (useCamera = false) => {
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
          setPhotoUris(prev => [...prev, uploadedUrl]);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active": return { text: "#10B981", bg: "#10B98115" };
      case "Completed": return { text: "#10B981", bg: "#10B98125" };
      case "On Hold": return { text: "#F59E0B", bg: "#F59E0B15" };
      case "Delayed": return { text: "#EF4444", bg: "#EF444415" };
      default: return { text: "#64748B", bg: "#64748B15" };
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

  const statusColors = getStatusColor(site.status);

  // Formatting display dates
  const formatDateStr = (dateVal: any) => {
    if (!dateVal) return "N/A";
    return new Date(dateVal).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  const getRelativeUpdateTime = (dateVal: any) => {
    if (!dateVal) return "";
    const date = new Date(dateVal);
    const today = new Date();
    const isToday = date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
    
    const timeStr = date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit"
    });
    
    return isToday ? `Today, ${timeStr}` : `${formatDateStr(dateVal)}, ${timeStr}`;
  };

  // Card sub-labels computed dynamically from caching/history
  const getWorkProgressLabel = () => {
    if (site.currentWork) {
      return `${site.currentWork} ${site.currentProgress || 0}%`;
    }
    return "No updates";
  };

  const getMaterialLabel = () => {
    const todayMaterialUpdates = updates.filter(u => {
      if (u.type !== "material") return false;
      const uDate = new Date(u.timestamp);
      const today = new Date();
      return uDate.toDateString() === today.toDateString();
    });
    return todayMaterialUpdates.length > 0 
      ? `${todayMaterialUpdates.length} update${todayMaterialUpdates.length > 1 ? "s" : ""} today`
      : "No updates";
  };

  const getExpenseLabel = () => {
    const todayExpenseUpdates = updates.filter(u => {
      if (u.type !== "expense") return false;
      const uDate = new Date(u.timestamp);
      const today = new Date();
      return uDate.toDateString() === today.toDateString();
    });
    const sum = todayExpenseUpdates.reduce((acc, u) => acc + (u.expenseAmount || 0), 0);
    return sum > 0 ? `₹${sum.toLocaleString("en-IN")}` : "₹0 logged";
  };

  const getPhotosLabel = () => {
    const todayPhotos = updates.filter(u => {
      if (u.type !== "photo") return false;
      const uDate = new Date(u.timestamp);
      const today = new Date();
      return uDate.toDateString() === today.toDateString();
    });
    const photoCount = todayPhotos.reduce((acc, u) => acc + (u.photoUris?.length || 0), 0);
    return photoCount > 0 ? `${photoCount} Photo${photoCount > 1 ? "s" : ""}` : "0 Photos";
  };

  const getGpsLabel = () => {
    const latestGps = updates.find(u => u.type === "gps");
    return latestGps ? "Updated" : "Not updated";
  };

  const getIssuesLabel = () => {
    const openIssues = updates.filter(u => u.type === "issue" && u.issueStatus === "Open");
    return openIssues.length > 0 ? `${openIssues.length} Open` : "No issues";
  };

  const getUpdateByLabel = (u: any) => {
    const name = typeof u.updatedBy === "object" ? u.updatedBy?.name : "Supervisor";
    const role = typeof u.updatedBy === "object" ? u.updatedBy?.role : "";
    return `${name} (${role || "supervisor"})`;
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* HEADER SECTION */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1, paddingHorizontal: 10 }}>
          <ThemedText numberOfLines={1} style={styles.headerTitle}>{site.name}</ThemedText>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
            <Feather name="map-pin" size={12} color={theme.textSecondary} style={{ marginRight: 4 }} />
            <ThemedText numberOfLines={1} style={styles.headerSubtitle}>{site.address}</ThemedText>
          </View>
        </View>
        
        {isContractorOrAdmin && (
          <Pressable
            onPress={() => {
              triggerHaptic();
              navigation.navigate("EditSite", { siteId: site.id });
            }}
            style={[styles.editBtn, { backgroundColor: theme.primary }]}
          >
            <Feather name="edit-2" size={16} color="#FFFFFF" />
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* SITE SUMMARY CARD */}
        <View style={[styles.card, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <View style={styles.summaryTopRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.summaryLabel}>Supervisor</ThemedText>
              <ThemedText style={styles.summaryVal}>
                {typeof site.supervisor === "object" ? site.supervisor?.name : "Unassigned"}
              </ThemedText>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColors.text }]} />
              <ThemedText style={[styles.statusText, { color: statusColors.text }]}>{site.status}</ThemedText>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.summaryMiddleRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.summaryLabel}>Last Update</ThemedText>
              {site.lastUpdateAt ? (
                <ThemedText style={styles.summaryVal}>
                  {getRelativeUpdateTime(site.lastUpdateAt)}
                </ThemedText>
              ) : (
                <ThemedText style={[styles.summaryVal, { color: theme.error }]}>
                  ⚠️ No site update today
                </ThemedText>
              )}
            </View>
            {site.lastUpdatedBy && (
              <View style={{ alignItems: "flex-end" }}>
                <ThemedText style={styles.summaryLabel}>Logged By</ThemedText>
                <ThemedText style={styles.summaryValSub}>
                  {typeof site.lastUpdatedBy === "object" ? site.lastUpdatedBy?.name : "Supervisor"}
                </ThemedText>
              </View>
            )}
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          {/* Current Work & Progress progress bar */}
          <View style={styles.progressContainer}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <View>
                <ThemedText style={styles.summaryLabel}>Current Work</ThemedText>
                <ThemedText style={styles.progressWorkName}>{site.currentWork || "Not Specified"}</ThemedText>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <ThemedText style={styles.summaryLabel}>Progress</ThemedText>
                <ThemedText style={styles.progressPercentText}>{site.currentProgress || 0}%</ThemedText>
              </View>
            </View>
            <View style={[styles.progressBarBg, { backgroundColor: theme.backgroundSecondary }]}>
              <View style={[styles.progressBarFill, { backgroundColor: theme.primary, width: `${site.currentProgress || 0}%` }]} />
            </View>
          </View>
        </View>

        {/* QUICK ACTION CARDS */}
        <ThemedText style={styles.sectionTitle}>Daily Site Logs</ThemedText>
        <View style={styles.gridContainer}>
          {/* Card 1: Work */}
          <Pressable 
            onPress={() => { triggerHaptic(); setActiveModal("work"); }}
            style={({ pressed }) => [
              styles.gridCard, 
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border, opacity: pressed ? 0.7 : 1 }
            ]}
          >
            <View style={styles.cardHeaderIcon}>
              <ThemedText style={styles.cardIcon}>🧱</ThemedText>
            </View>
            <ThemedText style={styles.gridCardTitle}>Work</ThemedText>
            <ThemedText numberOfLines={1} style={styles.gridCardSub}>{getWorkProgressLabel()}</ThemedText>
          </Pressable>

          {/* Card 2: Material */}
          <Pressable 
            onPress={() => { triggerHaptic(); setActiveModal("material"); }}
            style={({ pressed }) => [
              styles.gridCard, 
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border, opacity: pressed ? 0.7 : 1 }
            ]}
          >
            <View style={styles.cardHeaderIcon}>
              <ThemedText style={styles.cardIcon}>📦</ThemedText>
            </View>
            <ThemedText style={styles.gridCardTitle}>Material</ThemedText>
            <ThemedText numberOfLines={1} style={styles.gridCardSub}>{getMaterialLabel()}</ThemedText>
          </Pressable>

          {/* Card 3: Expense */}
          <Pressable 
            onPress={() => { triggerHaptic(); setActiveModal("expense"); }}
            style={({ pressed }) => [
              styles.gridCard, 
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border, opacity: pressed ? 0.7 : 1 }
            ]}
          >
            <View style={styles.cardHeaderIcon}>
              <ThemedText style={styles.cardIcon}>₹</ThemedText>
            </View>
            <ThemedText style={styles.gridCardTitle}>Expense</ThemedText>
            <ThemedText numberOfLines={1} style={styles.gridCardSub}>{getExpenseLabel()}</ThemedText>
          </Pressable>

          {/* Card 4: Photos */}
          <Pressable 
            onPress={() => { triggerHaptic(); setActiveModal("photo"); }}
            style={({ pressed }) => [
              styles.gridCard, 
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border, opacity: pressed ? 0.7 : 1 }
            ]}
          >
            <View style={styles.cardHeaderIcon}>
              <ThemedText style={styles.cardIcon}>📷</ThemedText>
            </View>
            <ThemedText style={styles.gridCardTitle}>Photos</ThemedText>
            <ThemedText numberOfLines={1} style={styles.gridCardSub}>{getPhotosLabel()}</ThemedText>
          </Pressable>

          {/* Card 5: GPS */}
          <Pressable 
            onPress={() => { triggerHaptic(); setActiveModal("gps"); }}
            style={({ pressed }) => [
              styles.gridCard, 
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border, opacity: pressed ? 0.7 : 1 }
            ]}
          >
            <View style={styles.cardHeaderIcon}>
              <ThemedText style={styles.cardIcon}>📍</ThemedText>
            </View>
            <ThemedText style={styles.gridCardTitle}>GPS</ThemedText>
            <ThemedText numberOfLines={1} style={styles.gridCardSub}>{getGpsLabel()}</ThemedText>
          </Pressable>

          {/* Card 6: Issues */}
          <Pressable 
            onPress={() => { triggerHaptic(); setActiveModal("issue"); }}
            style={({ pressed }) => [
              styles.gridCard, 
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border, opacity: pressed ? 0.7 : 1 }
            ]}
          >
            <View style={styles.cardHeaderIcon}>
              <ThemedText style={styles.cardIcon}>⚠️</ThemedText>
            </View>
            <ThemedText style={styles.gridCardTitle}>Issues</ThemedText>
            <ThemedText numberOfLines={1} style={[styles.gridCardSub, getIssuesLabel() !== "No issues" && { color: theme.error }]}>
              {getIssuesLabel()}
            </ThemedText>
          </Pressable>
        </View>

        {/* TIMELINE FEED */}
        <ThemedText style={styles.sectionTitle}>Recent Updates</ThemedText>
        <View style={[styles.card, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          {updates.length === 0 ? (
            <ThemedText style={styles.noUpdatesText}>No recent updates have been recorded.</ThemedText>
          ) : (
            updates.map((item, index) => {
              let icon = "activity";
              let color = theme.primary;
              let content = "";

              switch (item.type) {
                case "work":
                  icon = "check-square";
                  color = "#10B981";
                  content = `Updated work: ${item.workType} to ${item.progressPercent}% - "${item.workNotes || 'No notes'}"`;
                  break;
                case "material":
                  icon = "package";
                  color = "#3B82F6";
                  content = `Added material: ${item.materialName} (${item.materialQty} ${item.materialUnit}) - ${item.materialNotes || "No notes"}`;
                  break;
                case "expense":
                  icon = "dollar-sign";
                  color = "#F59E0B";
                  content = `Logged expense: ₹${item.expenseAmount?.toLocaleString("en-IN")} for ${item.expenseCategory} - ${item.expenseNotes || "No notes"}`;
                  break;
                case "photo":
                  icon = "image";
                  color = "#A855F7";
                  content = `Uploaded ${item.photoUris?.length || 1} site photo(s)`;
                  break;
                case "gps":
                  icon = "map-pin";
                  color = "#EF4444";
                  content = `Captured GPS coordinates: ${item.location?.latitude?.toFixed(4)}, ${item.location?.longitude?.toFixed(4)}`;
                  break;
                case "issue":
                  icon = "alert-triangle";
                  color = item.issuePriority === "High" ? "#EF4444" : "#F59E0B";
                  content = `Reported [${item.issuePriority}] Issue: "${item.issueDescription}" [${item.issueStatus}]`;
                  break;
              }

              return (
                <View key={item._id || index} style={styles.timelineItem}>
                  {/* Left Line & Icon */}
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineIconBg, { backgroundColor: `${color}15` }]}>
                      <Feather name={icon as any} size={14} color={color} />
                    </View>
                    {index < updates.length - 1 && (
                      <View style={[styles.timelineLine, { backgroundColor: theme.border }]} />
                    )}
                  </View>
                  
                  {/* Right Details */}
                  <View style={styles.timelineRight}>
                    <View style={styles.timelineRow}>
                      <ThemedText style={styles.timelineTime}>{getRelativeUpdateTime(item.timestamp)}</ThemedText>
                      <ThemedText numberOfLines={1} style={styles.timelineUser}>{getUpdateByLabel(item)}</ThemedText>
                    </View>
                    <ThemedText style={styles.timelineText}>{content}</ThemedText>
                    {item.type === "photo" && item.photoUris && item.photoUris.length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                        {item.photoUris.map((photo: string, pIdx: number) => (
                          <Image key={pIdx} source={{ uri: photo }} style={styles.timelinePhoto} />
                        ))}
                      </ScrollView>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* SITE METADATA / INFORMATION */}
        <ThemedText style={styles.sectionTitle}>Site Information</ThemedText>
        <View style={[styles.card, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, marginBottom: 40 }]}>
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>Client Name</ThemedText>
            <ThemedText style={styles.metaVal}>{site.clientName || "Not Provided"}</ThemedText>
          </View>
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>Address</ThemedText>
            <ThemedText style={styles.metaVal}>{site.address}</ThemedText>
          </View>
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>Start Date</ThemedText>
            <ThemedText style={styles.metaVal}>{formatDateStr(site.startDate)}</ThemedText>
          </View>
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>Description</ThemedText>
            <ThemedText style={styles.metaVal}>{site.description || "No special notes."}</ThemedText>
          </View>
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>Current Status</ThemedText>
            <ThemedText style={[styles.metaVal, { color: statusColors.text }]}>{site.status}</ThemedText>
          </View>
        </View>

      </ScrollView>

      {/* ─── MODALS FOR LOGS ─── */}

      {/* 1. WORK MODAL */}
      <Modal visible={activeModal === "work"} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>🧱 Update Work & Progress</ThemedText>
              <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <ThemedText style={styles.label}>Select Work Type</ThemedText>
              <View style={styles.selectorRow}>
                {["Plaster", "Brickwork", "Tiles", "Painting", "Flooring", "Electrical", "Plumbing", "Concrete", "Other"].map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => setWorkType(type)}
                    style={[
                      styles.selectorItem,
                      { borderColor: theme.border },
                      workType === type && { backgroundColor: theme.primary, borderColor: theme.primary }
                    ]}
                  >
                    <ThemedText style={[styles.selectorItemText, workType === type && { color: "#FFF" }]}>{type}</ThemedText>
                  </Pressable>
                ))}
              </View>

              <ThemedText style={styles.label}>Progress Percentage (%)</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, color: theme.text }]}
                keyboardType="numeric"
                maxLength={3}
                placeholder="e.g. 65"
                placeholderTextColor={theme.textSecondary}
                value={progressPercent}
                onChangeText={setProgressPercent}
              />

              <ThemedText style={styles.label}>Notes</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, color: theme.text }]}
                multiline
                numberOfLines={3}
                placeholder="e.g. Living room and first floor completed"
                placeholderTextColor={theme.textSecondary}
                value={workNotes}
                onChangeText={setWorkNotes}
              />

              <Pressable
                onPress={() => {
                  const pct = parseInt(progressPercent);
                  if (isNaN(pct) || pct < 0 || pct > 100) {
                    Alert.alert("Validation Error", "Please specify progress percentage between 0 and 100.");
                    return;
                  }
                  handleCreateUpdate("work", { workType, progressPercent: pct, workNotes });
                }}
                disabled={isActionSubmitting}
                style={[styles.submitBtn, { backgroundColor: theme.primary }]}
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

      {/* 2. MATERIAL MODAL */}
      <Modal visible={activeModal === "material"} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>📦 Add Material Log</ThemedText>
              <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <ThemedText style={styles.label}>Material Name</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, color: theme.text }]}
                placeholder="e.g. Cement, Sand, Bricks"
                placeholderTextColor={theme.textSecondary}
                value={materialName}
                onChangeText={setMaterialName}
              />

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.label}>Quantity</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, color: theme.text }]}
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
                    style={[styles.input, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, color: theme.text }]}
                    placeholder="e.g. bags, trolley, brass"
                    placeholderTextColor={theme.textSecondary}
                    value={materialUnit}
                    onChangeText={setMaterialUnit}
                  />
                </View>
              </View>

              <ThemedText style={styles.label}>Notes</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, color: theme.text }]}
                multiline
                numberOfLines={2}
                placeholder="e.g. Received from UltraTech supplier"
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
                style={[styles.submitBtn, { backgroundColor: theme.primary }]}
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

      {/* 3. EXPENSE MODAL */}
      <Modal visible={activeModal === "expense"} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>₹ Add Expense Update</ThemedText>
              <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <ThemedText style={styles.label}>Expense Amount (₹)</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, color: theme.text }]}
                keyboardType="numeric"
                placeholder="e.g. 4500"
                placeholderTextColor={theme.textSecondary}
                value={expenseAmount}
                onChangeText={setExpenseAmount}
              />

              <ThemedText style={styles.label}>Category</ThemedText>
              <View style={styles.selectorRow}>
                {["Labour", "Material", "Transport", "Machinery", "Other"].map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setExpenseCategory(cat)}
                    style={[
                      styles.selectorItem,
                      { borderColor: theme.border },
                      expenseCategory === cat && { backgroundColor: theme.primary, borderColor: theme.primary }
                    ]}
                  >
                    <ThemedText style={[styles.selectorItemText, expenseCategory === cat && { color: "#FFF" }]}>{cat}</ThemedText>
                  </Pressable>
                ))}
              </View>

              <ThemedText style={styles.label}>Notes</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, color: theme.text }]}
                multiline
                numberOfLines={2}
                placeholder="e.g. Paid transporter for sand trolley delivery"
                placeholderTextColor={theme.textSecondary}
                value={expenseNotes}
                onChangeText={setExpenseNotes}
              />

              <ThemedText style={styles.label}>Date (YYYY-MM-DD)</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, color: theme.text }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.textSecondary}
                value={expenseDate}
                onChangeText={setExpenseDate}
              />

              <Pressable
                onPress={() => {
                  const amt = parseFloat(expenseAmount);
                  if (isNaN(amt) || amt <= 0) {
                    Alert.alert("Validation Error", "Please provide a valid positive expense amount.");
                    return;
                  }
                  handleCreateUpdate("expense", {
                    expenseAmount: amt,
                    expenseCategory,
                    expenseNotes: expenseNotes.trim(),
                    expenseDate
                  });
                }}
                disabled={isActionSubmitting}
                style={[styles.submitBtn, { backgroundColor: theme.primary }]}
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

      {/* 4. PHOTOS MODAL */}
      <Modal visible={activeModal === "photo"} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>📷 Upload Site Photos</ThemedText>
              <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <ThemedText style={styles.label}>Choose Source</ThemedText>
              <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
                <Pressable
                  onPress={() => handlePickPhoto(true)}
                  style={[styles.photoSourceBtn, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
                >
                  <Feather name="camera" size={20} color={theme.primary} />
                  <ThemedText style={styles.photoSourceBtnText}>Camera</ThemedText>
                </Pressable>

                <Pressable
                  onPress={() => handlePickPhoto(false)}
                  style={[styles.photoSourceBtn, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
                >
                  <Feather name="image" size={20} color={theme.primary} />
                  <ThemedText style={styles.photoSourceBtnText}>Gallery</ThemedText>
                </Pressable>
              </View>

              {isPhotoPicking && (
                <View style={{ alignItems: "center", marginVertical: 10 }}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <ThemedText style={{ marginTop: 4, opacity: 0.7 }}>Uploading image to server...</ThemedText>
                </View>
              )}

              {photoUris.length > 0 ? (
                <View style={styles.uploadedImagesGrid}>
                  {photoUris.map((uri, idx) => (
                    <View key={idx} style={styles.uploadedImageWrapper}>
                      <Image source={{ uri }} style={styles.uploadedImage} />
                      <Pressable 
                        onPress={() => setPhotoUris(prev => prev.filter((_, i) => i !== idx))} 
                        style={styles.deletePhotoBadge}
                      >
                        <Feather name="trash-2" size={12} color="#FFF" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={[styles.photoPlaceholder, { borderColor: theme.border }]}>
                  <Feather name="image" size={40} color={theme.textSecondary} style={{ opacity: 0.4 }} />
                  <ThemedText style={{ opacity: 0.6, fontSize: 13, marginTop: 8 }}>No photos uploaded yet</ThemedText>
                </View>
              )}

              <Pressable
                onPress={() => {
                  if (photoUris.length === 0) {
                    Alert.alert("Validation Error", "Please upload at least one photo.");
                    return;
                  }
                  handleCreateUpdate("photo", { photoUris });
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

      {/* 5. GPS MODAL */}
      <Modal visible={activeModal === "gps"} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>📍 Capture GPS Location</ThemedText>
              <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <ThemedText style={styles.modalDescText}>
                Confirm you are physically present at the site to verify operations authenticity.
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
                <View style={[styles.gpsDisplayCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                  <Feather name="check-circle" size={18} color="#10B981" />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ fontWeight: "700" }}>Coordinates Logged</ThemedText>
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

      {/* 6. ISSUES MODAL */}
      <Modal visible={activeModal === "issue"} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>⚠️ Report Site Issue</ThemedText>
              <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <ThemedText style={styles.label}>Issue Description</ThemedText>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, color: theme.text }]}
                multiline
                numberOfLines={3}
                placeholder="Describe the problem, e.g. Cement delivery delayed."
                placeholderTextColor={theme.textSecondary}
                value={issueDescription}
                onChangeText={setIssueDescription}
              />

              <ThemedText style={styles.label}>Priority Level</ThemedText>
              <View style={styles.selectorRow}>
                {(["Low", "Medium", "High"] as const).map((pri) => (
                  <Pressable
                    key={pri}
                    onPress={() => setIssuePriority(pri)}
                    style={[
                      styles.selectorItem,
                      { borderColor: theme.border },
                      issuePriority === pri && { 
                        backgroundColor: pri === "High" ? theme.error : pri === "Medium" ? theme.primary : "#94A3B8",
                        borderColor: pri === "High" ? theme.error : pri === "Medium" ? theme.primary : "#94A3B8"
                      }
                    ]}
                  >
                    <ThemedText style={[styles.selectorItemText, issuePriority === pri && { color: "#FFF" }]}>{pri}</ThemedText>
                  </Pressable>
                ))}
              </View>

              <ThemedText style={styles.label}>Status</ThemedText>
              <View style={styles.selectorRow}>
                {(["Open", "Resolved"] as const).map((st) => (
                  <Pressable
                    key={st}
                    onPress={() => setIssueStatus(st)}
                    style={[
                      styles.selectorItem,
                      { borderColor: theme.border },
                      issueStatus === st && { 
                        backgroundColor: st === "Open" ? theme.error : "#10B981",
                        borderColor: st === "Open" ? theme.error : "#10B981"
                      }
                    ]}
                  >
                    <ThemedText style={[styles.selectorItemText, issueStatus === st && { color: "#FFF" }]}>{st}</ThemedText>
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={() => {
                  if (!issueDescription.trim()) {
                    Alert.alert("Validation Error", "Please describe the issue.");
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
                  <ThemedText style={styles.submitBtnText}>Save Update</ThemedText>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: "800"
  },
  headerSubtitle: {
    fontSize: 12,
    opacity: 0.7
  },
  editBtn: {
    padding: 10,
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center",
    width: 38,
    height: 38
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 60
  },
  card: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20
  },
  summaryTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  summaryLabel: {
    fontSize: 11,
    opacity: 0.5,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  summaryVal: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 2
  },
  summaryValSub: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 2
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800"
  },
  divider: {
    height: 1,
    marginVertical: 12,
    opacity: 0.4
  },
  summaryMiddleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  progressContainer: {
    marginTop: 4
  },
  progressWorkName: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 2
  },
  progressPercentText: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 2
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    marginTop: 4,
    overflow: "hidden"
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    opacity: 0.9,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 4
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20
  },
  gridCard: {
    width: (width - 32 - 12) / 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    padding: 14,
    alignItems: "flex-start"
  },
  cardHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8
  },
  cardIcon: {
    fontSize: 20
  },
  gridCardTitle: {
    fontSize: 14,
    fontWeight: "800"
  },
  gridCardSub: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2
  },
  noUpdatesText: {
    fontSize: 13,
    opacity: 0.6,
    textAlign: "center",
    paddingVertical: 12
  },
  timelineItem: {
    flexDirection: "row",
    paddingBottom: 20
  },
  timelineLeft: {
    alignItems: "center",
    marginRight: 12
  },
  timelineIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center"
  },
  timelineLine: {
    width: 1,
    flex: 1,
    marginTop: 4,
    opacity: 0.5
  },
  timelineRight: {
    flex: 1
  },
  timelineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  timelineTime: {
    fontSize: 11,
    opacity: 0.5
  },
  timelineUser: {
    fontSize: 11,
    fontWeight: "700",
    opacity: 0.8
  },
  timelineText: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18
  },
  photoRow: {
    flexDirection: "row",
    marginTop: 8
  },
  timelinePhoto: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.xs,
    marginRight: 8
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "#FFFFFF08",
    paddingVertical: 10
  },
  metaLabel: {
    fontSize: 13,
    opacity: 0.6,
    width: "35%"
  },
  metaVal: {
    fontSize: 13,
    fontWeight: "700",
    width: "60%",
    textAlign: "right"
  },
  
  // MODALS
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end"
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.md,
    borderTopRightRadius: BorderRadius.md,
    maxHeight: "85%",
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 16
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#FFFFFF08",
    paddingBottom: 14
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800"
  },
  modalCloseBtn: {
    padding: 6
  },
  modalScroll: {
    paddingVertical: 16
  },
  modalDescText: {
    fontSize: 13,
    opacity: 0.7,
    marginBottom: 20,
    lineHeight: 18
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    opacity: 0.8,
    marginBottom: 6,
    marginTop: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    height: 48,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 10
  },
  textArea: {
    height: 80,
    paddingTop: 10,
    textAlignVertical: "top"
  },
  selectorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10
  },
  selectorItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: BorderRadius.xs
  },
  selectorItemText: {
    fontSize: 13,
    fontWeight: "600"
  },
  submitBtn: {
    height: 50,
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700"
  },
  
  // Photo UI
  photoSourceBtn: {
    flex: 1,
    flexDirection: "row",
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center",
    gap: 8
  },
  photoSourceBtnText: {
    fontWeight: "700",
    fontSize: 14
  },
  photoPlaceholder: {
    height: 120,
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center"
  },
  uploadedImagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  uploadedImageWrapper: {
    position: "relative"
  },
  uploadedImage: {
    width: (width - 32 - 20) / 3,
    height: (width - 32 - 20) / 3,
    borderRadius: BorderRadius.xs
  },
  deletePhotoBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#EF4444",
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center"
  },
  
  // GPS UI
  gpsCaptureBtn: {
    flexDirection: "row",
    height: 48,
    borderWidth: 1.5,
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 16
  },
  gpsCaptureBtnText: {
    fontWeight: "700",
    fontSize: 14
  },
  gpsDisplayCard: {
    flexDirection: "row",
    padding: 12,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    gap: 10
  }
});
