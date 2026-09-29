/**
 * Kahade — state global sheet "Buat baru".
 *
 * Satu pintu pembuatan untuk seluruh app (Buat Karya → /showcase/create,
 * Buat transaksi, Isi saldo dompet). Dibuka dari tombol (+) di header
 * Etalase maupun pensil di utility bar drawer — pola module store yang sama
 * dengan `lib/drawer.ts` (useSyncExternalStore, tanpa dependency).
 *
 * Komponen <CreateSheet> di-mount sekali di root layout dan membaca store
 * ini; pemanggil cukup memanggil `openCreateSheet()`.
 */
import { useSyncExternalStore } from "react"

let open = false
/**
 * U5-004 (journey): sheet pernah dibuka minimal sekali dalam sesi ini —
 * gerbang coach mark "+" (hanya untuk user yang membuka sheet buat, bukan
 * semua pengunjung feed pertama). Tidak persisten: coach mark-nya sendiri
 * yang sekali-tampil via flag SecureStore.
 */
let everOpened = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/** Buka sheet "Buat baru" dari mana saja. */
export function openCreateSheet() {
  if (open) return
  open = true
  everOpened = true
  emit()
}

/** Tutup sheet "Buat baru". */
export function closeCreateSheet() {
  if (!open) return
  open = false
  emit()
}

/** Untuk test/assert tanpa render. */
export function isCreateSheetOpen() {
  return open
}

/** Reset khusus test. */
export function resetCreateSheetForTest() {
  open = false
  everOpened = false
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

function getEverOpenedSnapshot() {
  return everOpened
}

/** Langganan status buka/tutup sheet. */
export function useCreateSheetOpen() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/**
 * U5-004 (journey): true bila sheet "Buat baru" pernah dibuka sesi ini —
 * dipakai menggerbangkan coach mark "+" di header Etalase.
 */
export function useCreateSheetEverOpened() {
  return useSyncExternalStore(subscribe, getEverOpenedSnapshot, getEverOpenedSnapshot)
}
