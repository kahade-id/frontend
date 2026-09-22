/**
 * Kahade — <SelectionBar> header mode pilih (§9.15 Header, pola "pilih beberapa").
 *
 * Saat pengguna menekan lama satu baris/pesan, layar masuk MODE PILIH: header
 * biasa digantikan bar ini — X di kiri, jumlah pilihan, lalu deretan AKSI
 * sebagai ikon BERLABEL di baris kedua. Semua aksi yang tadinya tersembunyi di
 * ActionSheet kini terlihat sekali jalan (permintaan pemilik produk
 * 2026-09-21: "jangan bottomsheet, seperti pilih beberapa di notifikasi,
 * ikonnya ada di header").
 *
 * Kenapa ikon + label, bukan ikon saja:
 *   - Enam aksi (reaksi, pin, salin, teruskan, edit, hapus) tidak bisa
 *     dibedakan dari siluetnya dalam sekali lihat; label caption 12px
 *     menghilangkan tebak-tebakan tanpa menambah tinggi bar secara berarti.
 *   - Baris aksi dapat di-scroll horizontal, jadi jumlah aksi tidak lagi
 *     dibatasi lebar layar (360dp memuat ±5 ubin sebelum mulai menggulir).
 *
 * Keputusan non-obvious:
 *   - Baris judul `h-12` + baris aksi ±52px = ±104px total. Tinggi itu
 *     dibayar hanya selama mode pilih aktif; kembali ke header biasa begitu
 *     X ditekan atau pilihan habis.
 *   - Aksi destruktif memakai ikon + label `danger` (satu-satunya tempat ikon
 *     ikut merah selain menu, mengikuti §7 catatan ActionSheet).
 *   - `border-b border-border` + `bg-background` + `z-sticky` mengikuti §6.2
 *     layer 10; safe-area atas mengikuti pola <Header> (tidak dobel dengan
 *     <Screen edges={["top"]}>).
 *   - Ubin memakai `ripple`: ini permukaan sapuan jari (lihat PressableScale).
 */
import { X } from "phosphor-react-native"
import { useContext, type ReactNode } from "react"
import { ScrollView, View, type ViewProps } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Icon, type IconComponent } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { PressableScale } from "@/components/ui/pressable-scale"
import { ScreenInsetsContext } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { translate } from "@/lib/i18n"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"

export type SelectionAction = {
  key: string
  /** Label pendek (1–2 kata) di bawah ikon */
  label: string
  icon: IconComponent
  tone?: "default" | "danger"
  disabled?: boolean
  /**
   * H-12 (audit 2026-09-22): status TERPILIH untuk aksi yang bersifat toggle
   * (mis. "Pin" yang sudah aktif). Tanpa ini, pembaca layar hanya mendengar
   * label aksi dan pengguna tidak tahu keadaan sekarang — padahal menekannya
   * akan MENGUBAH keadaan itu.
   */
  selected?: boolean
  onPress: () => void
  accessibilityHint?: string
}

/** Baris reaksi cepat (emoji) — pengganti sheet pemilih reaksi. */
export type SelectionQuickReactions = {
  emojis: readonly string[]
  onPick: (emoji: string) => void
}

export type SelectionBarProps = Omit<ViewProps, "children"> & {
  /** Mis. "3 pesan dipilih" */
  title: string
  actions: readonly SelectionAction[]
  onClose: () => void
  closeLabel?: string
  /**
   * Reaksi cepat satu ketukan, dirender di antara judul dan deretan aksi.
   * Hanya masuk akal bila TEPAT SATU item dipilih (reaksi adalah aksi
   * per-item); pemanggil yang memutuskan kapan menampilkannya.
   */
  quickReactions?: SelectionQuickReactions
  /** Node tambahan di kanan judul (mis. tombol "Pilih semua") */
  trailing?: ReactNode
  /** Safe area atas ikut dipadding (default: hanya bila <Screen> tidak melakukannya) */
  safeArea?: boolean
  className?: string
}

export function SelectionBar({
  title,
  actions,
  onClose,
  closeLabel = "Keluar dari mode pilih",
  quickReactions,
  trailing,
  safeArea,
  className,
  ...rest
}: SelectionBarProps) {
  const insets = useSafeAreaInsets()
  const providedInsets = useContext(ScreenInsetsContext)

  return (
    <View
      className={cn("z-sticky w-full items-center border-b border-border bg-background", className)}
      style={(safeArea ?? !providedInsets.top) ? { paddingTop: insets.top } : undefined}
      {...rest}
    >
      <View className="w-full md:max-w-content">
        {/* Baris 1 — tutup + jumlah pilihan */}
        <View className="h-12 w-full flex-row items-center gap-1 px-2">
          <IconButton
            icon={X}
            size="sm"
            variant="ghost"
            ripple
            weight="bold"
            accessibilityLabel={closeLabel}
            onPress={onClose}
          />
          <Text
            ellipsizeMode="tail"
            accessibilityRole="header"
            variant="body"
            weight={600}
            tone="primary"
            numberOfLines={1}
            className="min-w-0 flex-1 px-1"
          >
            {title}
          </Text>
          {trailing}
        </View>

        {/* Baris reaksi cepat — satu ketukan, tanpa sheet pemilih emoji */}
        {quickReactions ? (
          /* Label grup tidak dipasang lewat `accessible`: kontainer itu akan
             menelan tombol emoji di dalamnya dari screen reader (aturan B
             check-a11y). Tiap tombol membawa labelnya sendiri. */
          <View className="flex-row items-center gap-1 px-3 pb-1">
            {quickReactions.emojis.map((emoji) => (
              <PressableScale
                key={emoji}
                accessibilityRole="button"
                // translate(): template literal di atribut JSX tidak terbaca
                // generator katalog i18n, jadi label dinamis wajib dibungkus.
                accessibilityLabel={translate(`Reaksi ${emoji}`)}
                scaleOnPress={false}
                ripple
                onPress={() => quickReactions.onPick(emoji)}
                containerClassName={cn("rounded-full", focusRing)}
                className="h-9 flex-1 items-center justify-center rounded-full"
              >
                <Text variant="h3">{emoji}</Text>
              </PressableScale>
            ))}
          </View>
        ) : null}

        {/* Baris aksi — ubin ikon+label, bisa digulir horizontal */}
        {actions.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="w-full flex-grow-0"
            contentContainerClassName="flex-row items-center gap-1 px-2 pb-2"
          >
            {actions.map((action) => (
              <PressableScale
                key={action.key}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                accessibilityHint={action.accessibilityHint}
                accessibilityState={{ disabled: !!action.disabled, selected: action.selected }}
                disabled={action.disabled}
                scaleOnPress={false}
                ripple
                onPress={action.onPress}
                containerClassName={cn("rounded-sm", focusRing)}
                className="min-w-14 items-center gap-1 rounded-sm px-3 py-1.5"
              >
                <Icon
                  icon={action.icon}
                  size="sm"
                  tone={action.tone === "danger" ? "danger" : "active"}
                  weight={action.tone === "danger" ? "fill" : undefined}
                />
                <Text
                  ellipsizeMode="tail"
                  variant="caption"
                  weight={500}
                  tone={action.tone === "danger" ? "danger" : "secondary"}
                  numberOfLines={1}
                >
                  {action.label}
                </Text>
              </PressableScale>
            ))}
          </ScrollView>
        ) : null}
      </View>
    </View>
  )
}
