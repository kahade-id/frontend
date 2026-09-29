/**
 * Kahade landing — <LandingHero>: hero web.
 *
 * Eyebrow badge, headline besar, subcopy, CTA ganda ("Download App" dan
 * "Buka Web App"), plus visual premium: gradient mesh (radial-gradient dari
 * warna tokens — bukan hex literal) dan mockup kartu etalase dari View
 * murni (tanpa gambar eksternal). Animasi masuk ditangani <Reveal> yang
 * menghormati prefers-reduced-motion.
 */
import { View } from "react-native"
import { useRouter } from "expo-router"
import {
  ArrowRight,
  ChatCircleText,
  CheckCircle,
  Heart,
  ShareNetwork,
  ShieldCheck,
  Storefront,
} from "phosphor-react-native"

import { Text } from "@/components/ui/text"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"

import { Reveal } from "./reveal"
import { scrollToSection } from "./scroll"

/** Poin kepercayaan ringkas di bawah CTA — faktual, tanpa angka klaim. */
const TRUST_POINTS = [
  "Gratis buat akun",
  "Escrow otomatis",
  "Bantuan admin",
] as const

function ShowcaseMockup() {
  return (
    <View>
      <View
        className="mx-auto w-full max-w-sm overflow-hidden rounded-lg border border-border bg-surface-elevated"
        style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.12)" }}
      >
        {/* Area "foto" produk — gradien dari CSS var mode-aware (--color-*),
            bukan gambar eksternal dan bukan hex literal. */}
        <View className="relative h-48 w-full items-center justify-center bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-primary)_4%,transparent),color-mix(in_srgb,var(--color-primary)_12%,transparent))]">
          <Icon icon={Storefront} size={56} tone="default" />
          <View className="absolute left-3 top-3 flex-row items-center gap-1.5 rounded-full bg-primary px-3 py-1.5">
            <Icon icon={ShieldCheck} size="xs" tone="inverse" weight="fill" />
            <Text variant="label" tone="inverse">
              Dana Aman
            </Text>
          </View>
        </View>

        <View className="p-4">
          <Text variant="caption" tone="secondary">
            Toko Contoh · Jakarta
          </Text>
          <Text variant="h3" className="mt-1">
            Sepatu Sneakers Premium
          </Text>
          <Text variant="monoLarge" tone="accent" className="mt-2">
            Rp 899.000
          </Text>

          <View className="mt-4 flex-row items-center gap-5 border-t border-border pt-3">
            <View className="flex-row items-center gap-1.5">
              <Icon icon={Heart} size="sm" tone="default" />
              <Text variant="caption" tone="secondary">
                1,2 rb
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Icon icon={ChatCircleText} size="sm" tone="default" />
              <Text variant="caption" tone="secondary">
                86
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Icon icon={ShareNetwork} size="sm" tone="default" />
              <Text variant="caption" tone="secondary">
                214
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Chip escrow melayang di bawah mockup */}
      <View className="mx-auto mt-5 w-full max-w-sm flex-row items-center gap-3 rounded-lg border border-border bg-surface-elevated p-4">
        <Icon icon={ShieldCheck} size="md" tone="accent" weight="fill" />
        <View className="flex-1">
          <Text variant="label">Dana ditahan escrow</Text>
          <Text variant="caption" tone="secondary" className="mt-0.5">
            Cair ke penjual setelah barang diterima
          </Text>
        </View>
      </View>

      {/* Cuplikan chat: negosiasi → sepakat → escrow. Menunjukkan sisi
          sosial + aman dalam satu alur yang familier. */}
      <View className="mx-auto mt-4 w-full max-w-sm gap-2 rounded-lg border border-border bg-surface-elevated p-4">
        <View className="self-start rounded-lg rounded-bl-md bg-surface px-3.5 py-2.5">
          <Text variant="body">Deal ya, Rp 850.000 🙏</Text>
        </View>
        <View className="self-end rounded-lg rounded-br-md bg-primary px-3.5 py-2.5">
          <Text variant="body" tone="inverse">
            Deal! Saya buatkan order escrow-nya ya
          </Text>
        </View>
        <View className="mt-1 flex-row items-center justify-center gap-1.5">
          <Icon icon={CheckCircle} size="xs" tone="success" weight="fill" />
          <Text variant="caption" tone="secondary">
            Order escrow dibuat — dana pembeli aman
          </Text>
        </View>
      </View>
    </View>
  )
}

export function LandingHero() {
  const router = useRouter()

  return (
    <View id="hero" className="w-full bg-background">
      {/* Gradient mesh — CSS var mode-aware + color-mix untuk alpha. */}
      <View className="pointer-events-none absolute inset-0 bg-[radial-gradient(720px_480px_at_12%_18%,color-mix(in_srgb,var(--color-primary)_7%,transparent),transparent_70%),radial-gradient(680px_540px_at_88%_82%,color-mix(in_srgb,var(--color-text-secondary)_12%,transparent),transparent_70%)]" />

      <View className="relative mx-auto w-full max-w-6xl flex-col px-5 py-16 md:flex-row md:items-center md:gap-12 md:px-8 md:py-24">
        <View className="flex-1">
          <Reveal>
            <View className="mb-5 self-start rounded-full border border-border bg-surface px-4 py-1.5">
              <Text variant="label" tone="secondary">
                Escrow otomatis · Etalase sosial
              </Text>
            </View>

            <Text variant="display">
              Jual beli online{" "}
              <Text variant="display" tone="accent">
                tanpa takut ditipu.
              </Text>
            </Text>

            <Text variant="bodyLarge" tone="secondary" className="mt-5 max-w-xl">
              Uang pembeli ditahan Kahade sampai barang diterima — penjual pun
              tenang karena dana sudah pasti ada. Jualan dan belanja semudah
              main media sosial.
            </Text>

            <View className="mt-8 flex-col gap-3 md:flex-row">
              <Button
                variant="primary"
                size="md"
                fullWidth={false}
                rightIcon={ArrowRight}
                onPress={() => scrollToSection("download")}
              >
                Mulai Gratis
              </Button>
              <Button
                variant="secondary"
                size="md"
                fullWidth={false}
                onPress={() => router.push("/showcase")}
              >
                Buka Web App
              </Button>
            </View>

            {/* Poin kepercayaan — 3 detik pertama harus menjawab
                "kenapa saya harus percaya". */}
            <View className="mt-6 flex-row flex-wrap gap-x-5 gap-y-2">
              {TRUST_POINTS.map((point) => (
                <View key={point} className="flex-row items-center gap-1.5">
                  <Icon icon={CheckCircle} size="sm" tone="success" weight="fill" />
                  <Text variant="caption" tone="secondary">
                    {point}
                  </Text>
                </View>
              ))}
            </View>
          </Reveal>
        </View>

        <View className="mt-12 flex-1 md:mt-0">
          <Reveal delay={150}>
            <ShowcaseMockup />
          </Reveal>
        </View>
      </View>
    </View>
  )
}
