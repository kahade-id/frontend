/**
 * Kahade — util username murni (Batch 139, E01; diperbarui BFI-041; SYS-C-201).
 *
 * DBL-006 (audit integrasi 2026-10-01): aturan username DISATUKAN di backend —
 * phone-register, set-username, dan edit-profil semuanya 3–30, charset
 * [a-zA-Z0-9._] (`set-username.dto`, `phone-register.dto`,
 * `update-profile.dto`; layanan menormalkan ke lowercase untuk uniqueness).
 * DTO ini dulu lebih ketat (3–20, huruf kecil saja), yang membuat FE mentok
 * 20 sementara server mengizinkan 30 — truncate diam-diam. Jangan kembalikan
 * batas 20 tanpa menyelaraskan backend dulu.
 *
 * `normalizeUsername` = bentuk FINAL yang dikirim ke server untuk alur
 * set-username/edit-profil: lowercase + strip karakter ilegal + slice 30
 * (mirror normalisasi lowercase di `auth.service.setUsername`).
 */

export const USERNAME_MIN = 3
export const USERNAME_MAX = 30

/** Bentuk FINAL username: persis string yang dikirim ke server (alur set-username). */
export function normalizeUsername(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, USERNAME_MAX)
}

/**
 * BFI-041: aturan per endpoint — mirror dto backend (UMPAN BALIK DINI saja;
 * backend sumber kebenaran). DBL-006/SYS-C-201: set-username disatukan ke
 * 3–30 (dulu 3–20, huruf kecil saja).
 */
export const REGISTER_USERNAME_MIN = 3
export const REGISTER_USERNAME_MAX = 30
export const SET_USERNAME_MIN = 3
export const SET_USERNAME_MAX = 30
/** phone-register: 3–30, huruf besar & titik diizinkan. */
export const REGISTER_USERNAME_RE = /^[a-zA-Z0-9._]{3,30}$/
/** set-username: 3–30, huruf besar & titik diizinkan (DBL-006 — dulu 3–20 lowercase). */
export const SET_USERNAME_RE = /^[a-zA-Z0-9._]{3,30}$/

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
