/**
 * Kahade — kartu lokasi di chat (batch 43 FE-CHAT, 2026-09-28).
 *
 * Merender pesan LOCATION: pratinjau peta mini + pin + label + koordinat +
 * tombol "Buka di peta". Sejak Bagian 2 (2026-10): ketuk pratinjau/tombol
 * membuka PETA PENUH IN-APP (`/media-viewer?type=location`) lewat `onOpenMap`
 * — fallback deep-link OSM hanya bila `onOpenMap` tidak dipasang (pemanggil
 * lama). Peta mini adalah SVG deterministik lokal (lihat
 * <ChatMiniMap>) — tanpa fetch tile pihak ketiga.
 *
 * `compact` dipakai untuk cuplikan balasan (quote preview) — cukup label.
 */
import { memo } from "react"
import { Linking, Pressable, View } from "react-native"

import type { ChatLocationPayload } from "@/lib/api/chat"
import { logWarn } from "@/lib/telemetry"

import { Text } from "@/components/ui/text"
import { Icon } from "@/components/ui/icon"
import { ChatMiniMap } from "@/components/ui/chat-mini-map"
import { cn } from "@/lib/cn"
import { translate, useLanguage } from "@/lib/i18n"
import { semantic } from "@/lib/tokens"
import { useTheme } from "@/components/theme-provider"
import { tokens } from "@/lib/tokens"
import { MapPin, NavigationArrow } from "phosphor-react-native"

export type ChatLocationCardProps = {
  location: ChatLocationPayload
  /** Warna teks menyesuaikan arah gelembung. */
  outgoing?: boolean
  /** Mode ringkas (cuplikan balasan). */
  compact?: boolean
  /** Buka peta penuh in-app; tanpa ini → fallback tautan OSM eksternal. */
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
  useLanguage()
  const { mode } = useTheme()
  const p = tokens.colors[mode]
  const label = location.label?.trim() || translate("Lokasi dibagikan")
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

  // Pola CHT-013: bubble keluar = bg-primary (hitam di light, putih di dark),
  // jadi permukaan kartu harus translucent putih/hitam mengikuti mode — inline
  // style + useTheme (bukan class dark:/literal agar lolos check-tokens).
  const outgoingWash = mode === "dark" ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)"
  const outgoingLine = mode === "dark" ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.7)"

  return (
    <View
      className={cn(
        "w-52 gap-1.5 overflow-hidden rounded-sm border",
        outgoing ? "border-transparent" : "border-border",
      )}
      style={
        outgoing
          ? { backgroundColor: outgoingWash, borderColor: outgoingLine }
          : { backgroundColor: p.background }
      }
    >
      {/* Pratinjau peta mini — ketuk → peta penuh in-app. */}
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={translate("Buka lokasi di peta: {x}", { x: label })}
      >
        <ChatMiniMap latitude={location.lat} longitude={location.lng} />
      </Pressable>
      <View className="gap-1.5 p-2 pt-0.5">
        <View className="flex-row items-center gap-2">
          <View
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: outgoing ? outgoingWash : semantic.info[mode].bgSoft }}
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
          accessibilityRole="button"
          accessibilityLabel={translate("Buka lokasi di peta: {x}", { x: label })}
          className="flex-row items-center justify-center gap-1.5 rounded-sm py-1.5"
          style={{ backgroundColor: outgoing ? outgoingWash : p.background }}
        >
          <Icon icon={NavigationArrow} size={14} tone={outgoing ? "inverse" : "info"} />
          <Text variant="caption" weight={600} tone={outgoing ? "inverse" : "info"}>
            {translate("Buka di peta")}
          </Text>
        </Pressable>
      </View>
    </View>
  )
})
