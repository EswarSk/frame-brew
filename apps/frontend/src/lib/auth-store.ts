import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from './api';
import { User } from './types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: { email: string; password: string; name: string; orgName: string }) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (credentials) => {
        set({ isLoading: true });
        try {
          const response = await api.login(credentials);
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (data) => {
        set({ isLoading: true });
        try {
          const response = await api.register(data);
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        api.logout();
        set({
          user: null,
          isAuthenticated: false,
        });
      },

      checkAuth: async () => {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          set({ isAuthenticated: false, user: null });
          return false;
        }

        try {
          // Try to make an authenticated request to verify token
          set({ isLoading: true });
          
          // For now, just check if token exists - in a real app you'd verify with the backend
          if (token) {
            set({ isAuthenticated: true, isLoading: false });
            return true;
          } else {
            set({ isAuthenticated: false, user: null, isLoading: false });
            return false;
          }
        } catch (error) {
          // Token is invalid
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          set({ isAuthenticated: false, user: null, isLoading: false });
          return false;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);