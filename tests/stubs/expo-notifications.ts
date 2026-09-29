/**
 * Stub `expo-notifications` untuk Vitest (config komponen).
 *
 * Dibutuhkan sejak Tim UX-Journey (U5) mengimpor `PushRationaleSheet`
 * di `showcase-feed-tab`, yang menarik `@/lib/push-notifications`
 * -> `expo-notifications` (modul native, tidak bisa di-parse jsdom).
 * Test komponen mengunci teks & perilaku, bukan pengiriman push asli.
 */
export const AndroidImportance = {
  MIN: 1,
  LOW: 2,
  DEFAULT: 3,
  HIGH: 4,
  MAX: 5,
} as const

export const AndroidNotificationVisibility = {
  SECRET: -1,
  PRIVATE: 0,
  PUBLIC: 1,
} as const

export const DEFAULT_ACTION_IDENTIFIER = "expo.modules.notifications.actions.DEFAULT"

export async function getPermissionsAsync() {
  return { status: "granted", granted: true, canAskAgain: true, expires: "never" }
}

export async function requestPermissionsAsync() {
  return { status: "granted", granted: true, canAskAgain: true, expires: "never" }
}

export async function getExpoPushTokenAsync() {
  return { type: "expo", data: "ExponentPushToken[test-stub]" }
}

export async function getLastNotificationResponseAsync() {
  return null
}

export function addNotificationReceivedListener() {
  return { remove: () => {} }
}

export function addNotificationResponseReceivedListener() {
  return { remove: () => {} }
}

export async function setNotificationChannelAsync() {
  return null
}

export async function setNotificationCategoryAsync() {
  return null
}

export function setNotificationHandler() {}

export default {
  AndroidImportance,
  AndroidNotificationVisibility,
  DEFAULT_ACTION_IDENTIFIER,
  getPermissionsAsync,
  requestPermissionsAsync,
  getExpoPushTokenAsync,
  getLastNotificationResponseAsync,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  setNotificationChannelAsync,
  setNotificationCategoryAsync,
  setNotificationHandler,
}
