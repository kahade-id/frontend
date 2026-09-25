/**
 * Kahade — <ChatRoomHeader> header ruang obrolan (§9.15 Header, pola WhatsApp).
 *
 * Header chat TIDAK memakai <Header> standar karena judulnya bukan satu baris
 * teks: identitas lawan bicara adalah blok dua baris (nama + status) yang
 * harus duduk tepat di samping foto profil, dan seluruh blok itu adalah target
 * ketuk. Anatomi (2026-09-21, permintaan pemilik produk):
 *
 *   [←] [avatar] Nama lengkap                        [⋮]
 *                ● Online · KHD-2391
 *
 *   - `←`  : kembali (ArrowLeft, sama dengan header layar stack lain).
 *   - avatar 36px + Dot online — wajah adalah penanda percakapan tercepat.
 *   - nama `body` 600 satu baris; di bawahnya status (online / terakhir
 *     dilihat / mengetik…) lalu TITIK TENGAH dan order id ruang. Order id
 *     sengaja tidak dipisah baris: ia metadata, dan titik tengah sudah
 *     cukup memisahkannya dari status tanpa menambah tinggi header.
 *   - `⋮`  : menu ruang (lihat pesanan, cari pesan, bisukan, arsip, …) —
 *     semua aksi sekunder hidup di sana supaya baris header tetap bersih.
 *
 * Keputusan non-obvious:
 *   - Blok identitas pressable → profil publik lawan bicara (bila username
 *     diketahui). Order id punya Pressable SENDIRI (buka detail pesanan):
 *     dua tujuan berbeda tidak boleh berbagi satu target ketuk.
 *   - Tinggi bar tetap `min-h-14` (56px) seperti <Header> supaya perpindahan
 *     antar layar stack tidak mengubah posisi konten di bawahnya.
 *   - `border-b border-border` + `bg-background` + `z-sticky` mengikuti §6.2
 *     layer 10; safe-area atas dibaca dari inset runtime (bukan className).
 *   - Web: konten di-cap `md:max-w-content` (§11) sama seperti <Header>.
 *   - Judul dokumen web di-set dari nama lawan bicara (useDocumentTitle) —
 *     dua tab chat yang terbuka harus bisa dibedakan dari judulnya.
 */
import { ArrowLeft, DotsThreeVertical } from "phosphor-react-native"
import { useContext, type ReactNode } from "react"
import { View, type ViewProps } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { Dot } from "@/components/ui/dot"
import { IconButton } from "@/components/ui/icon-button"
import { PressableScale } from "@/components/ui/pressable-scale"
import { ScreenInsetsContext } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { useDocumentTitle } from "@/components/ui/header"
import { cn } from "@/lib/cn"
import { focusRing, focusRingInset } from "@/lib/focus-ring"
import { TEXT_ROW_HIT_SLOP } from "@/lib/hit-slop"
import { translateProp, useLanguage } from "@/lib/i18n"
import { translate } from "@/lib/i18n/translate"
import { summarize } from "@/lib/a11y"

export type ChatRoomHeaderProps = Omit<ViewProps, "children"> & {
  /** Nama lengkap lawan bicara (fallback: @username / "Percakapan") */
  name?: string
  avatar?: AvatarProps["source"]
  verified?: boolean
  /** Teks status siap render: "Online" / "Terakhir dilihat …" / "mengetik…" */
  status?: string
  /** Dot hijau di depan status */
  online?: boolean
  /** Status "mengetik…" — ditebalkan agar terasa hidup */
  typing?: boolean
  /** Masih memuat ruang: nama belum diketahui */
  loading?: boolean
  /** Order id ringkas (mono) setelah titik tengah — tap membuka detail pesanan */
  orderId?: string
  onOrderPress?: () => void
  /** Tap blok identitas → profil publik lawan bicara */
  onProfilePress?: () => void
  onBack?: () => void
  onMenuPress?: () => void
  /** Aksi tambahan di kiri `⋮` (mis. tombol panggil) */
  extra?: ReactNode
  /** Safe area atas ikut dipadding (default: hanya bila <Screen> tidak melakukannya) */
  safeArea?: boolean
  className?: string
}

/** Diameter avatar header: 36px — cukup dikenali, tidak mendominasi bar 56px. */
const AVATAR_CLASS = "h-9 w-9"

