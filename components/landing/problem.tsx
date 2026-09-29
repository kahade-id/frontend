/**
 * Kahade landing — <LandingProblem>: section "Masalah".
 *
 * Tiga kartu keresahan jual beli online yang dijawab Kahade. Animasi masuk
 * stagger via <Reveal> (menghormati prefers-reduced-motion).
 */
import { View } from "react-native"
import { Handshake, Scales, Warning } from "phosphor-react-native"

import { Text } from "@/components/ui/text"
import { Icon, type IconComponent } from "@/components/ui/icon"

import { Reveal } from "./reveal"
import { Section } from "./section"

type Problem = {
  icon: IconComponent
  title: string
  description: string
}

const PROBLEMS: Problem[] = [
  {
    icon: Warning,
    title: "Takut ditipu",
    description:
      "Transfer dulu, barang tak kunjung datang. Chat penjual tiba-tiba hilang — uang ikut melayang.",
  },
  {
    icon: Handshake,
    title: "Escrow manual ribet",
    description:
      "Harus cari admin yang bisa dipercaya, transfer manual, catat mutasi sendiri. Satu transaksi bisa makan waktu berjam-jam.",
  },
  {
    icon: Scales,
    title: "Sengketa tanpa penengah",
    description:
      "Barang datang tidak sesuai foto? Tidak ada pihak netral yang membantu — ujung-ujungnya cuma bisa pasrah.",
  },
]

export function LandingProblem() {
  return (
    <Section
      id="masalah"
      eyebrow="Masalah"
      title="Kenapa jual beli online bikin was-was?"
      description="Tiga keresahan yang hampir semua orang pernah rasakan — atau takutkan."
    >
      <View className="flex-col gap-4 md:flex-row">
        {PROBLEMS.map((problem, index) => (
          <Reveal key={problem.title} delay={index * 120} className="md:flex-1">
            <View className="h-full rounded-lg border border-border bg-surface-elevated p-6">
              <View className="mb-4 flex-row items-center justify-between">
                <View className="h-12 w-12 items-center justify-center rounded-full bg-surface">
                  <Icon icon={problem.icon} size="md" tone="active" />
                </View>
                <Text variant="caption" tone="secondary">
                  0{index + 1}
                </Text>
              </View>
              <Text variant="h3" className="mb-2">
                {problem.title}
              </Text>
              <Text variant="body" tone="secondary">
                {problem.description}
              </Text>
            </View>
          </Reveal>
        ))}
      </View>
      {/* Jembatan emosional ke section Solusi */}
      <Reveal delay={360}>
        <Text variant="bodyLarge" tone="secondary" className="mx-auto mt-10 max-w-xl text-center">
          Kedengarannya familiar? Tenang — setiap masalah di atas{" "}
          <Text variant="bodyLarge" weight={700}>
            ada jawabannya.
          </Text>
        </Text>
      </Reveal>
    </Section>
  )
}
