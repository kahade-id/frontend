/**
 * Kahade — <Timeline> riwayat status vertikal (§9.22 sepupu Stepper, §3.1
 * timestamp Mono, §13 format tanggal eksplisit).
 *
 * dibuat -> dibayar -> dikirim -> selesai, untuk detail escrow & riwayat
 * sengketa.
 *
 * Keputusan non-obvious:
 *   - Tiga status node: "done" (Dot lg fill primary), "current" (lingkaran
 *     16px outline border-focus 1.5px + Dot md di tengah), "upcoming" (Dot lg
 *     outline border-default). Tidak ada warna aksen per langkah — semantic
 *     hanya lewat `tone` untuk kejadian negatif (danger: dibatalkan/sengketa;
 *     warning: menunggu tindakan), sesuai §2.3.
 *   - Node memakai <Dot> agar ukuran (4/8/12px) & tone konsisten dengan
 *     StatusIndicator dan PageIndicator, bukan View ad-hoc.
 *   - Garis penghubung 1px `bg-border` (= Divider); segmen SETELAH node done
 *     berwarna primary agar progres terbaca tanpa membaca label.
 *   - Kolom kiri lebar tetap w-6 (24px = ikon md) sehingga node & garis
 *     sejajar dengan ikon di komponen lain.
 *   - Timestamp = variant `monoBody` (JetBrains Mono, §3.1 "timestamp
 *     teknis"), sudah diformat pemanggil dengan lib/format (§13 — bukan
 *     relative time).
 *   - Tidak ada accessibilityRole "listitem" (bukan role RN yang valid);
 *     container ber-role "list", tiap item `accessible` dengan label
 *     gabungan judul + status.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { Dot, type DotTone } from "@/components/ui/dot"
import { Text, type TextTone } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type TimelineStatus = "done" | "current" | "upcoming"
export type TimelineTone = "neutral" | "danger" | "warning"

export type TimelineItem = {
  id: string
  title: string
  description?: string
  /** Sudah diformat lib/format, mis. "3 Sep 2026, 14:30" */
  timestamp?: string
  status?: TimelineStatus
  tone?: TimelineTone
  /** Konten tambahan di bawah deskripsi (bukti foto, tombol) */
  extra?: ReactNode
}

export type TimelineProps = Omit<ViewProps, "children"> & {
  items: TimelineItem[]
  className?: string
}

const dotTone: Record<TimelineTone, DotTone> = {
  neutral: "primary",
  danger: "danger",
  warning: "warning",
}

const ringBorder: Record<TimelineTone, string> = {
  neutral: "border-border-focus",
  danger: "border-danger",
  warning: "border-warning",
}

const titleTone: Record<TimelineTone, TextTone> = {
  neutral: "primary",
  danger: "danger",
  warning: "warning",
}

const statusLabel: Record<TimelineStatus, string> = {
  done: "selesai",
  current: "sedang berjalan",
  upcoming: "belum dimulai",
}

function Node({ status, tone }: { status: TimelineStatus; tone: TimelineTone }) {
  if (status === "done") return <Dot size="lg" tone={dotTone[tone]} />
  if (status === "current") {
    return (
      <View
        className={cn(
          "h-4 w-4 items-center justify-center rounded-full border-focus bg-background",
          ringBorder[tone],
        )}
      >
        <Dot size="md" tone={dotTone[tone]} />
      </View>
    )
  }
  return <Dot size="lg" tone="outline" className="bg-background" />
}

export function Timeline({ items, className, ...rest }: TimelineProps) {
  return (
    <View accessibilityRole="list" className={cn("w-full", className)} {...rest}>
      {items.map((item, i) => {
        const status = item.status ?? "upcoming"
        const tone = item.tone ?? "neutral"
        const isLast = i === items.length - 1
        const isUpcoming = status === "upcoming"

        return (
          <View
            key={item.id}
            accessible
            accessibilityLabel={`${item.title}, ${statusLabel[status]}${
              item.timestamp ? `, ${item.timestamp}` : ""
            }`}
            className="flex-row gap-3"
          >
            {/* Kolom node + garis */}
            <View className="w-6 items-center">
              <View className="h-5 items-center justify-center">
                <Node status={status} tone={tone} />
              </View>
              {!isLast ? (
                <View className={cn("w-px flex-1", status === "done" ? "bg-primary" : "bg-border")} />
              ) : null}
            </View>

            {/* Konten */}
            <View className={cn("flex-1 gap-1", !isLast && "pb-5")}>
              <View className="flex-row items-start justify-between gap-3">
                <Text
                  variant="body"
                  weight={status === "current" ? 600 : 500}
                  tone={isUpcoming ? "tertiary" : titleTone[tone]}
                  className="flex-1"
                >
                  {item.title}
                </Text>
                {item.timestamp ? (
                  <Text variant="monoBody" tone="tertiary">
                    {item.timestamp}
                  </Text>
                ) : null}
              </View>
              {item.description ? (
                <Text variant="body" tone={isUpcoming ? "tertiary" : "secondary"}>
                  {item.description}
                </Text>
              ) : null}
              {item.extra ? <View className="pt-2">{item.extra}</View> : null}
            </View>
          </View>
        )
      })}
    </View>
  )
}
