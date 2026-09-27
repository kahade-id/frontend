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
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/** Buka sheet "Buat baru" dari mana saja. */
export function openCreateSheet() {
  if (open) return
  open = true
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

/** Langganan status buka/tutup sheet. */
export function useCreateSheetOpen() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
