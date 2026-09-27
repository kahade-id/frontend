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
    description: "Bayar dulu, barang tak kunjung datang.",
  },
  {
    icon: Handshake,
    title: "Rekber manual ribet",
    description: "Cari admin, transfer manual, catat sendiri.",
  },
  {
    icon: Scales,
    title: "Sengketa tanpa penengah",
    description: "Chat penjual hilang, uang ikut melayang.",
  },
]

export function LandingProblem() {
  return (
    <Section
      id="masalah"
      eyebrow="Masalah"
      title="Kenapa jual beli online bikin was-was?"
    >
      <View className="flex-col gap-4 md:flex-row">
        {PROBLEMS.map((problem, index) => (
          <Reveal key={problem.title} delay={index * 120} className="md:flex-1">
            <View className="h-full rounded-2xl border border-border bg-surfaceElevated p-6">
              <View className="mb-4 h-12 w-12 items-center justify-center rounded-full bg-surface">
                <Icon icon={problem.icon} size="md" tone="active" />
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
    </Section>
  )
}
