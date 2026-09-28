/**
 * Kahade — meta pesan dukungan (batch 139, item F16).
 *
 * Baris kecil di bawah/di atas gelembung pesan tiket & live support:
 * - Badge peran pengirim: "Anda" (user) · "Asisten Otomatis" (bot) ·
 *   "Tim Kahade" (agen).
 * - Stempel waktu relatif ("5 menit lalu") yang bisa DIKETUK untuk membuka
 *   waktu absolut ("28 Sep 2026, 14:05"), dan sebaliknya.
 */
import { useState } from "react"
import { View } from "react-native"

import {
  supportMessageAbsoluteTime,
  supportMessageRelativeTime,
  supportRoleLabel,
  type SupportSenderRole,
} from "@/lib/support-message-meta"
import { Badge } from "@/components/ui/badge"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"

export function SupportMessageMeta({
  role,
  createdAt,
  align = "start",
}: {
  role: SupportSenderRole
  /** ISO string / epoch — waktu pesan dibuat. */
  createdAt: string | number
  align?: "start" | "end"
}) {
  const [absolute, setAbsolute] = useState(false)
  const label = absolute
    ? supportMessageAbsoluteTime(createdAt)
    : supportMessageRelativeTime(createdAt)
  return (
    <View
      className={`flex-row items-center gap-2 ${align === "end" ? "justify-end" : "justify-start"}`}
    >
      <Badge tone={role === "user" ? "neutral" : role === "bot" ? "info" : "success"} variant="soft">
        {supportRoleLabel(role)}
      </Badge>
      <PressableScale
        scaleOnPress={false}
        onPress={() => setAbsolute((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={
          absolute ? "Tampilkan waktu relatif" : `Waktu absolut: ${supportMessageAbsoluteTime(createdAt)}`
        }
        accessibilityHint="Ketuk untuk beralih antara waktu relatif dan absolut"
      >
        <Text variant="caption" tone="secondary" style={{ textDecorationLine: "underline", textDecorationStyle: "dotted" }}>
          {label}
        </Text>
      </PressableScale>
    </View>
  )
}
