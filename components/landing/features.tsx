/**
 * Kahade landing — <LandingFeatures>: fitur unggulan dalam layout bento.
 *
 * Bento (bukan grid monoton): kartu pertama (Etalase Sosial) membentang 2
 * kolom di desktop dengan strip ilustrasi interaksi sosial; lima kartu lain
 * mengisi ritme 1 kolom. Mobile: 1 kolom penuh agar tidak sempit.
 */
import { View } from "react-native"
import {
  ChatCircle,
  ChatCircleText,
  Heart,
  Link,
  QrCode,
  SealCheck,
  ShareNetwork,
  Wallet,
} from "phosphor-react-native"

import { Icon, type IconComponent } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"

import { Reveal } from "./reveal"
import { Section } from "./section"

type Feature = {
  icon: IconComponent
  title: string
  description: string
  /** Kartu hero bento: membentang 2 kolom di desktop. */
  hero?: boolean
}

const FEATURES: Feature[] = [
  {
    icon: Heart,
    title: "Etalase Sosial",
    description:
      "Jualan semudah posting: produk bisa di-like, dikomentari, dan dibagikan — pembeli datang karena suka, bukan cuma butuh.",
    hero: true,
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
]

/** Strip ilustrasi interaksi untuk kartu hero bento. */
function SocialStrip() {
  return (
    <View className="mt-5 flex-row items-center gap-5 border-t border-border pt-4">
      <View className="flex-row items-center gap-1.5">
        <Icon icon={Heart} size="sm" tone="danger" weight="fill" />
        <Text variant="caption" tone="secondary">
          Suka
        </Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        <Icon icon={ChatCircleText} size="sm" tone="active" />
        <Text variant="caption" tone="secondary">
          Komentar
        </Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        <Icon icon={ShareNetwork} size="sm" tone="active" />
        <Text variant="caption" tone="secondary">
          Bagikan
        </Text>
      </View>
    </View>
  )
}

export function LandingFeatures() {
  return (
    <Section
      id="fitur"
      eyebrow="Fitur Unggulan"
      title="Satu aplikasi untuk jualan & belanja."
      description="Semua yang kamu butuhkan — dari pajang dagangan sampai dana cair — tanpa pindah aplikasi."
    >
      <View className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
        {FEATURES.map((feature, i) => (
          <Reveal
            key={feature.title}
            delay={(i % 3) * 90}
            className={feature.hero ? "md:col-span-2" : undefined}
          >
            <View className="h-full rounded-2xl border border-border bg-surface-elevated p-5 md:p-6">
              <View className="mb-4 h-12 w-12 items-center justify-center rounded-full bg-surface">
                <Icon icon={feature.icon} size="md" tone="active" />
              </View>
              <Text variant="h3" className="mb-1.5">
                {feature.title}
              </Text>
              <Text variant="body" tone="secondary">
                {feature.description}
              </Text>
              {feature.hero ? <SocialStrip /> : null}
            </View>
          </Reveal>
        ))}
      </View>
    </Section>
  )
}
