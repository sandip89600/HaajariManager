import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthStore {
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;
  login: (token: string, username: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      token: null,
      username: null,
      login: (token, username) => set({ isAuthenticated: true, token, username }),
      logout: () => set({ isAuthenticated: false, token: null, username: null }),
    }),
    { name: 'haajari-admin-auth' }
  )
);
