/**
 * Kahade — tujuan setelah login (guest mode web).
 *
 * Saat pengunjung web menyentuh layar yang butuh akun, ia diarahkan ke
 * ajakan login dengan `next` (path tujuan). Modul memori ini meneruskan
 * `next` melewati alur login / 2FA sampai tiba di Welcome/Beranda — sama
 * seperti lib/two-factor-login.ts yang membawa tempToken antar layar.
 *
 * Tidak disimpan persisten: kegunaannya hanya dalam satu rangkaian login;
 * reload memulai konteks baru dengan aman di Beranda tamu.
 */
import type { Href } from "expo-router"

import { api } from "@/lib/api"
import { ROUTES } from "@/lib/routes"

let pendingNext: string | null = null

export function setPendingNext(path: string | null | undefined): void {
  pendingNext = path && path.startsWith("/") ? path : null
}

/** Ambil & bersihkan tujuan tertunda. */
export function takePendingNext(): string | null {
  const value = pendingNext
  pendingNext = null
  return value
}

export function peekPendingNext(): string | null {
  return pendingNext
}

// ── UX-NAV-014 ──────────────────────────────────────────────────────────
// Flag "buka profil sendiri setelah login": dipasang drawer "Lihat Profil"
// saat pengetuknya tamu (username belum diketahui), dikonsumsi SATU KALI
// oleh resolvePostLoginTarget() di akhir alur login yang berhasil.
let openOwnProfileAfterLogin = false

export function setOpenOwnProfileAfterLogin(value: boolean): void {
  openOwnProfileAfterLogin = value
}

function takeOpenOwnProfileAfterLogin(): boolean {
  const value = openOwnProfileAfterLogin
  openOwnProfileAfterLogin = false
  return value
}

/**
 * Tujuan pasca-login TERPUSAT (UX-NAV-001/011/014) — dipakai semua ujung
 * alur login yang berhasil (kata sandi, passkey, sosial, 2FA, setup profil).
 *
 * Urutan:
 *   1. Flag profil-sendiri (drawer "Lihat Profil" sebagai tamu) → baca
 *      username dari /v1/users/me lalu `/user/<username>`. Gagal dibaca →
 *      jatuh ke fallback (jangan jebak user di layar login).
 *   2. Tujuan tertunda (`setPendingNext`, mis. sesi kedaluwarsa di tengah
 *      tugas — UX-NAV-001) — termasuk query string bila penyimpannya
 *      menyertakannya (UX-NAV-009).
 *   3. Param `?next=` layar login (deep link eksternal — UX-NAV-011).
 *   4. Beranda.
 *
 * Murni navigasi: tidak menyentuh logika autentikasi.
 */
export async function resolvePostLoginTarget(queryNext?: string | null): Promise<Href> {
  if (takeOpenOwnProfileAfterLogin()) {
    try {
      const me = await api.users.getMeCached()
      const username = typeof me?.username === "string" ? me.username.trim() : ""
      if (username) return ROUTES.userProfile(username)
    } catch {
      // Profil tak terbaca (mis. sesi belum merambat) — lanjut ke fallback.
    }
  }
  const pending = takePendingNext()
  if (pending) return pending as Href
  if (queryNext) return queryNext as Href
  return ROUTES.home
}
