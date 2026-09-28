/**
 * Kahade landing — <LandingSolution>: section "Solusi".
 *
 * Empat pilar yang menjawab keresahan di section Masalah: escrow menahan
 * dana, chat bawaan, etalase sosial, dan mediasi admin saat sengketa.
 * Animasi masuk stagger via <Reveal> (menghormati prefers-reduced-motion).
 */
import { View } from "react-native"
import { ChatCircleText, Handshake, ShieldCheck, Storefront } from "phosphor-react-native"

import { Text } from "@/components/ui/text"
import { Icon, type IconComponent } from "@/components/ui/icon"

import { Reveal } from "./reveal"
import { Section } from "./section"

type Pillar = {
  icon: IconComponent
  title: string
  description: string
  /** Masalah (01–03) yang dijawab pilar ini — jembatan ke section Masalah. */
  answers: string
}

const PILLARS: Pillar[] = [
  {
    icon: ShieldCheck,
    title: "Dana ditahan aman",
    description:
      "Uang pembeli masuk penampungan Kahade dulu. Penjual baru menerima dana setelah pembeli mengonfirmasi barang sampai.",
    answers: "Menjawab 01 · Takut ditipu",
  },
  {
    icon: ChatCircleText,
    title: "Chat langsung di app",
    description:
      "Nego harga, kirim bukti transfer, pantau status kiriman — semua tercatat rapi dalam satu chat, tidak tercecer.",
    answers: "Menjawab 02 · Rekber manual ribet",
  },
  {
    icon: Storefront,
    title: "Etalase sosial",
    description:
      "Jualan semudah posting di media sosial: produk bisa di-like, dikomentari, dan dibagikan ke mana saja.",
    answers: "Bonus · Jualan jadi seru",
  },
  {
    icon: Handshake,
    title: "Sengketa dibantu admin",
    description:
      "Ada masalah? Buka sengketa dari aplikasi — tim Kahade menengahi sampai tuntas, dana dijamin tidak hilang.",
    answers: "Menjawab 03 · Sengketa tanpa penengah",
  },
]

export function LandingSolution() {
  return (
    <Section
      id="solusi"
      eyebrow="Solusi"
      title="Kahade: escrow yang terasa seperti media sosial."
      description="Empat hal yang membuat transaksi di Kahade beda — setiap keresahan di atas punya jawabannya di sini."
    >
      <View className="flex-col gap-4 md:flex-row">
        {PILLARS.map((pillar, index) => (
          <Reveal key={pillar.title} delay={index * 120} className="md:flex-1">
            <View className="h-full rounded-lg border border-border bg-surface-elevated p-6">
              <View className="mb-4 h-12 w-12 items-center justify-center rounded-full bg-surface">
                <Icon icon={pillar.icon} size="md" tone="accent" weight="fill" />
              </View>
              <Text variant="caption" tone="accent" className="mb-2">
                {pillar.answers}
              </Text>
              <Text variant="h3" className="mb-2">
                {pillar.title}
              </Text>
              <Text variant="body" tone="secondary">
                {pillar.description}
              </Text>
            </View>
          </Reveal>
        ))}
      </View>
    </Section>
  )
}
