/**
 * Kahade — Masuk lewat username (screen #7c).
 *
 * Halaman khusus satu metode: username + kata sandi (POST /v1/auth/login
 * dengan `identifier` berupa username). Kolom email tidak ikut dirender —
 * validasi identifier berbeda (username menolak spasi dan "@") dan
 * keyboard/autofill-nya pun berbeda, jadi mencampurnya dalam satu form
 * membuat pesan error sering tidak cocok dengan yang diketik pengguna.
 */
import { useLocalSearchParams } from "expo-router"

import { LoginMethodScreen } from "@/components/auth/login-method-screen"
import { sanitizeNextPath } from "@/lib/login-redirect"
import { LoginPasswordForm } from "@/components/auth/login-password-form"

export default function LoginUsernameScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>()
  const nextPath = sanitizeNextPath(next) ?? undefined

  return (
    <LoginMethodScreen
      heading="Masuk dengan username"
      description="Gunakan username akun Kahade Anda, tanpa tanda @."
      infoVariant="password"
    >
      <LoginPasswordForm method="username" nextPath={nextPath} />
    </LoginMethodScreen>
  )
}
