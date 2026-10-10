/**
 * Kahade — OAuth Google/Apple tingkat rendah (GAP-A G001–G025).
 *
 * Dipakai oleh:
 *  - components/auth/social-login-buttons.tsx (login) → idToken → socialLogin
 *  - app/social-providers.tsx (tautkan dari akun login) → idToken → linkSocial
 *
 * Nonce:
 *  - Apple: nonce WAJIB terbitan server (POST /v1/auth/apple/nonce); nonce
 *    buatan klien 100% ditolak backend (kontrak Wave 1, 2026-09-28).
 *  - Google: nonce acak klien masih dipakai (backend hanya memverifikasi
 *    bila dikirim) — anti-replay G011.
 */

import { Platform } from "react-native"
import * as AppleAuthentication from "expo-apple-authentication"
import * as AuthSession from "expo-auth-session"
import * as WebBrowser from "expo-web-browser"

import type { SocialProvider } from "@/lib/api/social"
import { requestAppleNonce } from "@/lib/api/social"

WebBrowser.maybeCompleteAuthSession()

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
}
const APPLE_AUTHORIZE_URL = "https://appleid.apple.com/auth/authorize"

export class SocialCancelledError extends Error {
  constructor() {
    super("Login sosial dibatalkan pengguna.")
    this.name = "SocialCancelledError"
  }
}

function randomHex(bytes = 32): string {
  const arr = new Uint8Array(bytes)
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(arr)
  else arr.forEach((_, i) => (arr[i] = Math.floor(Math.random() * 256)))
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function getGoogleIdToken(clientId: string, nonce: string): Promise<string> {
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri: AuthSession.makeRedirectUri(),
    responseType: AuthSession.ResponseType.IdToken,
    scopes: ["openid", "profile", "email"],
    extraParams: { nonce },
  })
  const res = await request.promptAsync(GOOGLE_DISCOVERY)
  if (res.type === "cancel" || res.type === "dismiss") throw new SocialCancelledError()
  if (res.type !== "success") throw new Error(`Google auth gagal (${res.type}). Coba lagi.`)
  const idToken = (res.params as { id_token?: string }).id_token
  if (!idToken) throw new Error("Google tidak mengembalikan id_token. Coba lagi.")
  return idToken
}

async function getAppleIdToken(clientId: string, nonce: string): Promise<string> {
  if (Platform.OS === "ios") {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce,
    })
    if (!credential.identityToken) throw new Error("Apple tidak mengembalikan identity token.")
    return credential.identityToken
  }
  const redirectUri = AuthSession.makeRedirectUri()
  // Audit Auth 2026-10-10 (#FE-S13): `state` dibangkitkan tetapi tidak pernah
  // DICOCOKKAN saat callback — callback palsu (login-CSRF) bisa menyuntik
  // id_token milik akun penyerang ke alur ini. Kini state wajib sama.
  const state = randomHex(16)
  const authUrl =
    `${APPLE_AUTHORIZE_URL}?` +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "id_token",
      response_mode: "fragment",
      scope: "name email",
      nonce,
      state,
    }).toString()
  const res = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri)
  if (res.type === "cancel" || res.type === "dismiss") throw new SocialCancelledError()
  if (res.type !== "success") throw new Error(`Apple auth gagal (${res.type}). Coba lagi.`)
  const hash = new URL(res.url).hash.replace(/^#/, "")
  const fragment = new URLSearchParams(hash)
  if (fragment.get("state") !== state) {
    throw new Error("Apple auth gagal (state tidak cocok). Coba lagi.")
  }
  const idToken = fragment.get("id_token")
  if (!idToken) throw new Error("Apple tidak mengembalikan id_token (mungkin callback kedaluwarsa).")
  return idToken
}

/**
 * Jalankan alur OAuth dan kembalikan { idToken, nonce }.
 * Melempar SocialCancelledError bila user membatalkan.
 *
 * Apple: nonce diambil dari SERVER (kontrak Wave 1) SEBELUM request Apple
 * auth dimulai — Apple men-embed nonce ke identity token, jadi nonce server
 * harus sudah ada sebelum dialog Apple tampil.
 */
export async function getSocialIdToken(
  provider: SocialProvider,
  clientId: string,
): Promise<{ idToken: string; nonce: string }> {
  // Apple: nonce terbitan server; Google: nonce acak klien (G011).
  const nonce = provider === "APPLE" ? await requestAppleNonce() : randomHex()
  try {
    const idToken =
      provider === "GOOGLE" ? await getGoogleIdToken(clientId, nonce) : await getAppleIdToken(clientId, nonce)
    return { idToken, nonce }
  } catch (err) {
    if (err instanceof SocialCancelledError) throw err
    // Pembatalan native Apple terlempar sebagai kode khusus.
    const msg = err instanceof Error ? err.message : String(err ?? "")
    if (/ERR_CANCELED|cancelled|canceled/i.test(msg)) throw new SocialCancelledError()
    throw err
  }
}

/**
 * True bila tombol "Lanjut dengan Apple" boleh tampil di platform ini.
 *
 * iOS SAJA (kebijakan produk overhaul auth 2026-10-10): Apple sendiri
 * meminta Sign in with Apple ditawarkan lewat mekanisme native di iOS, dan
 * HIG melarang tombol Apple tiruan di platform lain. Di Android tombol ini
 * TIDAK dirender sama sekali — bukan disabled, bukan "segera hadir": baris
 * yang tidak bisa dipakai hanya menambah beban pilih di layar masuk.
 *
 * Web ikut disembunyikan karena `app/index.tsx` mengarahkan pengunjung web ke
 * https://kahade.id, jadi permukaan web aplikasi ini bukan corong masuk utama.
 * Jalur Apple berbasis browser di `getAppleIdToken` DIPERTAHANKAN (kontrak
 * `POST /v1/auth/apple/nonce` + `response_mode=fragment` tetap teruji) supaya
 * permukaan web yang memang membutuhkannya tinggal melonggarkan fungsi ini —
 * satu tempat, bukan mencari-cari tombolnya.
 */
export function isAppleButtonSupported(): boolean {
  return Platform.OS === "ios"
}

/**
 * Klasifikasi error login sosial untuk copy yang jujur (UI-UX T4-011).
 *
 *  - "cancelled" → user sengaja membatalkan → DIAM (tanpa error).
 *  - "network"   → "Periksa koneksi internet lalu coba lagi."
 *  - "other"     → "Coba lagi, atau masuk dengan nomor HP." (jangan tuduh
 *                    koneksi bila masalahnya bukan jaringan; jangan tampilkan
 *                    pesan mentah SDK yang bisa berbahasa Inggris).
 *
 * Pesan mentah TIDAK pernah keluar dari sini — hanya klasifikasi; copy
 * Bahasa Indonesia disusun pemanggil.
 */
export type SocialErrorKind = "cancelled" | "network" | "other"

export function classifySocialError(err: unknown): SocialErrorKind {
  if (err instanceof SocialCancelledError) return "cancelled"
  // ApiError dari api.social.* — kode jaringan/timeout terstandar.
  const code = (err as { code?: unknown } | null)?.code
  if (code === "NETWORK" || code === "TIMEOUT") return "network"
  // Error polos SDK/native (expo-auth-session, fetch): heuristik konservatif
  // pada teksnya. Tidak cocok → "other" (fail-closed, bukan network).
  const msg = err instanceof Error ? err.message : String(err ?? "")
  if (/network|timeout|econn|socket|offline|fetch failed/i.test(msg)) return "network"
  return "other"
}
