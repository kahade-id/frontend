/**
 * Kahade landing — <LandingTestimonials>: 3 kartu testimoni.
 *
 * JUJUR: semua testimoni saat ini adalah CONTOH (badge "Contoh" di tiap
 * kartu + caption "Testimoni asli menyusul."). Ganti dengan data asli
 * setelah ada pengguna sungguhan yang bersedia dikutip.
 */
import { View } from "react-native"
import { Star } from "phosphor-react-native"

import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"

import { Reveal } from "./reveal"
import { Section } from "./section"

const TESTIMONIALS = [
  {
    quote:
      "Baru pertama kali berani jualan online. Dananya ditahan Kahade dulu, jadi saya dan pembeli sama-sama tenang.",
    name: "Rina",
    role: "Penjual preloved — Bandung",
  },
  {
    quote:
      "Nego di chat, bayar lewat escrow, barang datang sesuai foto. Nggak deg-degan seperti transfer langsung.",
    name: "Dimas",
    role: "Pembeli sneakers — Jakarta",
  },
  {
    quote:
      "Order link-nya gampang banget dibagikan ke Instagram. Pembeli tinggal klik, bayar, beres.",
    name: "Sari",
    role: "Penjual handmade — Surabaya",
  },
] as const

function Stars() {
  return (
    <View className="flex-row gap-1">
      {[0, 1, 2, 3, 4].map((i) => (
        <Icon key={i} icon={Star} size="sm" weight="fill" tone="warning" />
      ))}
    </View>
  )
}

export function LandingTestimonials() {
  return (
    <Section
      id="testimoni"
      eyebrow="Testimoni"
      title="Kata mereka yang sudah coba."
    >
      <View className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
        {TESTIMONIALS.map((t, i) => (
          <Reveal key={t.name} delay={i * 90}>
            <View className="rounded-2xl border border-border bg-surface-elevated p-6">
              <View className="mb-4 flex-row items-center justify-between">
                <Stars />
                <View className="rounded-full border border-border px-3 py-1">
                  <Text variant="caption" tone="secondary">
                    Contoh
                  </Text>
                </View>
              </View>
              <Text variant="body">&ldquo;{t.quote}&rdquo;</Text>
              <Text variant="label" className="mt-4">
                {t.name}
              </Text>
              <Text variant="caption" tone="secondary" className="mt-0.5">
                {t.role}
              </Text>
            </View>
          </Reveal>
        ))}
      </View>
      <Reveal delay={270}>
        <Text variant="caption" tone="secondary" className="mt-8 text-center">
          Testimoni asli menyusul.
        </Text>
      </Reveal>
    </Section>
  )
}