export function ChatRoomHeader({
  name,
  avatar,
  verified = false,
  status,
  online = false,
  typing = false,
  loading = false,
  orderId,
  onOrderPress,
  onProfilePress,
  onBack,
  onMenuPress,
  extra,
  safeArea,
  className,
  ...rest
}: ChatRoomHeaderProps) {
  const insets = useSafeAreaInsets()
  const providedInsets = useContext(ScreenInsetsContext)
  // Nama lawan bicara adalah judul layar ini di web (tab browser).
  useLanguage()
  useDocumentTitle(translateProp(name ?? "Percakapan"))

  const title = name ?? "Percakapan"
  const identity = (
    <View className="min-w-0 flex-row items-center gap-2.5 py-1">
      <View className="relative shrink-0">
        <Avatar
          source={avatar}
          name={title}
          size="md"
          verified={verified}
          className={AVATAR_CLASS}
        />
        {online ? (
          <Dot size="sm" tone="success" ring className="absolute bottom-0 right-0" />
        ) : null}
      </View>

      <View className="min-w-0 flex-1">
        <Text
          ellipsizeMode="tail"
          accessibilityRole="header"
          variant="body"
          weight={600}
          tone="primary"
          numberOfLines={1}
        >
          {loading ? "Memuat…" : title}
        </Text>

        {status || orderId ? (
          <View className="flex-row items-center gap-1">
            {typing ? <Dot size="sm" tone="primary" className="shrink-0" /> : null}
            {status ? (
              <Text
                ellipsizeMode="tail"
                variant="caption"
                tone="secondary"
                weight={typing ? 500 : 400}
                numberOfLines={1}
                className="min-w-0 shrink"
              >
                {status}
              </Text>
            ) : null}
            {orderId ? (
              <>
                {/* Titik tengah pemisah status → order id (§3.1 meta, bukan
                    kalimat baru). Dekoratif: order id punya label a11y sendiri. */}
                <Text
                  variant="caption"
                  tone="secondary"
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                >
                  {"·"}
                </Text>
                {onOrderPress ? (
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={translate("Lihat pesanan {x}", { x: orderId })}
                    scaleOnPress={false}
                    ripple
                    hitSlop={TEXT_ROW_HIT_SLOP}
                    onPress={onOrderPress}
                    containerClassName={cn("shrink-0 rounded-xs", focusRing)}
                  >
                    <Text
                      variant="caption"
                      tone="primary"
                      weight={500}
                      numberOfLines={1}
                      className="shrink-0 font-mono-500"
                    >
                      {orderId}
                    </Text>
                  </PressableScale>
                ) : (
                  <Text
                    variant="caption"
                    tone="secondary"
                    numberOfLines={1}
                    className="shrink-0 font-mono-500"
                  >
                    {orderId}
                  </Text>
                )}
              </>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  )

  return (
    <View
      className={cn(
        "z-sticky w-full items-center border-b border-border bg-background",
        className,
      )}
      // <Screen edges={["top"]}> sudah mempadding inset atas; menambahnya lagi
      // di sini membuat header turun dua kali (pola yang sama dengan <Header>).
      style={(safeArea ?? !providedInsets.top) ? { paddingTop: insets.top } : undefined}
      {...rest}
    >
      <View className="w-full md:max-w-content">
        <View className="min-h-14 w-full flex-row items-center gap-1 px-2 py-1">
          <IconButton
            icon={ArrowLeft}
            size="sm"
            variant="ghost"
            ripple
            accessibilityLabel="Kembali"
            accessibilityHint="Kembali ke layar sebelumnya"
            containerClassName="self-center"
            onPress={onBack}
          />

          {onProfilePress ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={summarize([translate(title), status ? translate(status) : undefined])}
              accessibilityHint="Buka profil lawan bicara"
              scaleOnPress={false}
              ripple
              onPress={onProfilePress}
              containerClassName={cn("min-w-0 flex-1 self-center rounded-sm", focusRingInset)}
            >
              {identity}
            </PressableScale>
          ) : (
            <View
              accessible
              accessibilityLabel={summarize([translate(title), status ? translate(status) : undefined])}
              className="min-w-0 flex-1 self-center"
            >
              {identity}
            </View>
          )}

          {extra}
          <IconButton
            icon={DotsThreeVertical}
            size="sm"
            variant="ghost"
            ripple
            weight="bold"
            accessibilityLabel="Opsi percakapan"
            accessibilityHint="Lihat pesanan, cari pesan, dan pengaturan ruang"
            containerClassName="self-center"
            onPress={onMenuPress}
          />
        </View>
      </View>
    </View>
  )
}
