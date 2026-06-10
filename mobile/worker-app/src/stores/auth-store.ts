import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api, setAccessToken } from '@/lib/api';
import type { User } from '@/types/api';

const KEYS = {
  ACCESS_TOKEN: 'hotel_crm_access_token',
  REFRESH_TOKEN: 'hotel_crm_refresh_token',
} as const;

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    try {
      const accessToken = await SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
      const refreshToken = await SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);

      if (accessToken) {
        setAccessToken(accessToken);
        try {
          const user = await api.auth.me();
          set({ user, accessToken, refreshToken, isInitialized: true });
          return;
        } catch {
          setAccessToken(null);
          await SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN);
          await SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN);
        }
      }
    } catch {
      // ignore storage errors on first run
    }
    set({ isInitialized: true });
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const response = await api.auth.login(email, password);
      setAccessToken(response.access_token);
      await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, response.access_token);
      await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, response.refresh_token);
      set({
        user: response.user,
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore – clear local state regardless
    }
    setAccessToken(null);
    await SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN);
    set({ user: null, accessToken: null, refreshToken: null });
  },
}));
