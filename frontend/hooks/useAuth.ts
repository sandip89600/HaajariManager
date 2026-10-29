import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";
import {
  storage,
  AuthData,
  User,
  generateId,
  API_URL,
  authenticatedFetch,
} from "@/utils/storage";
import { getDeviceHeaders } from "@/utils/device";
import { navigationRef } from "@/navigation/navigationRef";

interface AuthContextType {
  isLoggedIn: boolean;
  isGuest: boolean;
  isLoading: boolean;
  userId: string;
  uniqueId: string;
  role: "contractor" | "builder" | "supervisor" | "labor" | "admin" | "worker";
  isContractor: boolean;
  isSupervisor: boolean;
  isWorker: boolean;
  userType: "admin" | "user" | "guest";
  email: string; // Used as the identifier (phone/email/username)
  user: User | null;
  newDeviceAlert: any | null;
  clearNewDeviceAlert: () => void;
  setNewDeviceAlert: (info: any) => void;
  refreshUserProfile: () => Promise<void>;
  login: (
    identifier: string,
    password?: string,
    otp?: string,
    rememberMe?: boolean,
  ) => Promise<any>;
  signup: (
    name: string,
    phone?: string,
    password?: string,
    role?: "contractor" | "builder" | "supervisor" | "labor" | "worker",
    companyName?: string,
    email?: string,
    username?: string,
    contractorName?: string,
    contractorCompany?: string,
    workerCategory?: string,
    dailyWage?: number,
  ) => Promise<{
    success: boolean;
    field?: string;
    message?: string;
    emailVerificationSent?: boolean;
    email?: string;
  }>;
  loginAsGuest: () => void;
  logout: () => Promise<void>;
  loginWithBiometrics: (
    phone: string,
    token: string,
    rememberMe?: boolean,
  ) => Promise<boolean>;
  loginWithGoogle: (
    idToken?: string,
    accessToken?: string,
    phone?: string,
    otp?: string,
    name?: string,
    companyName?: string,
    role?: "contractor" | "builder",
    googleId?: string,
    email?: string,
  ) => Promise<any>;
  loginWithFirebasePhone: (
    idToken: string,
    phone: string,
    rememberMe?: boolean,
  ) => Promise<any>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

const AVATAR_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA15E",
];

