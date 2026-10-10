/**
 * Kahade — pemulihan sesi lembut / "soft re-auth" (P0-1, audit perf/UX
 * 2026-10-03).
 *
 * MASALAH: sesi kedaluwarsa di background (mis. pengguna sedang di
 * `/dispute/123`) dulu ditangani dengan `router.replace("/login")`. Karena
 * `Stack.Protected` mencabut SEMUA layar begitu token hilang, stack [A → B → C]
 * musnah — setelah login ulang, back dari C tidak mengembalikan ke B, dan
 * konteks tugas pengguna hilang.
 *
 * SOLUSI: tampilkan modal login DI ATAS stack yang ada (tanpa navigasi),
 * tahan guard supaya layar tidak dicabut, lalu tutup modal setelah login
 * berhasil — pengguna kembali ke layar semula. Bila pengguna menutup modal
 * atau gagal 3x, JATUH ke alur lama (redirect penuh ke /login dengan `next`).
 *
 * KEPUTUSAN NON-OBVIOUS
 *   - Latch diaktifkan SINKRON dari `onSessionCleared("expired")`, bukan dari
 *     listener UI: `clearSession()` menyiarkan snapshot token kosong dan React
 *     merender guard=false bila latch belum menyala — layar sudah ter-unmount
 *     sebelum kesempatan menampilkan modal. Karena itu modul ini berlangganan
 *     di level modul (dipanggil saat root layout dievaluasi).
 *   - Hanya alasan "expired" yang memicu. Logout eksplisit, ganti sandi/HP,
 *     2FA baru, dan jalan keluar darurat kunci aplikasi memakai alur lama —
 *     sesi itu memang sengaja diakhiri, bukan dipulihkan.
 *   - Setelah fallback, pemulihan lembut DI-SUPPRESS sampai ada sesi baru:
 *     kalau tidak, kegagalan refresh yang menyusul (atau emitSessionExpired
 *     kedua) akan memunculkan modal lagi — kali ini di atas layar /login.
 *   - Modul ini SENGAJA tidak memeriksa platform: latch-nya inert di web
 *     (guard web selalu true, gate-nya tidak dirender, dan jalur
 *     sesi-kedaluwarsa web punya Dialog "Sesi berakhir" sendiri / AUT-007).
 *     Menjaganya bebas-platform membuat kontraknya bisa diuji langsung, tanpa
 *     menyandera logika pada stub Platform di test.
 */
import { useSyncExternalStore } from "react"

import {
  getSessionSnapshot,
  onSessionCleared,
  subscribeSession,
  type SessionEndReason,
} from "@/lib/api/session"

/** Batas kegagalan sebelum jatuh ke alur lama. */
export const SOFT_REAUTH_MAX_ATTEMPTS = 3

/** Tujuan yang dibawa ke alur lama saat fallback (path + query, boleh null). */
type FallbackListener = (next: string | null) => void

let active = false
let attempts = 0
let fallbackTarget: string | null = null
let suppressed = false
let hadToken = getSessionSnapshot() !== null

const listeners = new Set<() => void>()
const fallbackListeners = new Set<FallbackListener>()

function notify(): void {
  for (const listener of listeners) listener()
}

/** Sesi baru terbit (login ulang berhasil) → pemulihan lembut selesai. */
subscribeSession(() => {
  const token = getSessionSnapshot()
  if (!token) return
  hadToken = true
  suppressed = false
  if (!active) return
  active = false
  attempts = 0
  notify()
})

/**
 * Titik masuk latch: dipanggil SINKRON oleh `clearSession()`.
 * Syaratnya ketat — hanya kedaluwarsa, hanya bila proses ini pernah punya
 * sesi, dan hanya bila pengguna belum memilih alur lama.
 */
