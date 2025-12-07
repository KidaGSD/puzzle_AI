import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  // Mock mode toggle
  isMockMode: boolean;
  setMockMode: (enabled: boolean) => void;
  toggleMockMode: () => void;

  // Other settings can be added here
}

/**
 * Settings store for application preferences
 * Persisted to localStorage
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      isMockMode: true, // Default to mock mode for development

      setMockMode: (enabled: boolean) => set({ isMockMode: enabled }),

      toggleMockMode: () => set((state) => ({ isMockMode: !state.isMockMode })),
    }),
    {
      name: 'puzzle-settings',
    }
  )
);
