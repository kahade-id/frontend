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
}

const PILLARS: Pillar[] = [
  {
    icon: ShieldCheck,
    title: "Dana ditahan aman",
    description: "Dana pembeli ditahan di escrow dan baru cair ke penjual setelah barang diterima.",
  },
  {
    icon: ChatCircleText,
    title: "Chat langsung di app",
    description: "Negosiasi, kirim bukti, dan pantau status transaksi lewat chat bawaan.",
  },
  {
    icon: Storefront,
    title: "Etalase sosial",
    description: "Jualan ala media sosial: produk bisa di-like, dikomentari, dan dibagikan.",
  },
  {
    icon: Handshake,
    title: "Sengketa dibantu admin",
    description: "Ada masalah? Admin turun tangan menengahi sampai tuntas.",
  },
]

export function LandingSolution() {
  return (
    <Section
      id="solusi"
      eyebrow="Solusi"
      title="Kahade: escrow yang terasa seperti media sosial."
    >
      <View className="flex-col gap-4 md:flex-row">
        {PILLARS.map((pillar, index) => (
          <Reveal key={pillar.title} delay={index * 120} className="md:flex-1">
            <View className="h-full rounded-2xl border border-border bg-surfaceElevated p-6">
              <View className="mb-4 h-12 w-12 items-center justify-center rounded-full bg-surface">
                <Icon icon={pillar.icon} size="md" tone="accent" weight="fill" />
              </View>
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
