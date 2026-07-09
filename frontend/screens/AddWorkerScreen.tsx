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
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

const CATEGORY_DETAILS: Record<WorkerCategory, { emoji: string; color: string }> = {
  labour: { emoji: "👷‍♂️", color: "#10B981" },
  bai: { emoji: "👩", color: "#EC4899" },
  mistri: { emoji: "📐", color: "#6366F1" },
  bandkam: { emoji: "🧱", color: "#8B5CF6" },
  plaster: { emoji: "🌫️", color: "#06B6D4" },
  tiles: { emoji: "🔲", color: "#3B82F6" },
  sutar: { emoji: "🪚", color: "#F59E0B" },
};

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
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "AddWorker">>();

  const workerId = route.params?.workerId;
  const isEditing = !!workerId;

  const [name, setName] = useState("");
  const [category, setCategory] = useState<WorkerCategory>("labour");
  const [dailyRate, setDailyRate] = useState("");
  const [skillCategory, setSkillCategory] = useState<"skilled" | "semi_skilled" | "unskilled">("unskilled");
  const [paymentType, setPaymentType] = useState<"daily" | "piece_rate" | "contract">("daily");
  const [pieceRateAmount, setPieceRateAmount] = useState("");
  const [subContractorName, setSubContractorName] = useState("");
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
      setSkillCategory(worker.skillCategory || "unskilled");
      setPaymentType(worker.paymentType || "daily");
      setPieceRateAmount((worker.pieceRateAmount || 0).toString());
      setSubContractorName(worker.subContractorName || "");
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
            skillCategory,
            paymentType,
            pieceRateAmount: parseFloat(pieceRateAmount) || 0,
            subContractorName: subContractorName.trim() || undefined,
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
          skillCategory,
          paymentType,
          pieceRateAmount: parseFloat(pieceRateAmount) || 0,
          subContractorName: subContractorName.trim() || undefined,
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
      {/* Custom Header Bar */}
      <View
        style={[
          styles.customHeader,
          {
            paddingTop: insets.top > 0 ? insets.top + Spacing.sm : Spacing.md,
            borderBottomColor: theme.border,
            borderBottomWidth: 1.8,
            backgroundColor: theme.backgroundDefault,
          },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.customHeaderBtnLeft}
        >
          <ThemedText style={{ color: theme.primary, fontSize: 16, fontWeight: "600" }}>
            {t.common.cancel}
          </ThemedText>
        </Pressable>
        <ThemedText type="h3" style={{ fontWeight: "700" }}>
          {isEditing ? t.workers.editWorker : t.workers.addWorker}
        </ThemedText>
        {/* Placeholder to keep title centered */}
        <View style={styles.customHeaderBtnRight} />
      </View>

      <ScreenKeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
      >
        {/* Photo Avatar */}
        <View style={styles.avatarSection}>
          <Pressable
            onPress={handlePickPhoto}
            style={[
              styles.avatarWrapper,
              { borderColor: CATEGORY_DETAILS[category]?.color || theme.primary }
            ]}
          >
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatar} />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  { backgroundColor: CATEGORY_DETAILS[category]?.color || theme.primary },
                ]}
              >
                <ThemedText style={styles.avatarInitials}>
                  {initials}
                </ThemedText>
              </View>
            )}
            <View
              style={[
                styles.cameraIcon,
                {
                  backgroundColor: CATEGORY_DETAILS[category]?.color || theme.primary,
                  borderColor: theme.backgroundDefault,
                }
              ]}
            >
              <Feather name="camera" size={14} color="#FFFFFF" />
            </View>
          </Pressable>
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, marginTop: Spacing.sm, fontWeight: "700" }}
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

        {/* Category Selection Grid */}
        <View style={styles.formGroup}>
          <ThemedText type="h4" style={styles.label}>
            {t.workers.category}
          </ThemedText>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => {
              const details = CATEGORY_DETAILS[cat];
              const isSelected = category === cat;
              const activeColor = details ? details.color : theme.primary;
              return (
                <Pressable
                  key={cat}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setCategory(cat);
                  }}
                  style={[
                    styles.categoryItem,
                    {
                      backgroundColor: isSelected
                        ? activeColor + "12"
                        : theme.backgroundDefault,
                      borderColor: isSelected
                        ? activeColor
                        : theme.border,
                    },
                  ]}
                >
                  <ThemedText style={{ fontSize: 20 }}>
                    {details ? details.emoji : "🛠️"}
                  </ThemedText>
                  <ThemedText
                    type="body"
                    style={{
                      color: isSelected ? activeColor : theme.text,
                      fontWeight: "700",
                      fontSize: 14,
                    }}
                  >
                    {t.categories[cat]}
                  </ThemedText>
                </Pressable>
              );
            })}
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

        {/* Skill Category */}
        <View style={styles.formGroup}>
          <ThemedText type="h4" style={styles.label}>
            Skill Category
          </ThemedText>
          <View style={styles.pillRow}>
            {(["skilled", "semi_skilled", "unskilled"] as const).map((skill) => {
              const isSelected = skillCategory === skill;
              const skillLabels = {
                skilled: "Skilled (Mistri)",
                semi_skilled: "Semi-Skilled",
                unskilled: "Unskilled"
              };
              return (
                <Pressable
                  key={skill}
                  onPress={() => setSkillCategory(skill)}
                  style={[
                    styles.pillButton,
                    isSelected && {
                      backgroundColor: theme.primary,
                      borderColor: theme.primary,
                    },
                    { borderColor: theme.border },
                  ]}
                >
                  <ThemedText
                    style={{
                      color: isSelected ? "#FFFFFF" : theme.text,
                      fontWeight: "600",
                      fontSize: 12,
                    }}
                  >
                    {skillLabels[skill]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Payment Type */}
        <View style={styles.formGroup}>
          <ThemedText type="h4" style={styles.label}>
            Payment Type
          </ThemedText>
          <View style={styles.pillRow}>
            {(["daily", "piece_rate", "contract"] as const).map((pay) => {
              const isSelected = paymentType === pay;
              const payLabels = {
                daily: "Daily Wage",
                piece_rate: "Piece Rate",
                contract: "Contract"
              };
              return (
                <Pressable
                  key={pay}
                  onPress={() => setPaymentType(pay)}
                  style={[
                    styles.pillButton,
                    isSelected && {
                      backgroundColor: theme.primary,
                      borderColor: theme.primary,
                    },
                    { borderColor: theme.border },
                  ]}
                >
                  <ThemedText
                    style={{
                      color: isSelected ? "#FFFFFF" : theme.text,
                      fontWeight: "600",
                      fontSize: 12,
                    }}
                  >
                    {payLabels[pay]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Piece Rate Amount (Conditional) */}
        {paymentType === "piece_rate" && (
          <View style={styles.formGroup}>
            <ThemedText type="h4" style={styles.label}>
              Piece Rate Amount ({t.common.currency})
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
              value={pieceRateAmount}
              onChangeText={setPieceRateAmount}
              placeholder="e.g. 150"
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
            />
          </View>
        )}

        {/* Sub-contractor / Agency Name */}
        <View style={styles.formGroup}>
          <ThemedText type="h4" style={styles.label}>
            Sub-contractor / Labour Contractor Name (Optional)
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
            value={subContractorName}
            onChangeText={setSubContractorName}
            placeholder="e.g. Verma Labour Supply"
            placeholderTextColor={theme.textSecondary}
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
                      fontWeight: "700",
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
                          fontWeight: "700",
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
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  customHeaderBtnLeft: {
    paddingVertical: Spacing.xs,
    minWidth: 60,
    alignItems: "flex-start",
  },
  customHeaderBtnRight: {
    paddingVertical: Spacing.xs,
    minWidth: 60,
    alignItems: "flex-end",
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 48,
  },
  headerButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
    marginTop: Spacing.lg,
  },
  avatarWrapper: {
    position: "relative",
    padding: 4,
    borderRadius: 9999,
    borderWidth: 2.2,
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 9999,
  },
  avatarPlaceholder: {
    width: 92,
    height: 92,
    borderRadius: 9999,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  cameraIcon: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2.5,
  },
  formGroup: {
    marginBottom: Spacing.xl,
  },
  label: {
    marginBottom: Spacing.sm,
    fontWeight: "700",
  },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1.8,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: Spacing.md,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md - 2,
    paddingHorizontal: Spacing.md,
    borderRadius: 14,
    borderWidth: 1.8,
    flexBasis: "48%",
    gap: Spacing.sm,
  },
  projectListSelect: {
    marginTop: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  projectSelectItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    borderWidth: 1.8,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1.8,
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
    height: 1.5,
    marginLeft: Spacing.md + 28,
  },
  notesInput: {
    fontSize: 15,
    padding: Spacing.md,
    minHeight: 80,
  },
  saveButton: {
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  pillButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    borderWidth: 1.8,
  },
});
