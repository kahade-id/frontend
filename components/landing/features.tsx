/**
 * Kahade landing — <LandingFeatures>: grid kartu fitur unggulan.
 *
 * 2 kolom di mobile, 3 kolom di desktop. Ikon dalam lingkaran netral
 * (monokrom brand) + judul + satu kalimat.
 */
import { View } from "react-native"
import {
  ChatCircle,
  Heart,
  Link,
  QrCode,
  SealCheck,
  Wallet,
} from "phosphor-react-native"

import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"

import { Reveal } from "./reveal"
import { Section } from "./section"

const FEATURES = [
  {
    icon: Heart,
    title: "Etalase Sosial",
    description: "Like, komen, dan share etalase — seru seperti media sosial.",
  },
  {
    icon: ChatCircle,
    title: "Chat Langsung",
    description: "Nego dan tanya jawab langsung di aplikasi, tanpa pindah chat.",
  },
  {
    icon: Wallet,
    title: "Dompet Digital",
    description: "Saldo, top up, dan tarik dana dalam satu tempat.",
  },
  {
    icon: QrCode,
    title: "Scan QR",
    description: "Bayar dan mulai transaksi dalam sekejap.",
  },
  {
    icon: Link,
    title: "Order Link",
    description: "Satu link untuk semua pesananmu — mudah dibagikan.",
  },
  {
    icon: SealCheck,
    title: "Bukti Terpercaya",
    description: "Ulasan dan riwayat transaksi yang transparan.",
  },
] as const

export function LandingFeatures() {
  return (
    <Section
      id="fitur"
      eyebrow="Fitur Unggulan"
      title="Satu aplikasi untuk jualan & belanja."
    >
      <View className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5">
        {FEATURES.map((feature, i) => (
          <Reveal key={feature.title} delay={(i % 3) * 90}>
            <View className="rounded-2xl border border-border bg-surface-elevated p-5 md:p-6">
              <View className="mb-4 h-12 w-12 items-center justify-center rounded-full bg-surface">
                <Icon icon={feature.icon} size="md" tone="active" />
              </View>
              <Text variant="h3" className="mb-1.5">
                {feature.title}
              </Text>
              <Text variant="body" tone="secondary">
                {feature.description}
              </Text>
            </View>
          </Reveal>
        ))}
      </View>
    </Section>
  )
}
