/**
 * Kahade — state global drawer/sidebar navigasi.
 *
 * Drawer dibuka dari ikon hamburger di header Etalase dan menampung menu
 * sekunder yang tidak lagi punya slot di bottom navbar (profil, dompet,
 * voucher, pengaturan, dsb). Modul ini hanya menyimpan status buka/tutup +
 * progress animasi — pola module store yang sama dengan `ui-prefs`/`app-mode`.
 *
 * `drawerProgress` adalah SharedValue reanimated 0→1 yang dibaca dua arah:
 * drawer (panel + backdrop) dan root layout (efek dorong/skala konten ala X).
 */
import { useSyncExternalStore } from "react"
import { makeMutable, type SharedValue } from "react-native-reanimated"

let open = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function openDrawer() {
  if (open) return
  open = true
  emit()
}

export function closeDrawer() {
  if (!open) return
  open = false
  emit()
}

export function toggleDrawer() {
  if (open) closeDrawer()
  else openDrawer()
}

/** Untuk test/assert tanpa render. */
export function isDrawerOpen() {
  return open
}

/** Reset khusus test. */
export function resetDrawerForTest() {
  open = false
  drawerProgress.value = 0
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return open
}

/** Langganan status buka/tutup drawer. */
export function useDrawerOpen() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/**
 * Progress animasi drawer 0 (tutup) → 1 (buka penuh). Ditulis oleh komponen
 * drawer (spring saat buka/tutup, nilai mentah saat drag) dan dibaca oleh
 * root layout untuk efek dorong konten.
 */
export const drawerProgress: SharedValue<number> = makeMutable(0)
