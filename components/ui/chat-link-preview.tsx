/**
 * Kahade — kartu pratinjau TAUTAN di bubble teks.
 *
 * URL pertama dari teks pesan → metadata Open Graph (judul, deskripsi, nama
 * situs, gambar) → kartu ketuk-untuk-buka. Cache in-memory per URL
 * (`lib/link-preview.ts`) supaya bubble yang di-recycle FlatList tidak
 * fetch ulang; gagal/404/tanpa metadata → kartu TIDAK tampil sama sekali
 * (pesan tetap bisa dibaca — tautan mentah tetap ada di teks).
 *
 * Kartu ini SATU-SATUNYA tempat chat membuka browser luar (tautan web umum
 * tidak punya viewer in-app) — dan hanya setelah `safeHttpsLink` lolos
 * (check:external-urls). Media/lokasi TIDAK lewat sini.
 */
import { memo, useEffect, useState } from "react"
import { Linking, View } from "react-native"

import { Picture } from "@/components/ui/picture"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { fetchLinkPreview, type LinkPreviewData } from "@/lib/link-preview"
import { safeHttpsLink } from "@/lib/external-url"
import { summarize } from "@/lib/a11y"
import { translate, useLanguage } from "@/lib/i18n"
import { useTheme } from "@/components/theme-provider"
import { tokens } from "@/lib/tokens"
import { logWarn } from "@/lib/telemetry"

export type ChatLinkPreviewProps = {
  url: string
  outgoing?: boolean
}

export const ChatLinkPreview = memo(function ChatLinkPreview({ url, outgoing = false }: ChatLinkPreviewProps) {
  useLanguage()
  const { mode } = useTheme()
  const p = tokens.colors[mode]
  const [preview, setPreview] = useState<LinkPreviewData | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    setPreview(undefined)
    fetchLinkPreview(url).then(
      (data) => {
        if (alive) setPreview(data)
      },
      () => {
        if (alive) setPreview(null)
      },
    )
    return () => {
      alive = false
    }
  }, [url])

  // Gagal/tanpa metadata → sembunyi total (bukan kartu error).
  if (preview === null) return null

  const host = (() => {
    try {
      return new URL(url).host.replace(/^www\./, "")
    } catch {
      return url
    }
  })()

  const open = () => {
    // §external-url: hanya https tervalidasi yang boleh dibuka di browser luar.
    const safe = safeHttpsLink(url)
    if (!safe) return
    Linking.openURL(safe).catch((err: unknown) => logWarn("chat:open-link-preview", err))
  }

  // Pola CHT-013: permukaan translucent mengikuti mode (bukan dark: class).
  const wash = mode === "dark" ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)"

  if (preview === undefined) {
    return (
      <View
        className="w-52 flex-row items-center gap-2 rounded-sm p-2"
        style={{ backgroundColor: outgoing ? wash : p.background }}
      >
        <Skeleton width={52} height={52} />
        <View className="flex-1 gap-1">
          <Skeleton height={12} className="w-[70%]" />
          <Skeleton height={12} className="w-full" />
        </View>
      </View>
    )
  }

  return (
    // PressableScale tidak meneruskan `style` — warna di View pembungkus.
    <View className="w-52 rounded-sm" style={{ backgroundColor: outgoing ? wash : p.background }}>
      <PressableScale
        scaleOnPress={false}
        onPress={open}
        accessibilityRole="link"
        accessibilityLabel={summarize([
          preview.title ?? host,
          preview.siteName ?? undefined,
          translate("Tautan: {x}", { x: host }),
        ])}
        accessibilityHint={translate("Membuka tautan di browser")}
        className="rounded-sm"
      >
      <View className="flex-row items-center gap-2 p-2">
        {preview.image ? (
          <Picture
            source={preview.image}
            alt=""
            aspectRatio={1}
            radius="xs"
            bordered={false}
            recyclingKey={`link:${preview.image}`}
            className="h-[52px] w-[52px]"
          />
        ) : null}
        <View className="min-w-0 flex-1">
          <Text
            variant="caption"
            weight={700}
            tone={outgoing ? "inverse" : "secondary"}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {(preview.siteName ?? host).toUpperCase()}
          </Text>
          {preview.title ? (
            <Text
              variant="body"
              weight={600}
              tone={outgoing ? "inverse" : "primary"}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {preview.title}
            </Text>
          ) : null}
          {preview.description ? (
            <Text variant="caption" tone={outgoing ? "inverse" : "secondary"} numberOfLines={1} ellipsizeMode="tail">
              {preview.description}
            </Text>
          ) : null}
        </View>
      </View>
      </PressableScale>
    </View>
  )
})
