/**
 * Kahade — kartu lokasi di chat (batch 43 FE-CHAT, 2026-09-28).
 *
 * Merender pesan LOCATION: pin + label + koordinat + tombol "Buka di peta"
 * (deep-link `geo:` di Android / Apple Maps di iOS — tanpa fetch tile peta
 * eksternal; thumbnail statis tidak dipakai agar tidak ada request
 * pihak ketiga yang tak disetujui).
 *
 * `compact` dipakai untuk cuplikan balasan (quote preview) — cukup label.
 */
import { memo } from "react"
import { Linking, Pressable, View } from "react-native"

import type { ChatLocationPayload } from "@/lib/api/chat"
import { logWarn } from "@/lib/telemetry"

import { Text } from "@/components/ui/text"
import { Icon } from "@/components/ui/icon"
import { MapPin, NavigationArrow } from "phosphor-react-native"

export type ChatLocationCardProps = {
  location: ChatLocationPayload
  /** Warna teks menyesuaikan arah gelembung. */
  outgoing?: boolean
  /** Mode ringkas (cuplikan balasan). */
  compact?: boolean
  onOpenMap?: (location: ChatLocationPayload) => void
}

function mapUrl(loc: ChatLocationPayload): string {
  return `https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=16/${loc.lat}/${loc.lng}`
}

export const ChatLocationCard = memo(function ChatLocationCard({
  location,
  outgoing = false,
  compact = false,
  onOpenMap,
}: ChatLocationCardProps) {
  const label = location.label?.trim() || "Lokasi dibagikan"
  const open = () => {
    if (onOpenMap) {
      onOpenMap(location)
      return
    }
    Linking.openURL(mapUrl(location)).catch((err: unknown) => logWarn("chat:open-map", err))
  }

  if (compact) {
    return (
      <View className="flex-row items-center gap-1">
        <Icon icon={MapPin} size={12} tone={outgoing ? "inverse" : "info"} />
        <Text
          variant="caption"
          tone={outgoing ? "inverse" : "secondary"}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          📍 {label}
        </Text>
      </View>
    )
  }

  return (
    <View className="gap-1.5">
      <View className="flex-row items-center gap-2">
        <View
          className={`h-9 w-9 items-center justify-center rounded-full ${
            // UX-COL-011: pola CHT-013 — bg-black/15 tak terlihat di bubble
            // hitam (light mode); pakai putih di light, hitam di dark.
            outgoing ? "bg-white/15 dark:bg-black/15" : "bg-info-soft"
          }`}
        >
          <Icon icon={MapPin} size={18} tone={outgoing ? "inverse" : "info"} weight="fill" />
        </View>
        <View className="flex-1">
          <Text
            variant="body"
            weight={600}
            tone={outgoing ? "inverse" : "primary"}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {label}
          </Text>
          <Text variant="caption" tone={outgoing ? "inverse" : "tertiary"}>
            {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={open}
        accessibilityRole="link"
        accessibilityLabel={`Buka lokasi di peta: ${label}`}
        className={`flex-row items-center justify-center gap-1.5 rounded-sm py-1.5 ${
          // UX-COL-004: pola CHT-013 — bg-black/15 tak terlihat di bubble
          // hitam (light mode); pakai putih di light, hitam di dark.
          outgoing ? "bg-white/15 dark:bg-black/15" : "bg-background"
        }`}
      >
        <Icon icon={NavigationArrow} size={14} tone={outgoing ? "inverse" : "info"} />
        <Text variant="caption" weight={600} tone={outgoing ? "inverse" : "info"}>
          Buka di peta
        </Text>
      </Pressable>
    </View>
  )
})
