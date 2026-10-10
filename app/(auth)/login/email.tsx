/**
 * Kahade — Masuk lewat email (screen #7b).
 *
 * Halaman khusus satu metode: email + kata sandi (POST /v1/auth/login dengan
 * `identifier` berupa email). Kolom username TIDAK ikut dirender di sini —
 * itu tugas /login/username. Satu layar, satu kredensial, satu tombol.
 *
 * Mediasi conditional passkey (G041/G043) tetap hidup di halaman ini lewat
 * LoginPasswordForm: browser yang mendukung bisa menawarkan passkey sebagai
 * saran otomatis pada kolom email. Hub `/login` sengaja tidak memakainya —
 * di sana tidak ada kolom input yang bisa ditempeli saran.
 */
import { useLocalSearchParams } from "expo-router"

import { LoginMethodScreen } from "@/components/auth/login-method-screen"
import { sanitizeNextPath } from "@/lib/login-redirect"
import { LoginPasswordForm } from "@/components/auth/login-password-form"

export default function LoginEmailScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>()
  const nextPath = sanitizeNextPath(next) ?? undefined

  return (
    <LoginMethodScreen
      heading="Masuk dengan email"
      description="Gunakan email yang terdaftar di akun Kahade Anda."
      infoVariant="password"
    >
      <LoginPasswordForm method="email" nextPath={nextPath} />
    </LoginMethodScreen>
  )
}
