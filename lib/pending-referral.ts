/**
 * Kahade — kode referral tertunda dari tautan undangan `kahade.id/r/<kode>`.
 *
 * Audit voucher/referral 2026-10-10 (F01/F02): tautan undangan mendarat di
 * `/r/<kode>` → redirect ke `/referral?code=…` (rute protected). Tamu lalu
 * diarahkan ke login/registrasi, dan kode HANYA hidup di `pendingNext`
 * (memori) — begitu registrasi selesai (`phoneRegister`) kode tidak pernah
 * dikirim, sehingga undangan ke user BARU tidak tercatat kecuali user
 * membuka /referral lagi dan menekan "Terapkan" secara manual.
 *
 * Modul ini menyimpan kode di SecureStore (native) / memori (web) sejak
 * deeplink diterima, lalu:
 *   - `register-security` mengirimnya sebagai `referralCode` ke
 *     POST /v1/auth/phone-register (backend sudah menerima field ini), dan
 *   - layar /referral (user lama yang belum punya pengundang) memakainya
 *     untuk mengisi kolom "Punya kode dari teman?".
 *
 * Kode dibersihkan setelah terpakai atau kedaluwarsa (7 hari) — tautan lama
 * tidak boleh "menempel" selamanya pada perangkat bersama.
 */
import { deleteRawItem, getRawItem, setRawItem } from "@/lib/secure-storage"

const KEY = "kahade.referral.pendingCode"
/** Masa simpan kode tertunda. */
const TTL_MS = 7 * 24 * 60 * 60 * 1000
/** Batas backend `PhoneRegisterDto.referralCode` (maxLength 20). */
const MAX_LENGTH = 20

type Stored = { code: string; savedAt: number }

/** "  khAbc12 " → "KHABC12"; null bila kosong/terlalu panjang/berisi karakter aneh. */
export function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null
  const code = raw.trim().toUpperCase()
  if (!code || code.length > MAX_LENGTH) return null
  if (!/^[A-Z0-9_-]+$/.test(code)) return null
  return code
}

export async function savePendingReferralCode(raw: string | null | undefined): Promise<void> {
  const code = normalizeReferralCode(raw)
  if (!code) return
  const payload: Stored = { code, savedAt: Date.now() }
  try {
    await setRawItem(KEY, JSON.stringify(payload))
  } catch {
    // Penyimpanan gagal (SecureStore penuh/tidak tersedia) — bukan alasan
    // menggagalkan navigasi deeplink; user masih bisa mengetik kode manual.
  }
}

export async function getPendingReferralCode(): Promise<string | null> {
  let raw: string | null = null
  try {
    raw = await getRawItem(KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<Stored>
    const code = normalizeReferralCode(parsed.code)
    const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : 0
    if (!code || Date.now() - savedAt > TTL_MS) {
      void clearPendingReferralCode()
      return null
    }
    return code
  } catch {
    void clearPendingReferralCode()
    return null
  }
}

export async function clearPendingReferralCode(): Promise<void> {
  try {
    await deleteRawItem(KEY)
  } catch {
    // Diabaikan — kode yang tertinggal akan kedaluwarsa sendiri (TTL).
  }
}
