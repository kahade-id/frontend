/**
 * Kahade landing — <LandingHowItWorks>: stepper 5 langkah alur escrow.
 *
 * Mobile: vertikal dengan garis penghubung. Desktop (md:): horizontal 5 kolom.
 * Dua markup terpisah (md:hidden / hidden md:flex) agar garis penghubung
 * selalu sejajar dengan lingkaran nomor di tiap breakpoint.
 */
import { View } from "react-native"
import {
  CreditCard,
  LockKey,
  Package,
  SealCheck,
  Wallet,
} from "phosphor-react-native"

import { Text } from "@/components/ui/text"
import { Icon, type IconComponent } from "@/components/ui/icon"

import { Reveal } from "./reveal"
import { Section } from "./section"

const STEPS: { icon: IconComponent; title: string; description: string }[] = [
  {
    icon: CreditCard,
    title: "Bayar ke escrow",
    description: "Pembeli membayar — dana masuk penampungan aman milik Kahade.",
  },
  {
    icon: LockKey,
    title: "Dana ditahan",
    description: "Penjual melihat dana sudah aman sebelum memproses pesanan.",
  },
  {
    icon: Package,
    title: "Barang dikirim",
    description: "Penjual mengirim pesanan sesuai kesepakatan di chat.",
  },
  {
    icon: SealCheck,
    title: "Pembeli konfirmasi",
    description: "Barang diterima dan dicek — kalau sesuai, baru lanjut.",
  },
  {
    icon: Wallet,
    title: "Dana cair",
    description: "Dana diteruskan ke dompet penjual. Tanpa drama.",
  },
]

function StepNumber({ index, icon }: { index: number; icon: IconComponent }) {
  return (
    <View className="relative h-14 w-14 items-center justify-center rounded-full bg-primary">
      <Icon icon={icon} size="md" tone="inverse" />
      <View className="absolute -bottom-1 -right-1 h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-surface-elevated">
        <Text variant="caption" weight={700}>
          {index + 1}
        </Text>
      </View>
    </View>
  )
}

export function LandingHowItWorks() {
  return (
    <Section
      id="cara-kerja"
      eyebrow="Cara Kerja"
      title="Lima langkah, dana selalu aman."
      description="Setiap transaksi dilindungi escrow: uang pembeli ditahan dulu, baru diteruskan ke penjual setelah barang dikonfirmasi."
    >
      {/* Mobile: stepper vertikal */}
      <View className="flex-col md:hidden">
        {STEPS.map((step, i) => (
          <Reveal key={step.title} delay={i * 90}>
            <View className="flex-row">
              <View className="items-center">
                <StepNumber index={i} icon={step.icon} />
                {i < STEPS.length - 1 ? (
                  <View className="my-2 w-0.5 min-h-8 flex-1 bg-border" />
                ) : null}
              </View>
              <View className="ml-4 flex-1 pb-8">
                <Text variant="h3">{step.title}</Text>
                <Text variant="body" tone="secondary" className="mt-1">
                  {step.description}
                </Text>
              </View>
            </View>
          </Reveal>
        ))}
      </View>

      {/* Desktop: stepper horizontal */}
      <View className="relative hidden md:flex md:flex-row">
        {/* Garis penghubung di belakang lingkaran (pusat kolom pertama → terakhir) */}
        <View className="absolute left-[10%] right-[10%] top-[28px] h-0.5 bg-border" />
        {STEPS.map((step, i) => (
          <Reveal key={step.title} delay={i * 90} className="flex-1">
            <View className="items-center px-3">
              <StepNumber index={i} icon={step.icon} />
              <Text variant="h3" className="mt-4 text-center">
                {step.title}
              </Text>
              <Text variant="body" tone="secondary" className="mt-1 text-center">
                {step.description}
              </Text>
            </View>
          </Reveal>
        ))}
      </View>
      {/* Penutup: status terpantau di setiap langkah */}
      <Reveal delay={450}>
        <Text variant="body" tone="secondary" className="mx-auto mt-10 max-w-xl text-center">
          Di setiap langkah, kamu bisa memantau status transaksi dan chat dengan
          lawan transaksimu — tidak ada yang berjalan dalam gelap.
        </Text>
      </Reveal>
    </Section>
  )
}
