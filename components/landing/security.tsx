/**
 * Kahade landing — <LandingSecurity>: strip kepercayaan keamanan.
 *
 * Bahasa AWAM, bukan jargon: tiap pilar menjelaskan "apa artinya buat saya"
 * dalam satu kalimat sehari-hari. Section gelap: empat pilar dalam strip
 * horizontal (wrap di layar kecil), masing-masing ikon + label + satu kalimat.
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
    title: "Data terkunci rapat",
    description: "Data pribadi dan riwayat transaksimu diacak, tidak bisa dibaca pihak lain.",
  },
  {
    icon: LockKey,
    title: "Uang aman di penampungan",
    description: "Uang pembeli ditahan dulu — penjual tidak bisa kabur bawa uang.",
  },
  {
    icon: IdentificationCard,
    title: "Kenali lawan transaksimu",
    description: "Penjual dan pembeli melewati verifikasi identitas sebelum bertransaksi.",
  },
  {
    icon: MagnifyingGlass,
    title: "Diawasi rutin",
    description: "Sistem kami diperiksa keamanannya secara berkala oleh tim internal.",
  },
]

export function LandingSecurity() {
  return (
    <Section
      id="keamanan"
      dark
      eyebrow="Keamanan"
      title="Tenang, semuanya dijaga."
      description="Kamu tidak perlu paham istilah teknisnya — cukup tahu: setiap rupiah dan setiap datamu dilindungi berlapis, dari pembayaran sampai penarikan dana."
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
