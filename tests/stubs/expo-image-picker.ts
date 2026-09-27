/**
 * Stub `expo-image-picker` untuk Vitest (config komponen).
 *
 * Modul asli menarik `expo-modules-core` (EventEmitter) yang butuh global
 * native Expo — tidak ada di jsdom. Ditarik secara transitif oleh komponen
 * yang mengimpor `@/lib/api` (rantai: api → api/upload → lib/image-picker).
 * Test komponen tidak pernah memetik gambar sungguhan; stub ini hanya
 * memenuhi impor level-modul dengan fungsi no-op.
 */
export const MediaTypeOptions = {
  All: "All",
  Images: "Images",
  Videos: "Videos",
} as const

export const PermissionStatus = {
  UNDETERMINED: "undetermined",
  DENIED: "denied",
  GRANTED: "granted",
} as const

export type ImagePickerAsset = {
  uri: string
  fileName?: string | null
  mimeType?: string | null
  fileSize?: number | null
  width?: number
  height?: number
}

export type ImagePickerOptions = Record<string, unknown>

type PermissionResponse = { status: string; granted: boolean }

export async function requestMediaLibraryPermissionsAsync(): Promise<PermissionResponse> {
  return { status: PermissionStatus.DENIED, granted: false }
}

export async function requestCameraPermissionsAsync(): Promise<PermissionResponse> {
  return { status: PermissionStatus.DENIED, granted: false }
}

export async function launchImageLibraryAsync(): Promise<{ canceled: true; assets: null }> {
  return { canceled: true, assets: null }
}

export async function launchCameraAsync(): Promise<{ canceled: true; assets: null }> {
  return { canceled: true, assets: null }
}

export default {
  MediaTypeOptions,
  PermissionStatus,
  requestMediaLibraryPermissionsAsync,
  requestCameraPermissionsAsync,
  launchImageLibraryAsync,
  launchCameraAsync,
}
