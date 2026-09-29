/**
 * Kahade — kill-switch dompet internal (Mode Tanpa Wallet Internal, BI-safe).
 *
 * Kahade BELUM berizin BI sebagai penerbit uang elektronik: selama flag ini
 * `false`, aplikasi TIDAK menampilkan/mengoperasikan dompet internal (saldo,
 * top-up, tarik ke dompet, transfer saldo, terima saldo, riwayat dompet).
 * Uang hanya numpang lewat: buyer → DANA → escrow → rekening bank seller.
 *
 * Sumber kebenaran (urutan menang):
 *   1. Server — `GET /v1/public/wallet-status` → `{ walletEnabled: boolean }`
 *      (kill-switch WALLET_ENABLED backend, default false). Nilai server
 *      menang segera setelah fetch pertama berhasil.
 *   2. Build default — `EXPO_PUBLIC_WALLET_ENABLED` ("true" = nyala), default
 *      "false" (fail closed: ragu = dompet mati).
 *
 * ATURAN: semua akses dompet di-FE digate lewat modul ini (atau hook di
 * `lib/use-wallet-enabled.ts`) — JANGAN baca EXPO_PUBLIC_WALLET_ENABLED
 * langsung di layar/komponen. Kode dompet TETAP ADA, hanya digate.
 */
import { http } from "@/lib/api/client"
import { asRecord } from "@/lib/api/response"

/** Endpoint publik status kill-switch (dibangun tim backend; 404 = belum ada). */
export const WALLET_STATUS_PATH = "/v1/public/wallet-status"

/**
 * Build-time default dari env. "true" (case-insensitive) = nyala; nilai lain
 * / tidak di-set = MATI. Fail closed: default tanpa env adalah false.
 */
export function walletEnabledBuildDefault(): boolean {
  const raw =
    typeof process !== "undefined" ? process.env?.EXPO_PUBLIC_WALLET_ENABLED : undefined
  return String(raw ?? "").trim().toLowerCase() === "true"
}

/**
 * Normalizer toleran untuk respons `GET /v1/public/wallet-status`.
 * Mengembalikan `null` bila bentuknya tidak dikenali — pemanggil memakai
 * build default (fail closed), bukan menebak.
 */
export function normalizeWalletStatus(raw: unknown): boolean | null {
  const record = asRecord(raw)
  if (!record) return null
  const nested = asRecord(record.data) ?? asRecord(record.result) ?? record
  const value =
    nested.walletEnabled ?? nested.wallet_enabled ?? nested.enabled ?? record.walletEnabled
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (normalized === "true") return true
    if (normalized === "false") return false
  }
  return null
}

// ── Cache status server (satu fetch per sesi aplikasi) ────────────────────

let serverStatus: boolean | null = null
let serverStatusPromise: Promise<boolean | null> | null = null
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((listener) => {
    try {
      listener()
    } catch {
      // Satu listener rusak tidak boleh merusak yang lain.
    }
  })
}

/** Nilai efektif saat ini: server menang bila sudah diketahui, else build default. */
export function getWalletEnabled(): boolean {
  return serverStatus ?? walletEnabledBuildDefault()
}

/** Nilai server terakhir yang berhasil di-fetch (`null` = belum diketahui). */
export function getWalletServerStatus(): boolean | null {
  return serverStatus
}

/** Langganan perubahan nilai efektif (untuk `useSyncExternalStore`-style hook). */
export function subscribeWalletFlag(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Ambil status kill-switch dari server (sekali per sesi; hasilnya di-cache).
 * Endpoint belum ada / gagal / bentuk tak dikenal → `null` dan nilai efektif
 * tetap build default (fail closed). TIDAK PERNAH melempar.
 */
export function refreshWalletStatus(signal?: AbortSignal): Promise<boolean | null> {
  if (!serverStatusPromise) {
    serverStatusPromise = http
      .get<unknown>(WALLET_STATUS_PATH, { auth: "none", retry: 0, signal })
      .then(normalizeWalletStatus)
      .then((status) => {
        if (status != null && status !== serverStatus) {
          serverStatus = status
          emit()
        }
        // PERF-FIX (state audit): hasil null (gagal/tak dikenal) JANGAN
        // di-cache selamanya — satu kegagalan jaringan dulu mengunci kill-switch
        // dalam keputusan basi selama proses hidup. Reset agar percobaan
        // berikutnya boleh jalan.
        if (status == null) serverStatusPromise = null
        return status
      })
      .catch(() => {
        serverStatusPromise = null
        return null
      })
  }
  return serverStatusPromise
}

/**
 * Reset khusus test: kembalikan cache server ke "belum diketahui".
 * JANGAN dipakai di kode produksi.
 */
export function __resetWalletFlagForTests(): void {
  serverStatus = null
  serverStatusPromise = null
  listeners.clear()
}

/** Set status server secara manual (khusus test). JANGAN dipakai di produksi. */
export function __setWalletServerStatusForTests(status: boolean | null): void {
  serverStatus = status
  serverStatusPromise = status == null ? null : Promise.resolve(status)
  emit()
}
