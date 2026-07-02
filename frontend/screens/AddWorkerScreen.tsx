import React, { useState, useEffect, useLayoutEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  Image,
  Platform,
  ScrollView,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import {
  storage,
  Worker,
  WorkerCategory,
  generateId,
  Project,
} from "@/utils/storage";
import { uploadImageToServer } from "@/utils/upload";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/MainTabNavigator";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";

const CATEGORIES: WorkerCategory[] = [
  "labour",
  "bai",
  "mistri",
  "bandkam",
  "plaster",
  "tiles",
  "sutar",
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function SectionHeader({ title }: { title: string }) {
  const { theme } = useTheme();
  return (
    <ThemedText
      type="small"
      style={{
        color: theme.textSecondary,
        textTransform: "uppercase",
        letterSpacing: 0.8,
        marginBottom: Spacing.sm,
        marginTop: Spacing.lg,
      }}
    >
      {title}
    </ThemedText>
  );
}

export default function AddWorkerScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "AddWorker">>();

  const workerId = route.params?.workerId;
  const isEditing = !!workerId;

  const [name, setName] = useState("");
  const [category, setCategory] = useState<WorkerCategory>("labour");
  const [dailyRate, setDailyRate] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  // Projects State
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<
    string | undefined
  >(undefined);

  const saveButtonScale = useSharedValue(1);

  const animatedSaveStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveButtonScale.value }],
  }));

  useEffect(() => {
    loadProjects();
    if (workerId) {
      loadWorker();
    }
  }, [workerId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: isEditing ? t.workers.editWorker : t.workers.addWorker,
      headerLeft: () => (
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
        >
          <ThemedText style={{ color: theme.primary }}>
            {t.common.cancel}
          </ThemedText>
        </Pressable>
      ),
      headerRight: () => (
        <Pressable onPress={handleSave} style={styles.headerButton}>
          <ThemedText style={{ color: theme.primary, fontWeight: "600" }}>
            {t.common.save}
          </ThemedText>
        </Pressable>
      ),
    });
  }, [
    navigation,
    name,
    category,
    dailyRate,
    phone,
    address,
    notes,
    photoUri,
    selectedProjectId,
    isEditing,
  ]);

  const loadProjects = async () => {
    try {
      const data = await storage.getProjects();
      setProjects(data);
    } catch (e) {
      console.warn("Failed to load projects", e);
    }
  };

  const loadWorker = async () => {
    const workers = await storage.getWorkers();
    const worker = workers.find((w) => w.id === workerId);
    if (worker) {
      setName(worker.name);
      setCategory(worker.category);
      setDailyRate(worker.dailyRate.toString());
      setPhone(worker.phone || "");
      setAddress(worker.address || "");
      setNotes(worker.notes || "");
      setPhotoUri(worker.photoUri);
      setSelectedProjectId(worker.projectId);
    }
  };

  const handlePickPhoto = () => {
    Alert.alert(t.workers.addPhoto, "", [
      {
        text: "Camera",
        onPress: pickFromCamera,
      },
      {
        text: "Gallery",
        onPress: pickFromGallery,
      },
      { text: t.common.cancel, style: "cancel" },
    ]);
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t.common.error, "Camera permission denied");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t.common.error, "Gallery permission denied");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t.common.error, t.workers.enterName);
      return;
    }

    const rate = parseFloat(dailyRate);
    if (isNaN(rate) || rate <= 0) {
      Alert.alert(t.common.error, t.workers.enterRate);
      return;
    }

    setIsLoading(true);

    try {
      let finalPhotoUri = photoUri;
      if (
        photoUri &&
        !photoUri.startsWith("http://") &&
        !photoUri.startsWith("https://")
      ) {
        try {
          finalPhotoUri = await uploadImageToServer(photoUri);
        } catch (e) {
          console.warn(
            "Failed to upload worker image to server, saving locally",
            e,
          );
        }
      }

      if (isEditing && workerId) {
        const workers = await storage.getWorkers();
        const existingWorker = workers.find((w) => w.id === workerId);
        if (existingWorker) {
          const updatedWorker: Worker = {
            ...existingWorker,
            name: name.trim(),
            category,
            dailyRate: rate,
            phone: phone.trim() || undefined,
            address: address.trim() || undefined,
            notes: notes.trim() || undefined,
            photoUri: finalPhotoUri,
            projectId: selectedProjectId,
          };
          await storage.updateWorker(updatedWorker);
        }
      } else {
        const newWorker: Worker = {
          id: generateId(),
          name: name.trim(),
          category,
          dailyRate: rate,
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
          photoUri: finalPhotoUri,
          createdAt: Date.now(),
          projectId: selectedProjectId,
        };
        await storage.addWorker(newWorker);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error: any) {
      if (error.message === "LIMIT_EXCEEDED_WORKERS") {
        Alert.alert(
          "Worker Limit Reached",
          "Worker limit reached. Upgrade your plan to add more workers.",
          [
            { text: "Maybe Later", style: "cancel" },
            {
              text: "Upgrade Now",
              onPress: () => {
                navigation.goBack();
                navigation.navigate(
                  "MainTabs" as any,
                  {
                    screen: "SettingsTab",
                    params: { openUpgrade: true },
                  } as any,
                );
              },
            },
          ],
        );
      } else {
        Alert.alert(t.common.error, t.workers.saveFailed);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryColor = (cat: WorkerCategory) => {
    const colors: Record<WorkerCategory, string> = {
      labour: "#4CAF50",
      bai: "#E91E63",
      mistri: "#1E3A5F",
      bandkam: "#795548",
      plaster: "#9C27B0",
      tiles: "#00BCD4",
      sutar: "#FF9800",
    };
    return colors[cat] || "#FF6B35";
  };

  const initials = name.trim()
    ? name
        .trim()
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <ThemedView style={styles.container}>
      <ScreenKeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
      >
        {/* Photo Avatar */}
        <View style={styles.avatarSection}>
          <Pressable onPress={handlePickPhoto} style={styles.avatarWrapper}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatar} />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  { backgroundColor: getCategoryColor(category) },
                ]}
              >
                <ThemedText style={styles.avatarInitials}>
                  {initials}
                </ThemedText>
              </View>
            )}
            <View
              style={[styles.cameraIcon, { backgroundColor: theme.primary }]}
            >
              <Feather name="camera" size={14} color="#FFFFFF" />
            </View>
          </Pressable>
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, marginTop: Spacing.sm }}
          >
            {photoUri ? t.workers.changePhoto : t.workers.addPhoto}
          </ThemedText>
        </View>

        {/* Basic Info */}
        <View style={styles.formGroup}>
          <ThemedText type="h4" style={styles.label}>
            {t.workers.name}
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                color: theme.text,
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.border,
              },
            ]}
            value={name}
            onChangeText={setName}
            placeholder={t.workers.name}
            placeholderTextColor={theme.textSecondary}
            autoFocus={!isEditing}
          />
        </View>

        {/* Category */}
        <View style={styles.formGroup}>
          <ThemedText type="h4" style={styles.label}>
            {t.workers.category}
          </ThemedText>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCategory(cat);
                }}
                style={[
                  styles.categoryItem,
                  {
                    backgroundColor:
                      category === cat
                        ? getCategoryColor(cat)
                        : theme.backgroundDefault,
                    borderColor:
                      category === cat ? getCategoryColor(cat) : theme.border,
                  },
                ]}
              >
                <ThemedText
                  type="small"
                  style={{
                    color: category === cat ? "#FFFFFF" : theme.text,
                    fontWeight: category === cat ? "600" : "400",
                  }}
                >
                  {t.categories[cat]}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Daily Rate */}
        <View style={styles.formGroup}>
          <ThemedText type="h4" style={styles.label}>
            {t.workers.dailyRate} ({t.common.currency})
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                color: theme.text,
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.border,
              },
            ]}
            value={dailyRate}
            onChangeText={setDailyRate}
            placeholder="500"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
          />
        </View>

        {/* Project Assignment */}
        <View style={styles.formGroup}>
          <ThemedText type="h4" style={styles.label}>
            Assign to Project/Site
          </ThemedText>
          <View style={styles.projectListSelect}>
            {projects.length === 0 ? (
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                No project sites created yet. Create projects under Settings to
                assign workers.
              </ThemedText>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: Spacing.sm }}
              >
                <Pressable
                  onPress={() => setSelectedProjectId(undefined)}
                  style={[
                    styles.projectSelectItem,
                    {
                      backgroundColor: !selectedProjectId
                        ? theme.primary
                        : theme.backgroundDefault,
                      borderColor: !selectedProjectId
                        ? theme.primary
                        : theme.border,
                    },
                  ]}
                >
                  <ThemedText
                    style={{
                      color: !selectedProjectId ? "#FFFFFF" : theme.text,
                      fontSize: 13,
                      fontWeight: "600",
                    }}
                  >
                    Unassigned
                  </ThemedText>
                </Pressable>
                {projects.map((proj) => {
                  const isSelected = selectedProjectId === proj.id;
                  return (
                    <Pressable
                      key={proj.id}
                      onPress={() => setSelectedProjectId(proj.id)}
                      style={[
                        styles.projectSelectItem,
                        {
                          backgroundColor: isSelected
                            ? theme.primary
                            : theme.backgroundDefault,
                          borderColor: isSelected
                            ? theme.primary
                            : theme.border,
                        },
                      ]}
                    >
                      <ThemedText
                        style={{
                          color: isSelected ? "#FFFFFF" : theme.text,
                          fontSize: 13,
                          fontWeight: "600",
                        }}
                      >
                        {proj.name}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>

        {/* Contact Info */}
        <SectionHeader title={t.workers.contactInfo} />
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.cardRow}>
            <Feather
              name="phone"
              size={18}
              color={theme.textSecondary}
              style={styles.rowIcon}
            />
            <TextInput
              style={[styles.cardInput, { color: theme.text }]}
              value={phone}
              onChangeText={setPhone}
              placeholder={`${t.workers.phone} (${t.workers.optional})`}
              placeholderTextColor={theme.textSecondary}
              keyboardType="phone-pad"
            />
          </View>
          <View
            style={[styles.cardDivider, { backgroundColor: theme.border }]}
          />
          <View style={styles.cardRow}>
            <Feather
              name="map-pin"
              size={18}
              color={theme.textSecondary}
              style={styles.rowIcon}
            />
            <TextInput
              style={[styles.cardInput, { color: theme.text }]}
              value={address}
              onChangeText={setAddress}
              placeholder={`${t.workers.address} (${t.workers.optional})`}
              placeholderTextColor={theme.textSecondary}
            />
          </View>
        </View>

        {/* Notes */}
        <SectionHeader title={t.workers.additionalInfo} />
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
        >
          <TextInput
            style={[styles.notesInput, { color: theme.text }]}
            value={notes}
            onChangeText={setNotes}
            placeholder={t.workers.notesPlaceholder}
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Save Button */}
        <AnimatedPressable
          onPress={handleSave}
          onPressIn={() => {
            saveButtonScale.value = withSpring(0.96);
          }}
          onPressOut={() => {
            saveButtonScale.value = withSpring(1);
          }}
          disabled={isLoading}
          style={[
            styles.saveButton,
            { backgroundColor: theme.primary, opacity: isLoading ? 0.6 : 1 },
            animatedSaveStyle,
          ]}
        >
          <ThemedText style={styles.saveButtonText}>
            {isLoading ? t.common.loading : t.common.save}
          </ThemedText>
        </AnimatedPressable>
      </ScreenKeyboardAwareScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: 48,
  },
  headerButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  avatarWrapper: {
    position: "relative",
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  formGroup: {
    marginBottom: Spacing.xl,
  },
  label: {
    marginBottom: Spacing.sm,
  },
  input: {
    height: 48,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryItem: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  projectListSelect: {
    marginTop: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  projectSelectItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
  },
  card: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    overflow: "hidden",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    minHeight: 48,
  },
  rowIcon: {
    marginRight: Spacing.sm,
    width: 20,
  },
  cardInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: Spacing.sm,
  },
  cardDivider: {
    height: 1,
    marginLeft: Spacing.md + 28,
  },
  notesInput: {
    fontSize: 15,
    padding: Spacing.md,
    minHeight: 80,
  },
  saveButton: {
    height: 52,
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
});
