/**
 * Kahade — Masuk lewat WhatsApp (screen #7a).
 *
 * Halaman khusus satu metode: nomor HP → kode verifikasi yang dibalas WhatsApp
 * resmi Kahade. Tidak ada kolom kata sandi di layar ini, dan tidak ada metode
 * lain yang menumpuk — pemilih metode hidup di hub `/login`.
 *
 * Pendaftaran TIDAK tersedia dari sini: registrasi tetap hanya lewat wizard
 * nomor HP (`/register`), dan nomor yang belum terdaftar mendapat pesan
 * spesifik dari LoginWhatsappForm (404 → "belum terdaftar"), bukan form
 * kata sandi yang membingungkan.
 */
import { useLocalSearchParams } from "expo-router"

import { LoginMethodScreen } from "@/components/auth/login-method-screen"
import { LoginWhatsappForm } from "@/components/auth/login-whatsapp-form"

export default function LoginWhatsappScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>()
  const nextPath = sanitizeNextPath(next) ?? undefined

  return (
    <LoginMethodScreen
      heading="Masuk dengan WhatsApp"
      description="Masukkan nomor HP yang terdaftar. Kode verifikasi dikirim sebagai balasan WhatsApp."
      infoVariant="whatsappOtp"
    >
      <LoginWhatsappForm nextPath={nextPath} />
    </LoginMethodScreen>
  )
}
