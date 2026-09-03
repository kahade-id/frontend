/**
 * Timeline — riwayat status vertikal (dibuat → dibayar → dikirim → selesai)
 * untuk detail escrow dan riwayat sengketa (§9 Display, "Activity timeline").
 *
 * Keputusan non-obvious:
 *   - Tiga status node: "done" (fill primary), "current" (outline border-focus
 *     + titik di tengah), "upcoming" (outline border-default). Tidak ada warna
 *     aksen per langkah — status semantik hanya lewat `tone` opsional untuk
 *     kejadian negatif (danger: dibatalkan/sengketa), sesuai §4 warna semantik
 *     dipakai seperlunya.
 *   - Garis penghubung 1px bg-border (bukan 2px) supaya konsisten dengan
 *     Divider dan Stepper; segmen sebelum node "done" berwarna primary agar
 *     progres terbaca tanpa perlu membaca label.
 *   - Layout kolom kiri lebar tetap w-6 (24px) = ukuran ikon md, sehingga
 *     node dan garis sejajar sempurna dengan ikon di komponen lain.
 *   - Timestamp memakai font-mono caption agar kolom waktu rata.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type TimelineStatus = "done" | "current" | "upcoming"
export type TimelineTone = "neutral" | "danger" | "warning"

export type TimelineItem = {
  id: string
  title: string
  description?: string
  /** Sudah diformat, mis. "12 Jan, 14:30" */
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

const nodeToneClass: Record<TimelineTone, { fill: string; border: string }> = {
  neutral: { fill: "bg-primary", border: "border-border-focus" },
  danger: { fill: "bg-danger", border: "border-danger" },
  warning: { fill: "bg-warning", border: "border-warning" },
}

function Node({ status, tone }: { status: TimelineStatus; tone: TimelineTone }) {
  const t = nodeToneClass[tone]
  if (status === "done") {
    return <View className={cn("h-3 w-3 rounded-full", t.fill)} />
  }
  if (status === "current") {
    return (
      <View className={cn("h-4 w-4 items-center justify-center rounded-full border-focus bg-background", t.border)}>
        <View className={cn("h-[6px] w-[6px] rounded-full", t.fill)} />
      </View>
    )
  }
  return <View className="h-3 w-3 rounded-full border border-border bg-background" />
}

export function Timeline({ items, className, ...rest }: TimelineProps) {
  return (
    <View accessibilityRole="list" className={cn("w-full", className)} {...rest}>
      {items.map((item, i) => {
        const status = item.status ?? "upcoming"
        const tone = item.tone ?? "neutral"
        const isLast = i === items.length - 1
        const lineDone = status === "done"
        const isUpcoming = status === "upcoming"

        return (
          <View key={item.id} accessibilityRole="listitem" className="flex-row gap-3">
            {/* Kolom node + garis */}
            <View className="w-6 items-center">
              <View className="h-5 items-center justify-center">
                <Node status={status} tone={tone} />
              </View>
              {!isLast ? <View className={cn("w-px flex-1", lineDone ? "bg-primary" : "bg-border")} /> : null}
            </View>

            {/* Konten */}
            <View className={cn("flex-1 gap-[2px]", !isLast && "pb-5")}>
              <View className="flex-row items-start justify-between gap-3">
                <Text
                  variant="body-md"
                  weight={status === "current" ? "semibold" : "medium"}
                  className={cn(
                    "flex-1",
                    isUpcoming ? "text-text-tertiary" : "text-text-primary",
                    tone === "danger" && !isUpcoming && "text-danger",
                  )}
                >
                  {item.title}
                </Text>
                {item.timestamp ? (
                  <Text variant="caption" className="font-mono text-text-tertiary">
                    {item.timestamp}
                  </Text>
                ) : null}
              </View>
              {item.description ? (
                <Text variant="body-sm" className={isUpcoming ? "text-text-tertiary" : "text-text-secondary"}>
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
