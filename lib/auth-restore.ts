/**
 * Kahade — pemulihan sesi optimistis (ST-002, PERF-FIX 2026-09-29).
 *
 * Masalah: `useAuthSession` lama memblokir render pertama di belakang SATU
 * round-trip jaringan (`await refreshAccessToken()`) setiap kali access
 * token tidak ada di SecureStore — di sinyal jelek, pengguna menatap spinner
 * >5 detik sebelum aplikasi terlihat.
 *
 * Desain baru (dua fase):
 *   Fase 1 — LOKAL SAJA (milidetik, tanpa jaringan): baca flag
 *   `sessionSignedOut` + access token dari SecureStore.
 *     - Flag signed-out → `clearSession()`, langsung ke state logout.
 *     - Access token ada → sesi dianggap pulih; TIDAK ADA panggilan jaringan
 *       yang menahan render.
 *     - Tidak ada access token → render tetap dilanjut (optimistis); refresh
 *       token berjalan di BACKGROUND (fase 2).
 *   Fase 2 — VERIFIKASI BACKGROUND: `refreshAccessToken()`.
 *     - Sukses → token baru tersimpan (di dalam `refreshAccessToken`),
 *       snapshot sesi terbit, guard rute lolos. Tidak ada aksi tambahan.
 *     - `null` (401/403: refresh token invalid / revoked / tidak ada) →
 *       FAIL-CLOSED: `clearSession()` + `emitSessionExpired()` (root layout
 *       mengarahkan ke /login di native). Konten terautentikasi TIDAK PERNAH
 *       ditampilkan dengan sesi invalid — selama verifikasi berjalan, guard
 *       `Stack.Protected` tetap false karena token masih null.
 *     - Throw (jaringan / 5xx / 429) → FAIL-OPEN: sesi TIDAK dibersihkan.
 *       Kegagalan jaringan bukan bukti sesi invalid; pengguna tetap di layar
 *       login/guest dan bisa mencoba lagi. Hanya dicatat ke telemetri.
 *
 * Keamanan (aturan keras):
 *   - Pembedaan "tidak ada cached session" vs "ada cached, sedang refresh"
 *     terjadi di fase 1 TANPA jaringan; verifikasi selalu lewat server.
 *   - Guard revisi sesi: bila revisi berubah di tengah verifikasi (mis.
 *     pengguna login akun lain saat background refresh terbang),
 *     `refreshAccessToken()` melempar `aborted`, dan hasil `null` yang
 *     datang TERLAMBAT tidak boleh membersihkan sesi BARU — `clearSession()`
 *     + `emitSessionExpired()` hanya jalan bila revisi masih sama.
 */
import { refreshAccessToken } from "@/lib/api/client"
import {
  clearSession,
  emitSessionExpired,
  getAccessToken,
  getSessionRevision,
} from "@/lib/api/session"
import { getSecureItem, SecureKeys } from "@/lib/secure-storage"
import { logWarn } from "@/lib/telemetry"

/** Hasil perencanaan fase 1 (bacaan lokal saja, tanpa jaringan). */
export type SessionRestorePlan =
  /** Flag signed-out: tidak ada sesi untuk diverifikasi → langsung logout. */
  | { kind: "signed-out" }
  /** Access token tersimpan: render langsung, tanpa verifikasi jaringan. */
  | { kind: "cached" }
  /** Tanpa access token: render optimistis + verifikasi di background. */
  | { kind: "verify" }

/**
 * Fase 1: tentukan rencana pemulihan dari penyimpanan lokal SAJA.
 * Tidak pernah menyentuh jaringan — aman dipanggil sebelum render pertama.
 */
export async function planSessionRestore(): Promise<SessionRestorePlan> {
  if ((await getSecureItem(SecureKeys.sessionSignedOut)) === "1") {
    await clearSession()
    return { kind: "signed-out" }
  }
  const access = await getAccessToken()
  if (access) return { kind: "cached" }
  return { kind: "verify" }
}

/** Hasil verifikasi background (fase 2). */
export type SessionVerifyOutcome =
  /** Refresh sukses — token baru sudah tersimpan & snapshot terbit. */
  | { ok: true; token: string }
  /** Refresh 401/403 — sesi dibersihkan + expiry di-emit (fail-closed). */
  | { ok: false; reason: "invalid" }
  /** Gagal jaringan/server — sesi TIDAK disentuh (fail-open). */
  | { ok: false; reason: "network"; error: unknown }
  /** Revisi sesi berubah di tengah jalan — abaikan hasil basi. */
  | { ok: false; reason: "superseded" }

/**
 * Fase 2: verifikasi sesi di background.
 *
 * `refreshAccessToken()` mengembalikan `null` untuk 401/403 (refresh token
 * invalid/revoked/tidak ada) dan MELEMPAR untuk kegagalan jaringan/5xx/429
 * (lihat `lib/api/client.ts`) — pemetaan inilah yang membuat klasifikasi
 * fail-closed vs fail-open di sini tepat.
 */
export async function verifySessionInBackground(): Promise<SessionVerifyOutcome> {
  const revision = getSessionRevision()
  try {
    const token = await refreshAccessToken()
    if (getSessionRevision() !== revision) return { ok: false, reason: "superseded" }
    if (token == null) {
      // 401/403: bukti server bahwa sesi ini tidak valid → bersihkan total
      // dan paksa alur login. Guard revisi di atas menjamin kita tidak
      // menghapus sesi BARU yang dibuat saat refresh terbang.
      await clearSession()
      if (getSessionRevision() === revision + 1) emitSessionExpired()
      return { ok: false, reason: "invalid" }
    }
    return { ok: true, token }
  } catch (error) {
    // Jaringan / 5xx / 429 / aborted: BUKAN bukti sesi invalid — jangan
    // logout. Pengguna yang tadinya login tetap bisa memakai token lama
    // sampai kedaluwarsa; yang belum login tetap di layar login.
    logWarn("auth:restore-verify", error)
    return { ok: false, reason: "network", error }
  }
}
