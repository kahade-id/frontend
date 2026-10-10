/**
 * CR-02 (audit etalase 2026-10-10): klasifikasi kegagalan POST /me/showcase.
 *
 * Dulu layar buat menganggap SEMUA error selain ApiError 4xx tertentu sebagai
 * "status simpan belum pasti" → seluruh form terkunci. `OfflineError` bukan
 * ApiError: request-nya TIDAK PERNAH dikirim (lib/api/client.ts menolak
 * mutasi saat NetInfo pasti offline), jadi tidak ada yang perlu "dilanjutkan"
 * — pengguna cukup mencoba lagi setelah tersambung.
 *
 *  - "not-sent"  : tidak ada byte yang sampai ke server (offline terverifikasi).
 *  - "rejected"  : server menjawab tegas bahwa permintaan ditolak/tak diproses.
 *  - "uncertain" : timeout / koneksi putus di tengah / 5xx / 409 — karya bisa
 *                  saja sudah tersimpan; kunci idempotency dipakai ulang.
 */
import { isApiError, isOfflineError } from "@/lib/api/errors"

export type CreateFailureOutcome = "not-sent" | "rejected" | "uncertain"

/**
 * Status yang berarti server MENOLAK sebelum menyimpan apa pun:
 * 400/422 validasi, 401 sesi habis, 403 dilarang, 404 rute/akun, 413 terlalu
 * besar, 429 dibatasi (ditolak sebelum diproses).
 */
const DEFINITE_REJECTION_STATUSES = new Set([400, 401, 403, 404, 413, 422, 429])

export function classifyCreateFailure(error: unknown): CreateFailureOutcome {
  if (isOfflineError(error)) return "not-sent"
  if (isApiError(error)) {
    if (error.status != null && DEFINITE_REJECTION_STATUSES.has(error.status)) return "rejected"
    // ApiError tanpa status = dibuat di klien sebelum request (mis. validasi
    // payload) — tidak pernah terkirim.
    if (error.status == null && (error.code === "BAD_REQUEST" || error.code === "VALIDATION")) return "not-sent"
  }
  return "uncertain"
}
