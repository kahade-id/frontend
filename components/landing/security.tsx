/**
 * Kahade landing — <LandingSecurity>: strip kepercayaan keamanan.
 *
 * Section gelap: empat pilar keamanan dalam strip horizontal (wrap di layar
 * kecil), masing-masing ikon + label + satu kalimat. Semua warna lewat
 * class mode-aware (tone "inverse" di atas bg-primary section gelap).
 */
import { View } from "react-native"
import {
  IdentificationCard,
  LockKey,
  MagnifyingGlass,
  ShieldCheck,
} from "phosphor-react-native"

import { Icon, type IconComponent } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"

import { Reveal } from "./reveal"
import { Section } from "./section"

type SecurityItem = {
  icon: IconComponent
  title: string
  description: string
}

const ITEMS: SecurityItem[] = [
  {
    icon: ShieldCheck,
    title: "Enkripsi data",
    description: "Data pribadi & transaksi terenkripsi.",
  },
  {
    icon: LockKey,
    title: "Dana di escrow",
    description: "Dana ditahan aman sampai Anda konfirmasi.",
  },
  {
    icon: IdentificationCard,
    title: "Verifikasi identitas",
    description: "KYC untuk penjual & pembeli.",
  },
  {
    icon: MagnifyingGlass,
    title: "Audit berkala",
    description: "Sistem diaudit & dipantau rutin.",
  },
]

export function LandingSecurity() {
  return (
    <Section
      id="keamanan"
      dark
      eyebrow="Keamanan"
      title="Keamanan setara perbankan."
      description="Setiap rupiah dan setiap data Anda dilindungi berlapis — dari pembayaran sampai penarikan dana."
    >
      <View className="flex-row flex-wrap justify-center gap-4">
        {ITEMS.map((item, index) => (
          <Reveal
            key={item.title}
            delay={index * 80}
            className="w-full sm:w-[calc(50%-8px)] lg:w-[calc(25%-12px)]"
          >
            <View className="items-center gap-3 rounded-md border border-border px-5 py-6">
              <Icon icon={item.icon} size="lg" tone="inverse" />
              <Text variant="label" tone="inverse" className="text-center">
                {item.title}
              </Text>
              <Text variant="caption" tone="inverse" className="text-center">
                {item.description}
              </Text>
            </View>
          </Reveal>
        ))}
      </View>
    </Section>
  )
}
