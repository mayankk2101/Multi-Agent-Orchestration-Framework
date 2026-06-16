import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { api, setAccessToken, setRefreshToken, setOnTokenRefreshed, setOnAuthFailure, getAccessToken, getRefreshToken } from '@/lib/api';
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
        setRefreshToken(refreshToken);
        try {
          const user = await api.auth.me();
          // Read tokens from the module mirror after me() returns: a transparent startup
          // refresh inside request() updates _accessToken/_refreshToken before returning,
          // so these values are always current regardless of whether a refresh occurred.
          set({ user, accessToken: getAccessToken(), refreshToken: getRefreshToken(), isInitialized: true });
          return;
        } catch {
          setAccessToken(null);
          setRefreshToken(null);
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
      setRefreshToken(response.refresh_token);
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
    setRefreshToken(null);
    await SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN);
    set({ user: null, accessToken: null, refreshToken: null });
  },
}));

// Register API callbacks once at module load time.
// These persist for the lifetime of the app process.

setOnTokenRefreshed(async (access: string, refresh: string) => {
  await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, access);
  await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refresh);
  useAuthStore.setState({ accessToken: access, refreshToken: refresh });
});

setOnAuthFailure(async () => {
  setAccessToken(null);
  setRefreshToken(null);
  await SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN);
  await SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN);
  useAuthStore.setState({ user: null, accessToken: null, refreshToken: null });
  router.replace('/(auth)/login');
});
