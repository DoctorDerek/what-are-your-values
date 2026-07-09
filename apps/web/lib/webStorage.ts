import { StorageAdapter } from "@what-are-your-values-mapache/machines/src/StorageAdapter"

export const webStorage: StorageAdapter = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
}
