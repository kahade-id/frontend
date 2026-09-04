/**
 * Kahade — status onboarding (slide intro, screen #1 alur auth).
 *
 * Satu flag persisten "sudah lihat intro" yang dibaca gate `app/index.tsx`
 * untuk memutuskan rute awal: `/onboarding` (belum) atau `/login` (sudah).
 *
 * Keputusan non-obvious:
 *   - Disimpan di SecureStore lewat `lib/secure-storage.ts` (key
 *     `SecureKeys.onboardingSeen`) — bukan karena rahasia, tapi karena itu
 *     satu-satunya storage persisten yang terpasang; alasan lengkap di
 *     komentar key-nya. Tidak ikut `clearSession()`: logout tidak mengulang
 *     intro.
 *   - Di web SecureStore jatuh ke memori proses, jadi intro muncul lagi tiap
 *     reload. Diterima: sesi web bertumpu pada cookie backend dan onboarding
 *     web bukan target v1 (§11 web = mobile-width mirror).
 *   - Ditandai "seen" saat user MENINGGALKAN onboarding lewat CTA/Lewati/
 *     Masuk — bukan saat slide terakhir tampil — supaya user yang menutup
 *     app di tengah intro masih melihatnya lagi.
 *   - Error storage ditelan menjadi `false`/no-op: gagal membaca flag tidak
 *     boleh menghentikan boot; konsekuensinya hanya intro tampil sekali lagi.
 */
import { getSecureItem, SecureKeys, setSecureItem } from "@/lib/secure-storage"

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await getSecureItem(SecureKeys.onboardingSeen)) === "1"
  } catch {
    return false
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await setSecureItem(SecureKeys.onboardingSeen, "1")
  } catch (err) {
    if (__DEV__) console.warn("[kahade/onboarding] gagal menyimpan flag onboarding:", err)
  }
}
