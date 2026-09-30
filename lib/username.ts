/**
 * Kahade — util username murni (Batch 139, E01; diperbarui BFI-041).
 *
 * PENTING: aturan username BERBEDA per endpoint — jangan seragamkan.
 *  - POST /v1/auth/phone-register: 3–30, boleh huruf BESAR & titik
 *    (`phone-register.dto`: `/^[a-zA-Z0-9._]{3,30}$/`). JANGAN lowercase di
 *    sini — username register tampil persis seperti diketik.
 *  - POST /v1/auth/set-username: 3–20, lowercase, HANYA underscore
 *    (`set-username.dto`: `/^[a-z0-9_]{3,20}$/` — TANPA titik; titik/uppercase
 *    ditolak 400).
 * `normalizeUsername` (legacy, lowercase+titik) hanya untuk alur
 * set-username/edit-profil — bukan registrasi.
 */

export const USERNAME_MIN = 3
export const USERNAME_MAX = 20

/** Bentuk FINAL username: persis string yang dikirim ke server (alur set-username). */
export function normalizeUsername(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, USERNAME_MAX)
}

/**
 * BFI-041: aturan khusus endpoint — mirror dto backend (UMPAN BALIK DINI
 * saja; backend sumber kebenaran).
 */
export const REGISTER_USERNAME_MIN = 3
export const REGISTER_USERNAME_MAX = 30
export const SET_USERNAME_MIN = 3
export const SET_USERNAME_MAX = 20
/** phone-register: 3–30, huruf besar & titik diizinkan. */
export const REGISTER_USERNAME_RE = /^[a-zA-Z0-9._]{3,30}$/
/** set-username: 3–20, lowercase, underscore saja (tanpa titik). */
export const SET_USERNAME_RE = /^[a-z0-9_]{3,20}$/

/** True bila username lolos aturan phone-register (BE: phone-register.dto). */
export function isValidRegisterUsername(username: string): boolean {
  return REGISTER_USERNAME_RE.test(username)
}

/** True bila username lolos aturan set-username (BE: set-username.dto). */
export function isValidSetUsername(username: string): boolean {
  return SET_USERNAME_RE.test(username)
}

/** Normalisasi untuk phone-register: trim, batasi 30 karakter (BE menolak >30). */
export function normalizeRegisterUsername(value: string): string {
  return value.trim().slice(0, REGISTER_USERNAME_MAX)
}
