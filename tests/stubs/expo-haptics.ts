/**
 * Stub `expo-haptics` untuk Vitest — getaran adalah efek perangkat, bukan
 * perilaku yang diuji. Semua async no-op; enum dipertahankan karena
 * lib/haptics.ts membaca konstantanya.
 */
export const ImpactFeedbackStyle = {
  Light: "Light",
  Medium: "Medium",
  Heavy: "Heavy",
  Rigid: "Rigid",
  Soft: "Soft",
} as const
export const NotificationFeedbackType = {
  Success: "Success",
  Warning: "Warning",
  Error: "Error",
} as const
export async function impactAsync(): Promise<void> {}
export async function notificationAsync(): Promise<void> {}
export async function selectionAsync(): Promise<void> {}
export default {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  impactAsync,
  notificationAsync,
  selectionAsync,
}
