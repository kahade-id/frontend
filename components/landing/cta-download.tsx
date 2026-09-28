/**
 * Kahade landing — <LandingCtaDownload>: ajakan unduh aplikasi.
 *
 * Section gelap: kiri 3 langkah mini memulai, kanan kartu berisi placeholder
 * QR (JUJUR: bukan QR asli, hanya ikon + teks "QR download menyusul"),
 * badge store nonaktif ("Segera hadir" — belum ada akun store), dan tombol
 * menonjol menuju web app (aksi nyata yang bisa dilakukan SEKARANG).
 */
import { Pressable, View } from "react-native"
import { useRouter } from "expo-router"
import { AppleLogo, ArrowRight, GooglePlayLogo, QrCode } from "phosphor-react-native"

import { Icon, type IconComponent } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { ROUTES } from "@/lib/routes"

import { Reveal } from "./reveal"
import { Section } from "./section"

const STEPS = [
  { title: "Buka web app Kahade", description: "langsung dari browser — tanpa install" },
  { title: "Daftar dengan nomor HP", description: "verifikasi cepat via WhatsApp" },
  { title: "Mulai transaksi aman", description: "dana dilindungi escrow" },
]

function StoreBadge({
  icon,
  store,
  label,
}: {
  icon: IconComponent
  store: string
  label: string
}) {
  return (
    <Pressable
      disabled
      accessibilityRole="button"
      accessibilityState={{ disabled: true }}
      accessibilityLabel={`${label} — ${store}`}
      className="flex-1 flex-row items-center justify-center gap-2 rounded-sm border border-border px-4 py-3 opacity-60"
    >
      <Icon icon={icon} size="md" tone="inverse" />
      <View className="items-start">
        <Text variant="caption" tone="inverse" weight={600}>
          {label}
        </Text>
        <Text variant="caption" tone="inverse">
          {store}
        </Text>
      </View>
    </Pressable>
  )
}

export function LandingCtaDownload() {
  const router = useRouter()

  return (
    <Section
      id="download"
      dark
      eyebrow="Mulai Sekarang"
      title="Siap jual beli tanpa was-was?"
      description="Gratis. Tanpa kartu kredit. Verifikasi nomor HP kurang dari 2 menit."
    >
      <View className="flex-col gap-10 md:flex-row md:items-center md:gap-16">
        {/* Kiri: 3 langkah mini */}
        <Reveal className="flex-1">
          <View className="gap-6">
            {STEPS.map((step, index) => (
              <View key={step.title} className="flex-row items-start gap-4">
                <View className="h-10 w-10 items-center justify-center rounded-full border border-border">
                  <Text variant="label" tone="inverse">
                    {index + 1}
                  </Text>
                </View>
                <View className="flex-1 gap-1 pt-1">
                  <Text variant="body" weight={600} tone="inverse">
                    {step.title}
                  </Text>
                  <Text variant="caption" tone="inverse">
                    {step.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Reveal>

        {/* Kanan: kartu unduh */}
        <Reveal delay={120} className="flex-1">
          <View className="items-center gap-6 rounded-md border border-border px-6 py-8 md:px-10">
            <View className="items-center justify-center gap-3 rounded-md border border-dashed border-border px-12 py-8">
              <Icon icon={QrCode} size={64} tone="inverse" accessibilityLabel="Kode QR unduhan" />
              <Text variant="caption" tone="inverse" className="text-center">
                QR download menyusul
              </Text>
            </View>

            <View className="w-full flex-row gap-3">
              <StoreBadge icon={AppleLogo} label="App Store" store="Segera hadir" />
              <StoreBadge icon={GooglePlayLogo} label="Play Store" store="Segera hadir" />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Buka Web App Kahade — mulai sekarang, gratis"
              onPress={() => router.push(ROUTES.showcase)}
              className="w-full flex-row items-center justify-center gap-2 rounded-sm bg-primary px-5 py-3.5"
            >
              <Text variant="body" weight={700} tone="inverse">
                Buka Web App — Gratis
              </Text>
              <Icon icon={ArrowRight} size="sm" tone="inverse" />
            </Pressable>
          </View>
        </Reveal>
      </View>
    </Section>
  )
}
