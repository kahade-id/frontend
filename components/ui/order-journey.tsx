/**
 * Kahade — <OrderJourney> (§9.21 Timeline).
 *
 * Pelacak perjalanan order: Dibuat → Dibayar ke escrow → Dikirim →
 * Diterima → Dana cair. Langkah dihitung oleh `buildOrderJourney`
 * (lib/order-journey.ts) dari data order + riwayat yang sudah ada.
 *
 * Berbeda dari <OrderHistoryTimeline> (log mentah semua transisi status),
 * komponen ini adalah RINGKASAN lima tahap — tiap tahap membawa timestamp
 * kapan terjadi, sehingga user melihat progres sekilas seperti pelacakan
 * e-commerce.
 */
import { View, type ViewProps } from "react-native"
import {
  CheckCircle,
  Circle,
  Coins,
  Handshake,
  Package,
  Receipt,
  Scales,
  ShieldCheck,
  Truck,
  Wallet,
  WarningCircle,
  XCircle,
} from "phosphor-react-native"

import { Icon, type IconComponent, type IconTone } from "@/components/ui/icon"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { formatDate, formatTime, deviceTimeZoneShort } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"
import type { JourneyStep, JourneyStepKey, JourneyStepState, JourneyStepTone } from "@/lib/order-journey"

const STEP_ICONS: Record<JourneyStepKey, IconComponent> = {
  created: Receipt,
  // FE-045: langkah "Konfirmasi penjual" — handshake = kesepakatan dua pihak.
  confirmed: Handshake,
  paid: ShieldCheck,
  shipped: Truck,
  received: Package,
  released: Coins,
  disputed: Scales,
  cancelled: XCircle,
  refunded: Wallet,
  expired: WarningCircle,
}

/** Latar ikon per tone — mengikuti ramp `*-soft` yang dipakai Badge/Alert. */
const ICON_BG: Record<JourneyStepTone, string> = {
  success: "bg-success-soft",
  info: "bg-info-soft",
  neutral: "bg-surface",
  warning: "bg-warning-soft",
  danger: "bg-danger-soft",
}

const STATE_LABEL: Record<JourneyStepState, string> = {
  done: translate("Selesai"),
  current: translate("Berjalan"),
  upcoming: translate("Menunggu"),
  failed: translate("Berhenti"),
}

/**
 * Mega-batch FE-IMP-5 (item 38): timestamp memakai zona waktu PERANGKAT
 * (formatDateTimeLocal) — versi lama meng-hardcode label "WIB" padahal nilai
 * dihitung dari zona perangkat, sehingga pengguna WITA/WIT melihat jam lokal
 * dengan label yang salah.
 */
function formatJourneyTime(iso: string): string {
  // Item 38: cap waktu aktivitas memakai ZONA PERANGKAT — singkatan zona
  // diambil dari Intl perangkat (WIB/WITA/WIT/…), bukan "WIB" yang di-hardcode.
  // Tanpa dukungan Intl → tanpa label (label salah lebih buruk, pola E-05).
  const date = formatDate(iso, { long: true })
  const time = formatTime(iso)
  if (time === "—") return date
  const zone = deviceTimeZoneShort()
  return zone ? `${date} · ${time} ${zone}` : `${date} · ${time}`
}

function StepNode({ step: s }: { step: JourneyStep }) {
  const Glyph = STEP_ICONS[s.key]
  const upcoming = s.state === "upcoming"
  // Ikon Phosphor diwarnai lewat prop `color`/tone wrapper <Icon> — BUKAN
  // className (lihat components/ui/icon.tsx).
  const tone: IconTone = s.tone === "neutral" ? "default" : s.tone
  return (
    <View
      className={cn(
        "h-10 w-10 items-center justify-center rounded-full",
        upcoming ? "bg-surface" : ICON_BG[s.tone],
        upcoming && "border border-border",
      )}
    >
      {upcoming ? (
        <Icon icon={Circle} size={20} />
      ) : s.state === "done" ? (
        <Icon icon={CheckCircle} size={22} weight="fill" tone={tone} />
      ) : (
        <Icon icon={Glyph} size={20} weight="bold" tone={tone} />
      )}
    </View>
  )
}

export type OrderJourneyProps = Omit<ViewProps, "children"> & {
  steps: readonly JourneyStep[]
  title?: string
  className?: string
}

export function OrderJourney({ steps, title, className, ...rest }: OrderJourneyProps) {
  if (steps.length === 0) return null
  // Iterasi de-card 2026-09-27: rel vertikal menyatu dengan alur halaman —
  // tanpa bungkus <Card>. Judul memakai SectionHeader agar ritmenya selaras
  // dengan section polos lain di layar detail order.
  return (
    <View className={cn("gap-4", className)} {...rest}>
      <SectionHeader title={title ?? translate("Perjalanan pesanan")} />
      <View accessibilityRole="list" accessibilityLabel={title ?? translate("Perjalanan pesanan")}>
        {steps.map((s, i) => {
          const isLast = i === steps.length - 1
          const upcoming = s.state === "upcoming"
          const label = [s.label, STATE_LABEL[s.state], s.timestamp ? formatJourneyTime(s.timestamp) : null]
            .filter(Boolean)
            .join(", ")
          return (
            <View key={s.key} accessible accessibilityLabel={label} className="flex-row gap-3">
              {/* Kolom node + konektor */}
              <View className="items-center">
                <StepNode step={s} />
                {!isLast ? (
                  <View
                    className={cn(
                      "w-0.5 flex-1",
                      s.state === "done" ? "bg-success" : "bg-border",
                    )}
                  />
                ) : null}
              </View>
              {/* Konten */}
              <View className={cn("flex-1 gap-0.5", !isLast && "pb-5", "pt-1")}>
                <Text variant="body" weight={s.state === "current" ? 700 : 600} tone={upcoming ? "tertiary" : "primary"}>
                  {s.label}
                </Text>
                {s.hint && s.state === "current" ? (
                  <Text variant="caption" tone="info">
                    {s.hint}
                  </Text>
                ) : null}
                {s.timestamp ? (
                  <Text variant="caption" tone="secondary">
                    {formatJourneyTime(s.timestamp)}
                  </Text>
                ) : s.state === "upcoming" && s.hint ? (
                  <Text variant="caption" tone="tertiary">
                    {s.hint}
                  </Text>
                ) : null}
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}
