import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";
import { storage, AuthData, User, generateId, API_URL } from "@/utils/storage";
import { registerExpoPushToken } from "@/utils/notifications";

interface AuthContextType {
  isLoggedIn: boolean;
  isGuest: boolean;
  isLoading: boolean;
  userId: string;
  userType: "admin" | "user" | "guest";
  email: string; // Used as the identifier (phone/email/username)
  user: User | null;
  login: (
    phone: string,
    password?: string,
    otp?: string,
    rememberMe?: boolean,
  ) => Promise<any>;
  signup: (
    name: string,
    phone: string,
    password?: string,
    role?: "contractor" | "builder",
    companyName?: string,
    email?: string,
    username?: string,
  ) => Promise<{ success: boolean; field?: string; message?: string }>;
  loginAsGuest: () => void;
  logout: () => Promise<void>;
  loginWithBiometrics: (
    phone: string,
    token: string,
    rememberMe?: boolean,
  ) => Promise<boolean>;
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
        if (auth.userType === "user" || auth.role) {
          const userData = await storage.getUserById(auth.userId);
          setUser(userData);
        }
        // Run sync on launch if logged in
        if (auth.token) {
          storage.syncWithBackend();
          registerExpoPushToken().then(async (pushToken) => {
            if (pushToken) {
              await fetch(`${API_URL}/auth/push-token`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${auth.token}`,
                },
                body: JSON.stringify({ pushToken }),
              }).catch(() => {});
            }
          });
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
        const res = await fetch(`${API_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phoneTrimmed, password, otp }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.requiresOtp) {
            return { requiresOtp: true, phone: data.phone };
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
            name: data.user.name,
            phone: data.user.phone || "",
            email: data.user.email || "",
            avatarColor: data.user.avatarColor || "#4ECDC4",
            profileImage: data.user.profileImage || undefined,
            address: data.user.address || "",
            role: role,
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

          registerExpoPushToken().then(async (pushToken) => {
            if (pushToken) {
              await fetch(`${API_URL}/auth/push-token`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${data.token}`,
                },
                body: JSON.stringify({ pushToken }),
              }).catch(() => {});
            }
          });

          return true;
        }
      } catch (e) {
        console.warn("Backend login failed, attempting local fallback", e);
      }

      // 2. Local Fallback for offline support (using their real stored password)
      const users = await storage.getUsers();
      const userData = users.find(
        (u) =>
          u.phone === phoneTrimmed ||
          u.email?.toLowerCase() === phoneTrimmed.toLowerCase() ||
          u.username?.toLowerCase() === phoneTrimmed.toLowerCase()
      );

      if (userData && userData.isActive) {
        let isMatched = false;
        if (password) {
          isMatched = userData.password === password;
        }

        if (isMatched) {
          await storage.recordUserLogin(userData.id);
          const uType = userData.role === "admin" ? ("admin" as const) : ("user" as const);
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
          setEmail(userData.phone);
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
      phone: string,
      password?: string,
      role?: "contractor" | "builder",
      companyName?: string,
      email?: string,
      username?: string,
    ): Promise<{ success: boolean; field?: string; message?: string }> => {
      const phoneTrimmed = phone.trim();

      // 1. Try server signup
      try {
        const res = await fetch(`${API_URL}/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            phone: phoneTrimmed,
            password,
            role,
            companyName,
            email: email ? email.toLowerCase().trim() : undefined,
            username: username ? username.toLowerCase().trim() : undefined,
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
          setEmail(data.user.phone || "");

          const userData: User = {
            id: data.user.id,
            name: data.user.name,
            phone: data.user.phone || "",
            email: data.user.email || "",
            avatarColor: data.user.avatarColor || "#FF6B6B",
            profileImage: data.user.profileImage || undefined,
            address: data.user.address || "",
            role: data.user.role,
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

          registerExpoPushToken().then(async (pushToken) => {
            if (pushToken) {
              await fetch(`${API_URL}/auth/push-token`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${data.token}`,
                },
                body: JSON.stringify({ pushToken }),
              }).catch(() => {});
            }
          });

          return { success: true };
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
            name: data.user.name,
            phone: data.user.phone || "",
            email: data.user.email || "",
            avatarColor: data.user.avatarColor || "#4ECDC4",
            profileImage: data.user.profileImage || undefined,
            address: data.user.address || "",
            role: role,
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

  const loginAsGuest = useCallback(() => {
    setIsGuest(true);
    setIsLoggedIn(false);
    setUserId("guest");
    setUserType("guest");
    setEmail("guest");
  }, []);

  const logout = useCallback(async () => {
    await storage.clearAll();
    await AsyncStorage.removeItem("@haajari/admin_session");
    setIsLoggedIn(false);
    setIsGuest(false);
    setUserId("");
    setUserType("user");
    setUser(null);
  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("unauthorized", () => {
      console.warn("[Auth hook] Received unauthorized event, logging out...");
      logout();
    });
    return () => sub.remove();
  }, [logout]);

  return {
    isLoggedIn,
    isGuest,
    isLoading,
    userId,
    userType,
    email,
    user,
    login,
    signup,
    loginAsGuest,
    logout,
    loginWithBiometrics,
  };
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
