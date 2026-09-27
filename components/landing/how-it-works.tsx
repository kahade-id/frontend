/**
 * Kahade landing — <LandingHowItWorks>: stepper 5 langkah alur escrow.
 *
 * Mobile: vertikal dengan garis penghubung. Desktop (md:): horizontal 5 kolom.
 * Dua markup terpisah (md:hidden / hidden md:flex) agar garis penghubung
 * selalu sejajar dengan lingkaran nomor di tiap breakpoint.
 */
import { View } from "react-native"

import { Text } from "@/components/ui/text"

import { Reveal } from "./reveal"
import { Section } from "./section"

const STEPS = [
  {
    title: "Bayar ke escrow",
    description: "Pembeli membayar, dana masuk penampungan yang aman.",
  },
  {
    title: "Dana ditahan",
    description: "Penjual melihat dana sudah aman sebelum memproses pesanan.",
  },
  {
    title: "Barang dikirim",
    description: "Penjual mengirim pesanan sesuai kesepakatan.",
  },
  {
    title: "Pembeli konfirmasi",
    description: "Barang diterima dan dicek — sesuai, baru lanjut.",
  },
  {
    title: "Dana cair",
    description: "Dana diteruskan ke dompet penjual, tanpa drama.",
  },
] as const

function StepNumber({ index }: { index: number }) {
  return (
    <View className="h-11 w-11 items-center justify-center rounded-full bg-primary">
      <Text variant="label" tone="inverse">
        {index + 1}
      </Text>
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
                <StepNumber index={i} />
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
        <View className="absolute left-[10%] right-[10%] top-[22px] h-0.5 bg-border" />
        {STEPS.map((step, i) => (
          <Reveal key={step.title} delay={i * 90} className="flex-1">
            <View className="items-center px-3">
              <StepNumber index={i} />
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
    </Section>
  )
}
