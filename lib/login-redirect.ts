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

/**
 * Audit Auth 2026-10-10 (#FE-N1): `next` hanya boleh PATH internal.
 *
 * Pemeriksaan lama `startsWith("/")` meloloskan `//evil.tld/…` (URL
 * protocol-relative) dan `/\evil.tld` — di web `router.replace` memperlakukan
 * keduanya sebagai tujuan eksternal, sehingga tautan login palsu
 * (`kahade.id/login?next=//evil.tld`) membawa pengguna yang BARU memasukkan
 * kredensial ke situs penyerang (open redirect pasca-login). Yang lolos:
 * satu garis miring di depan, tanpa skema, tanpa backslash/karakter kontrol.
 */
export function sanitizeNextPath(path: unknown): string | null {
  if (typeof path !== "string") return null
  const value = path.trim()
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return null
  if (/^\/[a-z][a-z\d+.-]*:/i.test(value)) return null
  return value
}

export function setPendingNext(path: string | null | undefined): void {
  pendingNext = sanitizeNextPath(path)
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
  // #FE-N1: param `?next=` berasal dari deep link eksternal — disanitasi di
  // sini juga, bukan hanya di layar yang membacanya.
  const safeQueryNext = sanitizeNextPath(queryNext)
  if (safeQueryNext) return safeQueryNext as Href
  return ROUTES.home
}
