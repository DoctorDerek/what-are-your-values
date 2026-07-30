import AsyncStorage from "@react-native-async-storage/async-storage"
import { createAsyncStorageDurableStore } from "./AsyncStorageDurableStore"

export const expoDurableStore = createAsyncStorageDurableStore(AsyncStorage)
