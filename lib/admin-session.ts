/**
 * Kahade — helper sesi panel admin.
 *
 * `handleAdminApiError(e)`: dipakai setiap layar admin di blok catch.
 * Bila error adalah `AdminAuthError` (token kedaluwarsa & refresh gagal) →
 * arahkan ke `/admin/login` dan kembalikan `true` (pemanggil tidak perlu
 * menampilkan pesan error). Selain itu kembalikan `false`.
 */
import { router } from "expo-router"

import { AdminAuthError } from "@/lib/api/admin-client"

export function isAdminAuthError(e: unknown): boolean {
  return e instanceof AdminAuthError
}

/** @returns true bila error sudah ditangani (redirect login). */
export function handleAdminApiError(e: unknown): boolean {
  if (isAdminAuthError(e)) {
    router.replace("/admin/login")
    return true
  }
  return false
}
