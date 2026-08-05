import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: "admin" | "supervisor" | "contractor" | "staff" | "root";
  companyName?: string;
  plan?: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  token: string | null;
  user: UserProfile | null;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<UserProfile>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem("haajari_web_token"));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem("haajari_web_token");
      const storedUser = localStorage.getItem("haajari_web_user");
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = async (phone: string, password: string): Promise<UserProfile> => {
    setIsLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { phone, password });
      const data = response.data;
      
      const userProfile: UserProfile = {
        id: data.user.id,
        name: data.user.name,
        phone: data.user.phone,
        email: data.user.email || "",
        role: data.user.role,
        companyName: data.user.companyName,
        plan: data.user.plan,
      };

      localStorage.setItem("haajari_web_token", data.token);
      localStorage.setItem("haajari_web_user", JSON.stringify(userProfile));
      setToken(data.token);
      setUser(userProfile);
      return userProfile;
    } catch (error: any) {
      const message = error.response?.data?.error || "Login failed";
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("haajari_web_token");
    localStorage.removeItem("haajari_web_user");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn: !!token,
        token,
        user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
