import { ProjectStore } from "../../domain/models";
import { StorageAdapter } from "../contextStore";

const STORAGE_KEY = "puzzleAI:projectStore";

export const createLocalStorageAdapter = (): StorageAdapter => {
  const load = async (): Promise<ProjectStore | null> => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as ProjectStore;
    } catch (err) {
      console.error("[localStorageAdapter] load failed", err);
      return null;
    }
  };

  const save = async (store: ProjectStore): Promise<void> => {
    try {
      const raw = JSON.stringify(store);
      window.localStorage.setItem(STORAGE_KEY, raw);
    } catch (err) {
      console.error("[localStorageAdapter] save failed", err);
    }
  };

  return { load, save };
};
