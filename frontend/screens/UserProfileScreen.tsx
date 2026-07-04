import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  Modal,
  Image,
  Platform,
  ScrollView,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { storage, User, authenticatedFetch, API_URL } from "@/utils/storage";
import { appContextTracker } from "@/utils/appContextTracker";
import { useLanguage } from "@/hooks/useLanguage";
import { Spacing, BorderRadius, Colors, Shadows } from "@/constants/theme";

const AVATAR_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA15E",
];

export default function UserProfileScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const { user: authUser, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const finalHeaderHeight =
    headerHeight > 0
      ? headerHeight
      : insets.top + Platform.select({ ios: 44, default: 56 });
  const navigation = useNavigation<any>();

  const [user, setUser] = useState<User | null>(authUser || null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editAvatarColor, setEditAvatarColor] = useState("");

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showImageModal, setShowImageModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (authUser) {
      loadUserData();
    }
  }, [authUser]);

  useFocusEffect(
    useCallback(() => {
      if (authUser) {
        loadUserData();
      }
      appContextTracker.setContext({
        currentScreen: "Profile",
      });
    }, [authUser]),
  );

  const loadUserData = async () => {
    if (authUser) {
      const userData = await storage.getUserById(authUser.id);
      if (userData) {
        setUser(userData);
      }
    }
  };

  const requestCameraPermission = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === "granted";
    }
    return true;
  };

  const requestLibraryPermission = async () => {
    if (Platform.OS !== "web") {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === "granted";
    }
    return true;
  };

  const saveProfileImage = async (imageAsset: any) => {
    if (user) {
      const base64 = imageAsset.base64
        ? `data:image/jpeg;base64,${imageAsset.base64}`
        : imageAsset.uri;

      try {
        setIsUpdating(true);
        const res = await authenticatedFetch(`${API_URL}/auth/profile`, {
          method: "PUT",
          body: JSON.stringify({ profileImage: base64 }),
        });

        if (res.ok) {
          const resData = await res.json();
          const updated = {
            ...user,
            profileImage: resData.user.profileImage,
          };
          await storage.updateUser(updated);
          setUser(updated);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(t.common.success || "Success", t.profile.uploadSuccess);
        } else {
          Alert.alert(t.common.error || "Error", t.profile.uploadError);
        }
      } catch (err) {
        console.warn("Failed to save picture:", err);
        // Fallback local save if server offline
        const updated = { ...user, profileImage: base64 };
        await storage.updateUser(updated);
        setUser(updated);
        Alert.alert(t.common.success || "Success", t.profile.offlineSuccess);
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const handlePickFromCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert(t.profile.permissionDenied, t.profile.cameraPermission);
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      await saveProfileImage(result.assets[0]);
      setShowImageModal(false);
    }
  };

  const handlePickFromLibrary = async () => {
    const hasPermission = await requestLibraryPermission();
    if (!hasPermission) {
      Alert.alert(t.profile.permissionDenied, t.profile.libraryPermission);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      await saveProfileImage(result.assets[0]);
      setShowImageModal(false);
    }
  };

  const handleRemoveProfileImage = () => {
    Alert.alert(t.profile.removePhoto, t.profile.removeConfirm, [
      { text: t.common.cancel || "Cancel", style: "cancel" },
      {
        text: t.common.delete || "Remove",
        style: "destructive",
        onPress: async () => {
          if (user) {
            try {
              setIsUpdating(true);
              const res = await authenticatedFetch(`${API_URL}/auth/profile`, {
                method: "PUT",
                body: JSON.stringify({ profileImage: null }),
              });
              if (res.ok) {
                const updated = { ...user, profileImage: undefined };
                await storage.updateUser(updated);
                setUser(updated);
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
                Alert.alert(
                  t.common.success || "Success",
                  t.profile.removeSuccess,
                );
              } else {
                Alert.alert(t.common.error || "Error", t.profile.removeError);
              }
            } catch (err) {
              const updated = { ...user, profileImage: undefined };
              await storage.updateUser(updated);
              setUser(updated);
              Alert.alert(
                t.common.success || "Success",
                t.profile.removeOfflineSuccess,
              );
            } finally {
              setIsUpdating(false);
              setShowImageModal(false);
            }
          }
        },
      },
    ]);
  };

  const openEditModal = () => {
    if (user) {
      setEditName(user.name);
      setEditEmail(user.email || "");
      setEditPhone(user.phone || "");
      setEditAddress(user.address || "");
      setEditAvatarColor(user.avatarColor || "#4ECDC4");
      setShowEditModal(true);
    }
  };

  const handleSaveProfile = async () => {
    const currentUser = user;
    if (!currentUser) return;

    if (!editName.trim() || !editPhone.trim()) {
      Alert.alert(t.common.error || "Error", t.profile.errorFieldsRequired);
      return;
    }
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(editPhone.trim())) {
      Alert.alert(t.common.error || "Error", t.supervisor.errorPhoneInvalid);
      return;
    }
    if (editEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(editEmail.trim())) {
        Alert.alert(t.common.error || "Error", t.profile.errorEmail);
        return;
      }
    }

    try {
      setIsUpdating(true);
      const res = await authenticatedFetch(`${API_URL}/auth/profile`, {
        method: "PUT",
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim() || undefined,
          phone: editPhone.trim(),
          address: editAddress.trim(),
          avatarColor: editAvatarColor,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        Alert.alert(
          t.common.error || "Error",
          errorData.error || t.profile.error,
        );
        return;
      }

      const resData = await res.json();
      const updated: User = {
        ...currentUser,
        ...resData.user,
        id: currentUser.id,
        role: currentUser.role,
        createdAt: new Date(resData.user.createdAt || Date.now()).getTime(),
      };

      await storage.updateUser(updated);
      setUser(updated);

      const auth = await storage.getAuth();
      if (auth) {
        await storage.setAuth({
          ...auth,
          phone: updated.phone,
          plan: updated.plan,
        });
      }

      setShowEditModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t.common.success || "Success", t.profile.success);
    } catch (err: any) {
      // Offline fallback
      const updated: User = {
        ...currentUser,
        name: editName.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim(),
        address: editAddress.trim(),
        avatarColor: editAvatarColor,
      };
      await storage.updateUser(updated);
      setUser(updated);
      setShowEditModal(false);
      Alert.alert(t.common.success || "Success", t.profile.success);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert(t.common.error || "Error", t.admin.errorFields);
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t.common.error || "Error", t.profile.passwordMismatch);
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert(t.common.error || "Error", t.profile.passwordLength);
      return;
    }

    try {
      setIsUpdating(true);
      const res = await authenticatedFetch(`${API_URL}/auth/change-password`, {
        method: "PUT",
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        Alert.alert(
          t.common.error || "Error",
          errorData.error || t.profile.passwordError,
        );
        return;
      }

      setShowPasswordModal(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t.common.success || "Success", t.profile.passwordSuccess);
    } catch (err: any) {
      Alert.alert(
        t.common.error || "Error",
        err.message || t.profile.passwordError,
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        `${t.profile.deleteAccountTitle}\n\n${t.profile.deleteAccountConfirm}`,
      );
      if (confirmed && user) {
        setIsUpdating(true);
        try {
          await storage.deleteUser(user.id);
          await logout();
        } catch (err: any) {
          alert(err.message || "Failed to delete account. Please try again.");
        } finally {
          setIsUpdating(false);
        }
      }
      return;
    }

    Alert.alert(t.profile.deleteAccountTitle, t.profile.deleteAccountConfirm, [
      { text: t.common.cancel || "Cancel", style: "cancel" },
      {
        text: t.profile.deleteAccountBtn,
        style: "destructive",
        onPress: async () => {
          if (user) {
            setIsUpdating(true);
            try {
              await storage.deleteUser(user.id);
              await logout();
            } catch (err: any) {
              Alert.alert(
                t.common.error || "Error",
                err.message || t.profile.deleteAccountError,
              );
            } finally {
              setIsUpdating(false);
            }
          }
        },
      },
    ]);
  };

  const getRoleLabel = (r: string) => {
    if (r === "contractor") return "👷 " + t.profile.contractor;
    if (r === "builder") return "🏗️ " + t.profile.builder;
    if (r === "supervisor") return "👨💼 " + t.profile.supervisor;
    return r.toUpperCase();
  };

  const getRoleColor = (r: string) => {
    if (r === "contractor") return "#FF6B35"; // Orange
    if (r === "builder") return "#2196F3"; // Blue
    if (r === "supervisor") return "#4CAF50"; // Green
    return theme.primary;
  };

  const getPlanLabel = (p: string) => {
    if (p === "free") return "Free";
    if (p === "professional" || p === "pro") return "Professional";
    if (p === "business") return "Business";
    return p;
  };

  const getPlanColor = (p: string) => {
    if (p === "free") return "#9E9E9E";
    if (p === "professional" || p === "pro") return "#7C3AED";
    if (p === "business") return "#E53935";
    return theme.primary;
  };

  if (!user) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  const initials = (user.name || "?").charAt(0).toUpperCase();

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingTop: finalHeaderHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── TOP HERO PROFILE CARD ── */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
        >
          <LinearGradient
            colors={
              isDark
                ? ["rgba(99, 102, 241, 0.1)", "rgba(15, 23, 42, 0.95)"]
                : ["rgba(30, 58, 95, 0.05)", "rgba(255, 255, 255, 0.98)"]
            }
            style={styles.heroGradient}
          >
            {/* Circular Profile Picture */}
            <Pressable
              onPress={() => setShowImageModal(true)}
              style={styles.avatarContainer}
            >
              {user.profileImage ? (
                <Image
                  source={{ uri: user.profileImage }}
                  style={styles.avatarImage}
                />
              ) : (
                <View
                  style={[
                    styles.avatarPlaceholder,
                    { backgroundColor: user.avatarColor || "#4ECDC4" },
                  ]}
                >
                  <ThemedText style={styles.avatarInitials}>
                    {initials}
                  </ThemedText>
                </View>
              )}
              <View style={styles.cameraIconContainer}>
                <Feather name="camera" size={12} color="#FFFFFF" />
              </View>
            </Pressable>

            {/* User Details */}
            <ThemedText type="h2" style={styles.userName}>
              {user.name}
            </ThemedText>

            {/* User Role Badge */}
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: getRoleColor(user.role) + "15",
                  borderColor: getRoleColor(user.role),
                },
              ]}
            >
              <ThemedText
                style={[styles.badgeText, { color: getRoleColor(user.role) }]}
              >
                {getRoleLabel(user.role)}
              </ThemedText>
            </View>

            {/* Company Name */}
            {user.companyName ? (
              <ThemedText
                type="body"
                style={[styles.companyName, { color: theme.textSecondary }]}
              >
                🏢 {user.companyName}
              </ThemedText>
            ) : null}

            {/* Plan Badge */}
            <View
              style={[
                styles.planBadge,
                { backgroundColor: getPlanColor(user.plan || "free") },
              ]}
            >
              <ThemedText style={styles.planBadgeText}>
                {t.profile.plan || "Plan"}: {getPlanLabel(user.plan || "free")}
              </ThemedText>
            </View>
          </LinearGradient>
        </View>

        {/* ── ACCOUNT DETAILS SECTION ── */}
        <View
          style={[
            styles.detailsSection,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
        >
          <ThemedText type="h3" style={styles.sectionTitle}>
            {t.profile.accountInfo}
          </ThemedText>

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrapper}>
              <Feather name="phone" size={16} color={theme.textSecondary} />
            </View>
            <View style={styles.infoTextWrapper}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {t.profile.mobile}
              </ThemedText>
              <ThemedText type="body" style={styles.infoValue}>
                {user.phone}
              </ThemedText>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrapper}>
              <Feather name="mail" size={16} color={theme.textSecondary} />
            </View>
            <View style={styles.infoTextWrapper}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {t.profile.email}
              </ThemedText>
              <ThemedText type="body" style={styles.infoValue}>
                {user.email || t.profile.notProvided}
              </ThemedText>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrapper}>
              <Feather name="map-pin" size={16} color={theme.textSecondary} />
            </View>
            <View style={styles.infoTextWrapper}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {t.profile.businessAddress}
              </ThemedText>
              <ThemedText type="body" style={styles.infoValue}>
                {user.address || t.profile.notProvided}
              </ThemedText>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrapper}>
              <Feather name="calendar" size={16} color={theme.textSecondary} />
            </View>
            <View style={styles.infoTextWrapper}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {t.profile.memberSince}
              </ThemedText>
              <ThemedText type="body" style={styles.infoValue}>
                {new Date(user.createdAt).toLocaleDateString("en-IN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </ThemedText>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrapper}>
              <Feather name="hash" size={16} color={theme.textSecondary} />
            </View>
            <View style={styles.infoTextWrapper}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {t.profile.userId}
              </ThemedText>
              <ThemedText
                type="small"
                style={[
                  styles.infoValue,
                  {
                    fontSize: 11,
                    fontFamily: Platform.select({
                      ios: "Courier",
                      android: "monospace",
                    }),
                  },
                ]}
              >
                {user.id}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* ── ACTION BUTTONS ── */}
        <View style={styles.buttonsGroup}>
          <Pressable
            onPress={openEditModal}
            style={[styles.actionButton, { backgroundColor: theme.primary }]}
          >
            <Feather name="edit-2" size={16} color="#FFFFFF" />
            <ThemedText style={styles.actionButtonText}>
              {t.profile.editProfile}
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setShowPasswordModal(true)}
            style={[
              styles.actionButton,
              {
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.border,
                borderWidth: 1,
              },
            ]}
          >
            <Feather name="lock" size={16} color={theme.text} />
            <ThemedText
              style={[styles.actionButtonText, { color: theme.text }]}
            >
              {t.profile.changePassword}
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={handleDeleteAccount}
            style={[styles.deleteButton, { borderColor: theme.error }]}
          >
            <Feather name="trash-2" size={16} color={theme.error} />
            <ThemedText style={styles.deleteButtonText}>
              {t.profile.deleteAccountTitle}
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>

      {/* ── IMAGE EDIT SHEET MODAL ── */}
      <Modal
        visible={showImageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowImageModal(false)}
        >
          <View
            style={[
              styles.bottomSheet,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <ThemedText type="h3" style={styles.sheetTitle}>
              {t.profile.editAvatar}
            </ThemedText>

            <Pressable
              onPress={handlePickFromCamera}
              style={styles.sheetOption}
            >
              <Feather name="camera" size={20} color={theme.text} />
              <ThemedText style={styles.sheetOptionText}>
                {t.profile.camera}
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={handlePickFromLibrary}
              style={styles.sheetOption}
            >
              <Feather name="image" size={20} color={theme.text} />
              <ThemedText style={styles.sheetOptionText}>
                {t.profile.library}
              </ThemedText>
            </Pressable>

            {user.profileImage ? (
              <Pressable
                onPress={handleRemoveProfileImage}
                style={styles.sheetOption}
              >
                <Feather name="trash-2" size={20} color={theme.error} />
                <ThemedText
                  style={[styles.sheetOptionText, { color: theme.error }]}
                >
                  {t.profile.removePhoto}
                </ThemedText>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => setShowImageModal(false)}
              style={[styles.sheetCloseBtn, { backgroundColor: theme.border }]}
            >
              <ThemedText style={{ fontWeight: "700" }}>
                {t.common.cancel || "Cancel"}
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ── EDIT PROFILE FORM MODAL ── */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.formModalContainer}>
          <ThemedView
            style={[
              styles.formContent,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <View style={styles.formHeader}>
              <ThemedText type="h2">{t.profile.editProfile}</ThemedText>
              <Pressable
                onPress={() => setShowEditModal(false)}
                style={styles.formCloseIcon}
              >
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.formScroll}>
              <ThemedText type="small" style={styles.label}>
                {t.profile.fullName}
              </ThemedText>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor: theme.backgroundSecondary,
                  },
                ]}
                value={editName}
                onChangeText={setEditName}
                placeholder={t.profile.fullName}
                placeholderTextColor={theme.textSecondary}
              />

              <ThemedText type="small" style={styles.label}>
                {t.profile.mobile}
              </ThemedText>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor: theme.backgroundSecondary,
                  },
                ]}
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
                placeholder={t.profile.mobile}
                placeholderTextColor={theme.textSecondary}
              />

              <ThemedText type="small" style={styles.label}>
                {t.profile.email}
              </ThemedText>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor: theme.backgroundSecondary,
                  },
                ]}
                value={editEmail}
                onChangeText={setEditEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder={t.profile.email}
                placeholderTextColor={theme.textSecondary}
              />

              <ThemedText type="small" style={styles.label}>
                {t.profile.businessAddress}
              </ThemedText>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor: theme.backgroundSecondary,
                    height: 80,
                  },
                ]}
                value={editAddress}
                onChangeText={setEditAddress}
                multiline
                numberOfLines={3}
                placeholder={t.profile.businessAddress}
                placeholderTextColor={theme.textSecondary}
              />

              {/* Avatar Color Selector */}
              <ThemedText type="small" style={styles.label}>
                {t.profile.avatarColor}
              </ThemedText>
              <View style={styles.colorPalette}>
                {AVATAR_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setEditAvatarColor(c)}
                    style={[
                      styles.colorOption,
                      {
                        backgroundColor: c,
                        borderWidth: editAvatarColor === c ? 3 : 0,
                        borderColor: theme.text,
                      },
                    ]}
                  />
                ))}
              </View>

              {isUpdating ? (
                <ActivityIndicator
                  size="small"
                  color={theme.primary}
                  style={{ marginVertical: Spacing.md }}
                />
              ) : null}

              <View style={styles.formActions}>
                <Pressable
                  onPress={() => setShowEditModal(false)}
                  style={[
                    styles.formBtn,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      borderColor: theme.border,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <ThemedText style={{ color: theme.text }}>
                    {t.common.cancel || "Cancel"}
                  </ThemedText>
                </Pressable>

                <Pressable
                  onPress={handleSaveProfile}
                  disabled={isUpdating}
                  style={[styles.formBtn, { backgroundColor: theme.primary }]}
                >
                  <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>
                    {t.profile.saveChanges}
                  </ThemedText>
                </Pressable>
              </View>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      {/* ── CHANGE PASSWORD MODAL ── */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.formModalContainer}>
          <ThemedView
            style={[
              styles.formContent,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <View style={styles.formHeader}>
              <ThemedText type="h2">{t.profile.changePassword}</ThemedText>
              <Pressable
                onPress={() => setShowPasswordModal(false)}
                style={styles.formCloseIcon}
              >
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.formScroll}>
              <ThemedText type="small" style={styles.label}>
                {t.profile.oldPassword}
              </ThemedText>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor: theme.backgroundSecondary,
                  },
                ]}
                secureTextEntry
                value={oldPassword}
                onChangeText={setOldPassword}
                placeholder={t.profile.oldPassword}
                placeholderTextColor={theme.textSecondary}
              />

              <ThemedText type="small" style={styles.label}>
                {t.profile.newPassword}
              </ThemedText>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor: theme.backgroundSecondary,
                  },
                ]}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder={t.profile.passwordLength}
                placeholderTextColor={theme.textSecondary}
              />

              <ThemedText type="small" style={styles.label}>
                {t.profile.confirmPassword}
              </ThemedText>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor: theme.backgroundSecondary,
                  },
                ]}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={t.profile.confirmPassword}
                placeholderTextColor={theme.textSecondary}
              />

              {isUpdating ? (
                <ActivityIndicator
                  size="small"
                  color={theme.primary}
                  style={{ marginVertical: Spacing.md }}
                />
              ) : null}

              <View style={styles.formActions}>
                <Pressable
                  onPress={() => setShowPasswordModal(false)}
                  style={[
                    styles.formBtn,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      borderColor: theme.border,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <ThemedText style={{ color: theme.text }}>
                    {t.common.cancel || "Cancel"}
                  </ThemedText>
                </Pressable>

                <Pressable
                  onPress={handleChangePassword}
                  disabled={isUpdating}
                  style={[styles.formBtn, { backgroundColor: theme.primary }]}
                >
                  <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>
                    {t.profile.changePassword}
                  </ThemedText>
                </Pressable>
              </View>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Hero Profile Card
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  heroGradient: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    position: "relative",
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    fontSize: 40,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  cameraIconContainer: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#FF6B35",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  userName: {
    fontWeight: "800",
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  companyName: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  planBadge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    borderRadius: 20,
    ...Shadows.xs,
  },
  planBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  // Account Information Section
  detailsSection: {
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  sectionTitle: {
    fontWeight: "800",
    marginBottom: Spacing.lg,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  infoIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  infoTextWrapper: {
    flex: 1,
  },
  infoValue: {
    fontWeight: "600",
    marginTop: 2,
  },

  // Buttons group
  buttonsGroup: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  actionButton: {
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.sm,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  deleteButton: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  deleteButtonText: {
    color: "#FF3B30",
    fontWeight: "700",
    fontSize: 15,
  },

  // Image sheets
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  sheetTitle: {
    fontWeight: "800",
    marginBottom: Spacing.xs,
  },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  sheetOptionText: {
    fontSize: 15,
    fontWeight: "600",
  },
  sheetCloseBtn: {
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.sm,
  },

  // Form Modals
  formModalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  formContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 40,
    maxHeight: "90%",
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  formCloseIcon: {
    padding: 4,
  },
  formScroll: {
    gap: Spacing.md,
  },
  label: {
    fontWeight: "700",
    marginBottom: 4,
  },
  inputField: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  colorPalette: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  formActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  formBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
});
