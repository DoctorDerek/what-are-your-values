import { StorageAdapter } from "@game/machines/src/StorageAdapter"

export const webStorage: StorageAdapter = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
}