onSessionCleared((reason: SessionEndReason) => {
  /*
   * Audit Auth 2026-10-10 (#FE-S10): logout EKSPLISIT menutup latch yang
   * sempat menyala. Skenario nyata: sesi sudah dicabut dari perangkat lain,
   * lalu pengguna menekan "Keluar" — `POST /auth/logout` dijawab 401, transport
   * memanggil `expireSession()` (alasan "expired" → latch aktif), baru
   * kemudian `logout()` membersihkan sesi dengan alasan "signout". Tanpa
   * penutupan ini, modal "Sesi Anda berakhir — masuk kembali" muncul DI ATAS
   * layar login yang baru dibuka pengguna yang justru ingin keluar.
   */
  if (reason === "signout") {
    if (!active) return
    active = false
    attempts = 0
    fallbackTarget = null
    notify()
    return
  }
  if (reason !== "expired") return
  if (!hadToken) return
  if (suppressed || active) return
  active = true
  attempts = 0
  notify()
})

export function isSoftReauthActive(): boolean {
  return active
}

export function subscribeSoftReauth(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const serverSnapshot = () => false

/** Apakah modal pemulihan lembut sedang tampil (native). */
export function useSoftReauthActive(): boolean {
  return useSyncExternalStore(subscribeSoftReauth, isSoftReauthActive, serverSnapshot)
}

/** Tujuan pasca-login alur lama (dibaca saat fallback dieksekusi). */
export function setSoftReauthTarget(next: string | null): void {
  fallbackTarget = next
}

export function getSoftReauthTarget(): string | null {
  return fallbackTarget
}

/**
 * Catat satu kegagalan login di dalam modal. Mengembalikan `true` bila
 * ambang tercapai DAN fallback sudah dipicu (pemanggil tidak perlu memanggil
 * `requestSoftReauthFallback` lagi).
 */
export function noteSoftReauthFailure(): boolean {
  attempts += 1
  if (attempts < SOFT_REAUTH_MAX_ATTEMPTS) return false
  requestSoftReauthFallback()
  return true
}

/** Banyak percobaan yang sudah gagal di episode ini (diagnostik & UI). */
export function softReauthAttempts(): number {
  return attempts
}

/** Tutup tanpa fallback (login berhasil / token kembali sendiri). */
export function closeSoftReauth(): void {
  if (!active) return
  active = false
  attempts = 0
  notify()
}

/**
 * Pengguna menutup modal atau gagal 3x → jalankan ALUR LAMA.
 *
 * `suppressed` dipasang SEBELUM listener dipanggil supaya kegagalan sesi
 * berikutnya (refresh yang menyusul) tidak membuka modal baru di atas layar
 * login.
 */
export function requestSoftReauthFallback(): void {
  const next = fallbackTarget
  const wasActive = active
  active = false
  attempts = 0
  fallbackTarget = null
  suppressed = true
  if (wasActive) notify()
  for (const listener of fallbackListeners) listener(next)
}

/** Dipanggil root layout: jalankan `redirectToLoginWithNext(next)`. */
export function subscribeSoftReauthFallback(listener: FallbackListener): () => void {
  fallbackListeners.add(listener)
  return () => {
    fallbackListeners.delete(listener)
  }
}

/**
 * Keputusan alur sesi-kedaluwarsa di native (murni, mudah diuji).
 *
 *   - "ignore" — tidak ada sesi di proses ini dan layar pun tidak dijaga
 *     (pengguna memang belum pernah login; jangan diganggu).
 *   - "soft"   — latch kedaluwarsa aktif → modal di atas stack.
 *   - "legacy" — sisanya (termasuk logout eksplisit yang juga meng-emit
 *     session-expired) → perilaku lama: replace ke /login dengan `next`.
 */
export function decideNativeSessionExpiredAction(input: {
  hadSession: boolean
  guardedPath: boolean
  softActive: boolean
}): "ignore" | "soft" | "legacy" {
  if (!input.hadSession && !input.guardedPath) return "ignore"
  return input.softActive ? "soft" : "legacy"
}

/** Reset untuk test & isolasi antar-skenario. */
export function resetSoftReauth(): void {
  active = false
  attempts = 0
  fallbackTarget = null
  suppressed = false
  hadToken = getSessionSnapshot() !== null
  listeners.clear()
  fallbackListeners.clear()
}
