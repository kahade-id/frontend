/**
 * Kahade — flag coach mark "sekali saja" untuk elemen UI baru.
 *
 * Dua elemen yang diperkenalkan 2026-09-27/28 — tombol (+) di header Etalase
 * dan ikon QR di tengah bottom navbar — mendapat tooltip pengenal kecil yang
 * tampil SEKALI saat user pertama kali melihatnya setelah update, lalu tidak
 * pernah lagi setelah dilihat/ditutup.
 *
 * Pola mengikuti lib/onboarding.ts: flag "1" di SecureStore (bukan karena
 * rahasia, tapi karena itu satu-satunya storage persisten yang terpasang;
 * lihat komentar key-nya). Level perangkat, TIDAK dihapus `clearSession()`
 * — logout bukan alasan menampilkan ulang pengenal elemen.
 *
 * Di web SecureStore jatuh ke memori proses (kecuali key di
 * WEB_PERSISTENT_KEYS — kedua key ini SUDAH didaftarkan di sana), jadi di web
 * flag bertahan antar reload seperti di native.
 */
import { getSecureItem, SecureKeys, setSecureItem } from "@/lib/secure-storage"

export type CoachMarkId = "create" | "qr"

const KEY_BY_ID: Record<CoachMarkId, (typeof SecureKeys)[keyof typeof SecureKeys]> = {
  create: SecureKeys.coachMarkCreateSeen,
  qr: SecureKeys.coachMarkQrSeen,
}

/** true bila coach mark untuk elemen ini sudah pernah tampil/ditutup. */
export async function hasSeenCoachMark(id: CoachMarkId): Promise<boolean> {
  try {
    return (await getSecureItem(KEY_BY_ID[id])) === "1"
  } catch {
    // Gagal membaca = anggap belum: konsekuensinya hanya tooltip tampil
    // sekali lagi, tidak menghentikan render (pola onboarding.ts).
    return false
  }
}

/** Tandai coach mark sudah dilihat — dipanggil saat tooltip ditutup. */
export async function markCoachMarkSeen(id: CoachMarkId): Promise<void> {
  try {
    await setSecureItem(KEY_BY_ID[id], "1")
  } catch (err) {
    if (__DEV__) console.warn("[kahade/coach-mark] gagal menyimpan flag:", err)
  }
}