export function useAuthProvider() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [userType, setUserType] = useState<"admin" | "user" | "guest">("user");
  const [email, setEmail] = useState(""); // identifier
  const [user, setUser] = useState<User | null>(null);
  const [newDeviceAlert, setNewDeviceAlert] = useState<any | null>(null);

  const clearNewDeviceAlert = useCallback(() => {
    setNewDeviceAlert(null);
  }, []);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const auth = await storage.getAuth();
      if (auth?.isLoggedIn && auth?.rememberMe) {
        setIsLoggedIn(true);
        setUserId(auth.userId);
        setUserType(auth.userType);
        setEmail(auth.phone || auth.email || "");
        let userData = await storage.getUserById(auth.userId);
        if (auth.token) {
          try {
            const res = await authenticatedFetch(`${API_URL}/auth/profile`);
            if (res.ok) {
              const profileData = await res.json();
              const serverUser = profileData.user;
              if (serverUser) {
                const tenantObj =
                  typeof serverUser.tenantId === "object"
                    ? serverUser.tenantId
                    : null;
                userData = {
                  id: serverUser._id || serverUser.id || auth.userId,
                  uniqueId:
                    serverUser.uniqueId || (userData ? userData.uniqueId : ""),
                  name: serverUser.name || (userData ? userData.name : ""),
                  phone: serverUser.phone || "",
                  email: serverUser.email || "",
                  username: serverUser.username || "",
                  isPhoneVerified: !!serverUser.isPhoneVerified,
                  avatarColor: serverUser.avatarColor || "#4ECDC4",
                  profileImage: serverUser.profileImage || undefined,
                  address: serverUser.address || "",
                  role: serverUser.role || auth.role || "contractor",
                  workerCategory:
                    serverUser.workerCategory ||
                    (userData ? userData.workerCategory : ""),
                  dailyWage:
                    serverUser.dailyWage !== undefined
                      ? serverUser.dailyWage
                      : userData
                        ? userData.dailyWage
                        : undefined,
                  contractorName:
                    serverUser.contractorName ||
                    (userData ? userData.contractorName : ""),
                  contractorCompany:
                    serverUser.contractorCompany ||
                    (userData ? userData.contractorCompany : ""),
                  connectionStatus:
                    serverUser.connectionStatus ||
                    (userData ? userData.connectionStatus : "not_connected"),
                  isActive: true,
                  createdAt: serverUser.createdAt
                    ? new Date(serverUser.createdAt).getTime()
                    : Date.now(),
                  loginHistory: [Date.now()],
                  companyName: tenantObj?.name || serverUser.companyName || "",
                  plan:
                    tenantObj?.plan || serverUser.plan || auth.plan || "free",
                };
                await storage.updateUser(userData);
              }
            }
          } catch (e) {
            console.log("Failed to fetch user profile during checkAuth:", e);
          }
        }
        setUser(userData);

        // Run sync on launch if logged in
        if (auth.token) {
          storage.syncWithBackend();
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(
    async (
      phone: string,
      password?: string,
      otp?: string,
      rememberMe: boolean = true,
    ): Promise<any> => {
      const phoneTrimmed = phone.trim();

      // 1. Try server login
      try {
        const url = otp
          ? `${API_URL}/auth/verify-otp-login`
          : `${API_URL}/auth/login`;
        const payload = otp
          ? { phone: phoneTrimmed, identifier: phoneTrimmed, otp }
          : {
              phone: phoneTrimmed,
              identifier: phoneTrimmed,
              email: phoneTrimmed.includes("@") ? phoneTrimmed : undefined,
              password,
            };
        const deviceHeaders = await getDeviceHeaders().catch(() => ({}));

        const res = await fetch(url, {
          method: "POST",
          headers: { ...deviceHeaders, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        let data: any = null;
        let isJson = false;
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          try {
            data = await res.json();
            isJson = true;
          } catch {}
        }

        if (res.ok && isJson && data) {
          if (data.requiresOtp) {
            return { requiresOtp: true, phone: data.phone };
          }
          if (data.isNewDevice && data.newDeviceInfo) {
            setNewDeviceAlert(data.newDeviceInfo);
          }
          const role = data.user.role;
          const uType =
            role === "admin" ? ("admin" as const) : ("user" as const);

          const authData: AuthData = {
            isLoggedIn: true,
            userId: data.user.id,
            userType: uType,
            role: role,
            phone: data.user.phone,
            email: data.user.email,
            username: data.user.username,
            isPhoneVerified: !!data.user.isPhoneVerified,
            rememberMe,
            token: data.token,
            refreshToken: data.refreshToken,
            tenantId: data.user.tenantId,
            plan: data.user.plan || "free",
          };
          await storage.setAuth(authData);
          setIsLoggedIn(true);
          setIsGuest(false);
          setUserId(data.user.id);
          setUserType(uType);
          setEmail(data.user.phone || "");

          if (role === "admin") {
            const session = {
              token: data.token,
              refreshToken: data.refreshToken,
              username: data.user.phone || "haajari896",
              loggedInAt: Date.now(),
            };
            await AsyncStorage.setItem(
              "@haajari/admin_session",
              JSON.stringify(session),
            );
          }

          const userData: User = {
            id: data.user.id,
            uniqueId: data.user.uniqueId || "",
            name: data.user.name,
            phone: data.user.phone || "",
            email: data.user.email || "",
            username: data.user.username || "",
            isPhoneVerified: !!data.user.isPhoneVerified,
            avatarColor: data.user.avatarColor || "#4ECDC4",
            profileImage: data.user.profileImage || undefined,
            address: data.user.address || "",
            role: role,
            workerCategory: data.user.workerCategory,
            dailyWage: data.user.dailyWage,
            contractorName: data.user.contractorName,
            contractorCompany: data.user.contractorCompany,
            connectionStatus: data.user.connectionStatus || "not_connected",
            isActive: true,
            createdAt: data.user.createdAt
              ? new Date(data.user.createdAt).getTime()
              : Date.now(),
            loginHistory: [Date.now()],
            companyName: data.user.companyName,
            plan: data.user.plan || "free",
          };
          await storage.updateUser(userData);
          setUser(userData);

          // Trigger background sync
          storage.syncWithBackend();

          return true;
        } else {
          // If the server explicitly returned an error JSON, propagate it
          const errorMsg = isJson && data ? data.error || data.message : null;
          if (errorMsg) {
            throw new Error(errorMsg);
          }
        }
      } catch (e: any) {
        console.warn("Backend login failed, attempting local fallback", e);
        // If it was an explicit server validation/auth error, propagate it directly
        if (
          e &&
          e.message &&
          !e.message.includes("Network request failed") &&
          !e.message.includes("Failed to fetch") &&
          !e.message.includes("JSON Parse")
        ) {
          throw e;
        }
      }

      // 2. Local Fallback for offline support (using their real stored password)
      const users = await storage.getUsers();
      const userData = users.find(
        (u) =>
          u.phone === phoneTrimmed ||
          u.email?.toLowerCase() === phoneTrimmed.toLowerCase() ||
          u.username?.toLowerCase() === phoneTrimmed.toLowerCase(),
      );

      if (userData && userData.isActive) {
        let isMatched = false;
        if (password) {
          isMatched = userData.password === password;
        }

        if (isMatched) {
          await storage.recordUserLogin(userData.id);
          const uType =
            userData.role === "admin" ? ("admin" as const) : ("user" as const);
          const authData: AuthData = {
            isLoggedIn: true,
            userId: userData.id,
            userType: uType,
            role: userData.role,
            phone: userData.phone,
            rememberMe,
            plan: userData.plan || "free",
          };
          await storage.setAuth(authData);
          setIsLoggedIn(true);
          setIsGuest(false);
          setUserId(userData.id);
          setUserType(uType);
          setEmail(userData.phone || userData.email || "");
          setUser(userData);
          return true;
        }
      }

      return false;
    },
    [],
  );

  const signup = useCallback(
    async (
      name: string,
      phone?: string,
      password?: string,
      role?: "contractor" | "builder" | "supervisor" | "labor" | "worker",
      companyName?: string,
      email?: string,
      username?: string,
      contractorName?: string,
      contractorCompany?: string,
      workerCategory?: string,
      dailyWage?: number,
    ): Promise<{
      success: boolean;
      field?: string;
      message?: string;
      emailVerificationSent?: boolean;
      email?: string;
    }> => {
      const phoneTrimmed = phone ? phone.trim() : "";

      // 1. Try server signup
      try {
        let endpoint = `${API_URL}/auth/signup`;
        if (role === "contractor") {
          endpoint = `${API_URL}/auth/register/contractor`;
        } else if (role === "supervisor") {
          endpoint = `${API_URL}/auth/register/supervisor`;
        } else if (role === "labor" || role === "worker") {
          endpoint = `${API_URL}/auth/register/labor`;
        }

        const fallbackUsername =
          (email ? email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "") : "user") +
          "_" +
          Math.random().toString(36).substring(2, 7);

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            phone: phoneTrimmed || undefined,
            password,
            role: role === "worker" ? "labor" : role,
            companyName,
            contractorName,
            contractorCompany,
            workerCategory,
            dailyWage,
            email: email ? email.toLowerCase().trim() : undefined,
            username: username ? username.toLowerCase().trim() : fallbackUsername,
          }),
        });

        const data = await res.json();

        if (res.ok) {
          const authData: AuthData = {
            isLoggedIn: true,
            userId: data.user.id,
            userType: "user",
            role: data.user.role,
            phone: data.user.phone,
            email: data.user.email,
            username: data.user.username,
            isPhoneVerified: !!data.user.isPhoneVerified,
            isEmailVerified: !!data.user.isEmailVerified,
            rememberMe: true,
            token: data.token,
            refreshToken: data.refreshToken,
            tenantId: data.user.tenantId,
            plan: data.user.plan || "free",
          };
          await storage.setAuth(authData);
          setIsLoggedIn(true);
          setIsGuest(false);
          setUserId(data.user.id);
          setUserType("user");
          setEmail(data.user.email || data.user.phone || "");

          const userData: User = {
            id: data.user.id,
            uniqueId: data.user.uniqueId || "",
            name: data.user.name,
            phone: data.user.phone || "",
            email: data.user.email || "",
            username: data.user.username || "",
            isPhoneVerified: !!data.user.isPhoneVerified,
            isEmailVerified: !!data.user.isEmailVerified,
            avatarColor: data.user.avatarColor || "#FF6B6B",
            profileImage: data.user.profileImage || undefined,
            address: data.user.address || "",
            role: data.user.role,
            workerCategory: data.user.workerCategory,
            dailyWage: data.user.dailyWage,
            contractorName: data.user.contractorName,
            contractorCompany: data.user.contractorCompany,
            connectionStatus: data.user.connectionStatus || "not_connected",
            isActive: true,
            createdAt: data.user.createdAt
              ? new Date(data.user.createdAt).getTime()
              : Date.now(),
            loginHistory: [Date.now()],
            companyName: data.user.companyName,
            plan: data.user.plan || "free",
          };
          await storage.updateUser(userData);
          setUser(userData);

          // Trigger sync
          storage.syncWithBackend();

          return {
            success: true,
            emailVerificationSent: !!data.emailVerificationSent,
            email: data.user.email,
            message: data.message,
          };
        } else {
          return {
            success: false,
            field: data.field,
            message: data.message || data.error || "Signup failed.",
          };
        }
      } catch (e) {
        console.warn("Backend signup failed, attempting local signup", e);
      }

      // 2. Local Fallback
      const existingPhone = await storage.getUserByPhone(phoneTrimmed);
      if (existingPhone) {
        return {
          success: false,
          field: "mobile",
          message: "This mobile number is already registered.",
        };
      }

      const newUser: User = {
        id: generateId(),
        name,
        phone: phoneTrimmed,
        email: email ? email.trim().toLowerCase() : "",
        username: username ? username.trim().toLowerCase() : undefined,
        password: password || "",
        avatarColor:
          AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        role: role || "contractor",
        isActive: true,
        createdAt: Date.now(),
        lastLogin: Date.now(),
        loginHistory: [Date.now()],
      };

      await storage.addUser(newUser);

      const authData: AuthData = {
        isLoggedIn: true,
        userId: newUser.id,
        userType: "user",
        role: newUser.role,
        phone: phoneTrimmed,
        rememberMe: true,
        plan: "free",
      };
      await storage.setAuth(authData);
      setIsLoggedIn(true);
      setIsGuest(false);
      setUserId(newUser.id);
      setUserType("user");
      setEmail(phoneTrimmed);
      setUser(newUser);

      return { success: true };
    },
    [],
  );

  const loginWithBiometrics = useCallback(
    async (
      phone: string,
      biometricToken: string,
      rememberMe: boolean = true,
    ): Promise<boolean> => {
      const phoneTrimmed = phone.trim();
      try {
        const res = await fetch(`${API_URL}/auth/biometric-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phoneTrimmed, biometricToken }),
        });
        if (res.ok) {
          const data = await res.json();
          const role = data.user.role;
          const uType =
            role === "admin" ? ("admin" as const) : ("user" as const);

          const authData: AuthData = {
            isLoggedIn: true,
            userId: data.user.id,
            userType: uType,
            role: role,
            phone: data.user.phone,
            rememberMe,
            token: data.token,
            refreshToken: data.refreshToken,
            tenantId: data.user.tenantId,
            plan: data.user.plan || "free",
          };
          await storage.setAuth(authData);
          setIsLoggedIn(true);
          setIsGuest(false);
          setUserId(data.user.id);
          setUserType(uType);
          setEmail(data.user.phone || "");

          if (role === "admin") {
            const session = {
              token: data.token,
              refreshToken: data.refreshToken,
              username: data.user.phone || "haajari896",
              loggedInAt: Date.now(),
            };
            await AsyncStorage.setItem(
              "@haajari/admin_session",
              JSON.stringify(session),
            );
          }

          const userData: User = {
            id: data.user.id,
            uniqueId: data.user.uniqueId || "",
            name: data.user.name,
            phone: data.user.phone || "",
            email: data.user.email || "",
            username: data.user.username || "",
            isPhoneVerified: !!data.user.isPhoneVerified,
            avatarColor: data.user.avatarColor || "#4ECDC4",
            profileImage: data.user.profileImage || undefined,
            address: data.user.address || "",
            role: role,
            workerCategory: data.user.workerCategory,
            dailyWage: data.user.dailyWage,
            contractorName: data.user.contractorName,
            contractorCompany: data.user.contractorCompany,
            connectionStatus: data.user.connectionStatus || "not_connected",
            isActive: true,
            createdAt: data.user.createdAt
              ? new Date(data.user.createdAt).getTime()
              : Date.now(),
            loginHistory: [Date.now()],
            companyName: data.user.companyName,
            plan: data.user.plan || "free",
          };
          await storage.updateUser(userData);
          setUser(userData);

          storage.syncWithBackend();
          return true;
        }
      } catch (e) {
        console.warn("Biometric backend login failed", e);
      }
      return false;
    },
    [],
  );

  const loginWithGoogle = useCallback(
    async (
      idToken?: string,
      accessToken?: string,
      phone?: string,
      otp?: string,
      name?: string,
      companyName?: string,
      role?: "contractor" | "builder",
      googleId?: string,
      email?: string,
    ): Promise<any> => {
      try {
        const deviceHeaders = await getDeviceHeaders().catch(() => ({}));
        const res = await fetch(`${API_URL}/auth/google`, {
          method: "POST",
          headers: { ...deviceHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({
            idToken,
            accessToken,
            googleId,
            email,
            phone,
            otp,
            name,
            companyName,
            role,
          }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data || !data.success) {
          return {
            success: false,
            message:
              data?.message || "Google Sign-In failed. Please try again.",
          };
        }

        if (data.requiresMobileCompletion) {
          return {
            requiresMobileCompletion: true,
            googleProfile: data.googleProfile,
            message: data.message,
          };
        }

        const uRole = data.user.role;
        const uType =
          uRole === "admin" ? ("admin" as const) : ("user" as const);

        const authData: AuthData = {
          isLoggedIn: true,
          userId: data.user.id,
          userType: uType,
          role: uRole,
          phone: data.user.phone,
          email: data.user.email,
          username: data.user.username,
          isPhoneVerified: !!data.user.isPhoneVerified,
          rememberMe: true,
          token: data.token,
          refreshToken: data.refreshToken,
          tenantId: data.user.tenantId,
          plan: data.user.plan || "free",
        };
        await storage.setAuth(authData);
        setIsLoggedIn(true);
        setIsGuest(false);
        setUserId(data.user.id);
        setUserType(uType);
        setEmail(data.user.email || data.user.phone || "");

        const userData: User = {
          id: data.user.id,
          uniqueId: data.user.uniqueId || "",
          name: data.user.name,
          phone: data.user.phone || "",
          email: data.user.email || "",
          username: data.user.username || "",
          isPhoneVerified: !!data.user.isPhoneVerified,
          avatarColor: data.user.avatarColor || "#4ECDC4",
          profileImage: data.user.profileImage || undefined,
          address: data.user.address || "",
          role: uRole,
          workerCategory: data.user.workerCategory,
          dailyWage: data.user.dailyWage,
          contractorName: data.user.contractorName,
          contractorCompany: data.user.contractorCompany,
          connectionStatus: data.user.connectionStatus || "not_connected",
          isActive: true,
          createdAt: data.user.createdAt
            ? new Date(data.user.createdAt).getTime()
            : Date.now(),
          loginHistory: [Date.now()],
          companyName: data.user.companyName,
          plan: data.user.plan || "free",
        };
        await storage.updateUser(userData);
        setUser(userData);

        storage.syncWithBackend();
        return { success: true };
      } catch (e: any) {
        console.warn("[loginWithGoogle Error]:", e);
        return {
          success: false,
          message: "Unable to connect to server. Please try again.",
        };
      }
    },
    [],
  );

  const loginWithFirebasePhone = useCallback(
    async (
      idToken: string,
      phone: string,
      rememberMe: boolean = true,
    ): Promise<any> => {
      try {
        const phoneTrimmed = phone.trim();
        const deviceHeaders = await getDeviceHeaders().catch(() => ({}));
        const res = await fetch(`${API_URL}/auth/firebase-phone-login`, {
          method: "POST",
          headers: { ...deviceHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, phone: phoneTrimmed }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data) {
          return {
            success: false,
            message: data?.message || "Firebase phone authentication failed.",
          };
        }

        if (data.isNewUser) {
          return {
            success: true,
            isNewUser: true,
            phone: data.phone,
            firebaseUid: data.firebaseUid,
            hasInvitedProfile: data.hasInvitedProfile,
          };
        }

        if (data.success && data.token) {
          const role = data.user.role;
          const uType = role === "admin" ? ("admin" as const) : ("user" as const);
          const authData: AuthData = {
            isLoggedIn: true,
            userId: data.user.id,
            userType: uType,
            role,
            phone: data.user.phone,
            email: data.user.email,
            username: data.user.username,
            isPhoneVerified: true,
            rememberMe,
            token: data.token,
            refreshToken: data.refreshToken,
            tenantId: data.user.tenantId,
            plan: data.user.plan || "free",
          };

          await storage.setAuth(authData);
          setIsLoggedIn(true);
          setIsGuest(false);
          setUserId(data.user.id);
          setUserType(uType);
          setEmail(data.user.phone || "");

          const userData: User = {
            id: data.user.id,
            uniqueId: data.user.uniqueId || "",
            name: data.user.name,
            phone: data.user.phone || "",
            email: data.user.email || "",
            username: data.user.username || "",
            isPhoneVerified: true,
            avatarColor: data.user.avatarColor || "#4ECDC4",
            profileImage: data.user.profileImage || undefined,
            address: data.user.address || "",
            role,
            workerCategory: data.user.workerCategory,
            dailyWage: data.user.dailyWage,
            contractorName: data.user.contractorName,
            contractorCompany: data.user.contractorCompany,
            connectionStatus: data.user.connectionStatus || "not_connected",
            isActive: true,
            createdAt: data.user.createdAt
              ? new Date(data.user.createdAt).getTime()
              : Date.now(),
            loginHistory: [Date.now()],
            companyName: data.user.companyName,
            plan: data.user.plan || "free",
          };

          await storage.updateUser(userData);
          setUser(userData);
          storage.syncWithBackend();

          return { success: true, isNewUser: false, user: userData };
        }

        return {
          success: false,
          message: data?.message || "Firebase phone login failed.",
        };
      } catch (err: any) {
        console.warn("[loginWithFirebasePhone Error]:", err);
        return {
          success: false,
          message: err.message || "Failed to complete phone login.",
        };
      }
    },
    [],
  );

  const loginAsGuest = useCallback(() => {
    setIsGuest(true);
    setIsLoggedIn(false);
    setUserId("guest");
    setUserType("guest");
    setEmail("guest");
  }, []);

  const logout = useCallback(async () => {
    await storage.clearAuth();
    await storage.clearBiometricCredentials();
    await AsyncStorage.removeItem("@haajari/admin_session");
    setIsLoggedIn(false);
    setIsGuest(false);
    setUserId("");
    setUserType("user");
    setUser(null);
    setNewDeviceAlert(null);

    // Immediate navigation reset ensures 1-click return to Login
    if (navigationRef.isReady()) {
      try {
        navigationRef.reset({
          index: 0,
          routes: [{ name: "Login" }],
        });
      } catch (e) {
        // Handled by RootNavigator conditional screen update
      }
    }
  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("unauthorized", () => {
      console.warn("[Auth hook] Received unauthorized event, logging out...");
      logout();
    });
    return () => sub.remove();
  }, [logout]);

  const refreshUserProfile = useCallback(async () => {
    try {
      const auth = await storage.getAuth();
      if (!auth?.token) return;
      const res = await authenticatedFetch(`${API_URL}/auth/profile`);
      if (res.ok) {
        const profileData = await res.json();
        const serverUser = profileData.user;
        if (serverUser) {
          const tenantObj =
            typeof serverUser.tenantId === "object"
              ? serverUser.tenantId
              : null;
          const updatedUser: User = {
            id: serverUser._id || serverUser.id || auth.userId,
            uniqueId: serverUser.uniqueId || "",
            name: serverUser.name || "",
            phone: serverUser.phone || "",
            email: serverUser.email || "",
            username: serverUser.username || "",
            isPhoneVerified: !!serverUser.isPhoneVerified,
            avatarColor: serverUser.avatarColor || "#4ECDC4",
            profileImage: serverUser.profileImage || undefined,
            address: serverUser.address || "",
            role: serverUser.role || auth.role || "contractor",
            workerCategory: serverUser.workerCategory,
            dailyWage: serverUser.dailyWage,
            contractorName: serverUser.contractorName,
            contractorCompany: serverUser.contractorCompany,
            connectionStatus: serverUser.connectionStatus || "not_connected",
            isActive: true,
            createdAt: serverUser.createdAt
              ? new Date(serverUser.createdAt).getTime()
              : Date.now(),
            loginHistory: [Date.now()],
            companyName: tenantObj?.name || serverUser.companyName || "",
            plan: tenantObj?.plan || serverUser.plan || auth.plan || "free",
          };
          await storage.updateUser(updatedUser);
          setUser((prev) => {
            if (
              prev &&
              prev.id === updatedUser.id &&
              prev.uniqueId === updatedUser.uniqueId &&
              prev.name === updatedUser.name &&
              prev.phone === updatedUser.phone &&
              prev.role === updatedUser.role &&
              prev.workerCategory === updatedUser.workerCategory &&
              prev.dailyWage === updatedUser.dailyWage &&
              prev.contractorName === updatedUser.contractorName &&
              prev.contractorCompany === updatedUser.contractorCompany &&
              prev.connectionStatus === updatedUser.connectionStatus &&
              prev.companyName === updatedUser.companyName &&
              prev.plan === updatedUser.plan
            ) {
              return prev;
            }
            return updatedUser;
          });
        }
      }
    } catch (e) {
      console.warn("Failed to refresh user profile:", e);
    }
  }, []);

  const currentRole = user?.role || "contractor";
  const isContractor =
    currentRole === "contractor" ||
    currentRole === "builder" ||
    userType === "admin";
  const isSupervisor = currentRole === "supervisor";
  const isWorker =
    currentRole === "labor" || (currentRole as string) === "worker";

  return {
    isLoggedIn,
    isGuest,
    isLoading,
    userId,
    uniqueId: user?.uniqueId || "",
    role: currentRole,
    isContractor,
    isSupervisor,
    isWorker,
    userType,
    email,
    user,
    newDeviceAlert,
    clearNewDeviceAlert,
    setNewDeviceAlert,
    refreshUserProfile,
    login,
    signup,
    loginAsGuest,
    logout,
    loginWithBiometrics,
    loginWithGoogle,
    loginWithFirebasePhone,
  };
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
