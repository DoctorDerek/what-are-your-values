import * as DocumentPicker from "expo-document-picker"
import { File, Paths } from "expo-file-system"
import * as Sharing from "expo-sharing"
import { createNativePlayerDataFileAdapter } from "./NativePlayerDataFiles"

const JSON_MIME_TYPE = "application/json"

async function selectJsonFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: JSON_MIME_TYPE,
    copyToCacheDirectory: true,
    multiple: false,
  })
  if (result.canceled) {
    return null
  }
  if (result.assets.length !== 1) {
    throw new Error("The native file picker returned an invalid selection")
  }

  return new File(result.assets[0].uri)
}

export const expoPlayerDataFileAdapter = createNativePlayerDataFileAdapter({
  selectJsonFile,
  createTemporaryFile: (filename) => new File(Paths.cache, filename),
  isSharingAvailable: Sharing.isAvailableAsync,
  shareFile: (uri) =>
    Sharing.shareAsync(uri, {
      mimeType: JSON_MIME_TYPE,
      UTI: "public.json",
      dialogTitle: "Save or share your private WAYVM backup",
    }),
})
