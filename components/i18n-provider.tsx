/**
 * Kahade — I18nProvider (boot bahasa + sinkronisasi akun).
 *
 * Dua tanggung jawab, keduanya efek samping, TIDAK ada context:
 *   1. Menentukan bahasa SEBELUM tree app sempat render teks: cache perangkat
 *      → bahasa sistem. Ini mencegah "kedip" teks Indonesia pada perangkat
 *      English (pola yang sama dipakai root layout untuk memanggil
 *      `colorScheme.set()` sebelum ThemeProvider mount).
 *   2. Setelah punya sesi: tarik preferensi akun (GET /v1/settings/language)
 *      dan mengalah padanya. Preferensi itu milik akun, jadi login di ponsel
 *      baru harus membawa bahasa yang sama — tanpa langkah ini, perangkat baru
 *      selalu jatuh ke bahasa OS.
 *
 * Kenapa TIDAK me-remount tree saat bahasa berubah (non-obvious):
 *   Remount dari root = Stack navigasi di-reset, user terlempar ke Beranda
 *   setiap kali mengganti bahasa. Re-render ditanggung <Text> (semua teks app
 *   melewatinya) lewat useSyncExternalStore di lib/i18n/react.ts.
 *
 * Batas yang disadari: string yang dibaca komponen native (placeholder input
 * sudah ditambal di primitifnya; label a11y di komponen kustom tertentu baru
 * mengikuti pada render berikutnya). Terjemahan TIDAK pernah membuat teks
 * hilang — kunci yang tak ditemukan jatuh ke Bahasa Indonesia.
 */
import { useEffect, useRef, type ReactNode } from "react"
import { Platform } from "react-native"

import * as settingsApi from "@/lib/api/settings"
import { getSessionRevision } from "@/lib/api/session"
import {
  adoptAccountLanguage,
  clearLanguagePendingSync,
  getLanguage,
  initLanguage,
  isLanguagePendingSync,
  systemLanguage,
  useLanguage,
} from "@/lib/i18n"
import { logWarn } from "@/lib/telemetry"
import { useAuthSession } from "@/lib/use-auth-session"

export function I18nProvider({ children }: { children: ReactNode }) {
  // (1) Boot: sinkron dan selesai sebelum anak pertama render? `initLanguage`
  // async (SecureStore), jadi bahasa sistem dipakai lebih dulu supaya frame
  // pertama sudah benar di perangkat non-Indonesia, lalu cache menyusul.
  const booted = useRef(false)
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    void initLanguage(systemLanguage())
  }, [])

  // (1b) Web: <html lang> dipakai pembaca layar & mesin pencari untuk memilih
  // pelafalan. `app/+html.tsx` menulis "id" saat prerender (tidak mungkin tahu
  // bahasa pengunjung saat export statis), jadi atributnya disetel di sini.
  const language = useLanguage()
  useEffect(() => {
    if (Platform.OS !== "web") return
    try {
      document.documentElement.lang = language
    } catch {
      /* prerender tanpa DOM */
    }
  }, [language])

  // (2) Preferensi akun. `sessionRevision` menjagai respons agar tidak pernah
  // menerapkan bahasa milik akun yang sudah diganti (logout/login cepat).
  const session = useAuthSession()
  const synced = useRef<number | null>(null)
  useEffect(() => {
    if (!session.token || session.restoring) return
    const revision = getSessionRevision()
    if (synced.current === revision) return
    synced.current = revision
    let alive = true
    // ST-001 (audit performa): import domain langsung, bukan barrel @/lib/api
    // (±35 domain) — file ini di-mount paling luar di RootLayout.
    void (async () => {
      /**
       * Audit Pengaturan 2026-10-10: pilihan bahasa yang dibuat sebagai tamu
       * atau saat registrasi (penanda `languagePendingSync`) adalah pilihan
       * EKSPLISIT pengguna — kirim ke akun, jangan ditimpa bawaan server
       * ("id" untuk akun baru). Gagal kirim (offline) → biarkan bahasa
       * perangkat; penanda tetap ada untuk dicoba lagi di sesi berikutnya.
       */
      if (await isLanguagePendingSync()) {
        if (!alive || getSessionRevision() !== revision) return
        try {
          await settingsApi.updateLanguage({ language: getLanguage() })
          await clearLanguagePendingSync()
        } catch (error) {
          logWarn("i18n:push-pending-language", error)
        }
        return
      }
      try {
        const res = await settingsApi.getLanguage()
        if (!alive || getSessionRevision() !== revision) return
        void adoptAccountLanguage(res?.language)
      } catch {
        // Offline / endpoint belum siap: biarkan bahasa lokal. Tidak ada toast
        // di boot — kegagalan baca preferensi bukan keadaan yang perlu
        // memberi tahu user.
      }
    })()
    return () => {
      alive = false
    }
  }, [session.token, session.restoring])

  return <>{children}</>
}
