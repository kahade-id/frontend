/**
 * Kahade — kerangka halaman metode masuk (arsitektur baru 2026-10-10).
 *
 * Satu metode = satu halaman bersih. Ketiga halaman (/login/whatsapp,
 * /login/email, /login/username) berbagi kerangka ini supaya yang berbeda
 * hanya isinya (form), bukan tata letaknya: header + ⓘ, judul H1, deskripsi
 * satu kalimat, form dengan tombol aksi DI BAWAH konten (mengikuti scroll),
 * tautan keluar (ganti metode / daftar / lupa kata sandi), lalu satu baris
 * persetujuan.
 *
 * Keputusan non-obvious:
 *   - Tombol aksi TIDAK di FooterBar: layar metode pendek (satu atau dua
 *     kolom), dan tombol yang mengikuti konten terasa lebih dekat dengan
 *     kolom yang baru diisi. FooterBar + separator hanya menyisakan pita
 *     kosong di layar yang isinya tidak sampai setengah tinggi.
 *   - `keyboardAvoiding` di <Screen> dengan offset 0 — header ikut terangkat
 *     karena dirender DI DALAM area yang menghindari keyboard (CHT-014).
 *   - Header memakai judul pendek "Masuk" dan H1 di konten menyebut
 *     metodenya: satu H1 per layar (audit a11y #8) dan hierarki heading tidak
 *     terbalik.
 *   - Sesi yang masih hidup dialihkan ke Beranda di sini, bukan di tiap
 *     halaman — tiga rute, satu aturan.
 */
import type { ReactNode } from "react"
import { useEffect } from "react"
import { ScrollView } from "react-native"
import { useRouter } from "expo-router"

import { AuthSecurityInfo } from "@/components/auth/auth-security-info"
import { LegalConsent } from "@/components/auth/legal-consent"
import { FadeIn } from "@/components/ui/fade-in"
import { Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { VStack } from "@/components/ui/stack"
import { ROUTES } from "@/lib/routes"
import { useAuthSession } from "@/lib/use-auth-session"
import type { AuthSecurityInfoVariant } from "@/lib/auth-security-info"

export type LoginMethodScreenProps = {
  /** H1 konten — menyebut metodenya, mis. "Masuk dengan WhatsApp". */
  heading: string
  /** Satu kalimat penjelas apa yang akan diminta dari pengguna. */
  description: string
  /** Kumpulan poin ⓘ yang relevan dengan metode ini. */
  infoVariant: AuthSecurityInfoVariant
  /** Form metode (menyertakan tombol aksinya sendiri). */
  children: ReactNode
  /** Tautan khusus metode ini, mis. "Lupa kata sandi?" di halaman Email. */
  methodLinks?: ReactNode
}

export function LoginMethodScreen({
  heading,
  description,
  infoVariant,
  children,
  methodLinks,
}: LoginMethodScreenProps) {
  const router = useRouter()
  const session = useAuthSession()

  useEffect(() => {
    if (!session.restoring && session.token) router.replace(ROUTES.home)
  }, [session.restoring, session.token, router])

  return (
    <Screen keyboardAvoiding padded={false} edges={["top"]}>
      <Header title="Masuk" safeArea={false} right={<AuthSecurityInfo variant={infoVariant} />} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow px-5 pb-8 pt-6"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <FadeIn duration="fast">
          <VStack gap={6}>
            <VStack gap={2}>
              <Heading level={1} className="text-balance">
                {heading}
              </Heading>
              <Text variant="body" tone="secondary" className="text-pretty">
                {description}
              </Text>
            </VStack>

            {/* Form + tombol aksinya sendiri (di bawah konten, ikut scroll). */}
            {children}

            {methodLinks}

            <VStack gap={3} className="items-center pt-1">
              <TextLink variant="caption" onPress={() => router.replace(ROUTES.login)}>
                Pilih metode lain
              </TextLink>
              <Text variant="body" tone="secondary" className="text-center">
                Belum punya akun?{" "}
                <TextLink inline onPress={() => router.push(ROUTES.register)}>
                  Daftar
                </TextLink>
              </Text>
            </VStack>

            <LegalConsent action="signIn" />
          </VStack>
        </FadeIn>
      </ScrollView>
    </Screen>
  )
}
