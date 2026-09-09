/**
 * Kahade — <ListItem> (§9.17 List Item).
 *
 * Baris standar untuk semua daftar: riwayat transaksi, rekening tersimpan,
 * hasil pencarian, menu pengaturan. Anatomi: leading (ikon / avatar / node)
 * → title + subtitle → trailing (teks / Amount / node) → chevron opsional.
 *
 * Keputusan non-obvious:
 *   - Tinggi minimum 56px (`min-h-14`) dengan `py-3`: dua baris teks (body 22
 *     + caption 18) + padding = 56, sekaligus > 44px target sentuh. Baris
 *     satu-teks tetap 56 supaya irama list konsisten.
 *   - Pemisah antar baris = `border-b border-border` lewat `divider` (§6
 *     hierarki border), digambar DI DALAM item supaya FlatList tidak perlu
 *     ItemSeparatorComponent; `inset` menggeser garis sejajar teks (bukan
 *     dari tepi) untuk list dengan leading ikon.
 *   - Interaktif hanya bila `onPress` ada → <PressableScale scaleOnPress=false>:
 *     scale 0.97 pada baris selebar layar terlihat "goyang" dan §8 hanya
 *     menyebut scale untuk Button. Feedback tekan mengandalkan ripple/
 *     highlight bawaan platform; `selected` (bg-surface) untuk state
 *     terpilih yang persisten (mis. rekening tujuan yang dipilih).
 *   - Divider `inset` digambar sebagai View terpisah dengan margin kiri 60px
 *     = px-6 (24) + ikon md (24) + gap-3 (12): turunan token, bukan angka baru.
 *   - Leading ikon memakai <Icon> tone default (text-tertiary, §7) —
 *     bukan IconBox — supaya list padat tetap tenang. Kirim node sendiri
 *     (mis. <Avatar>/<IconBox>) kalau butuh lebih menonjol.
 *   - Trailing string dirender text-secondary body; untuk nominal kirim
 *     <Amount> agar Mono (§3.1).
 *   - Focus ring keyboard (web saja) `focusRingInset` hanya pada varian
 *     interaktif (ada `onPress`): baris lebar penuh, sering di dalam
 *     <ListGroup overflow-hidden> — ring luar akan terpotong. Varian statis
 *     bukan tab stop, jadi tidak diberi ring.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"
import { CaretRight } from "phosphor-react-native"
import { Link, type Href } from "expo-router"

import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale, type PressableScaleProps } from "@/components/ui/pressable-scale"
import { Text, type TextVariant } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
import { focusRingInset } from "@/lib/focus-ring"

function isIconComponent(x: unknown): x is IconComponent {
  return (
    typeof x === "function" || (typeof x === "object" && x !== null && "render" in (x as object))
  )
}

export type ListItemProps = Omit<PressableScaleProps, "children" | "className"> & {
  title: string
  /**
   * Skala tipografi judul (default `body` = 14/22 weight 500).
   *
   * Menu Pengaturan & Keamanan memakai `bodyLarge` (16/26, weight 600):
   * barisnya satu teks tanpa subtitle, jadi judul yang lebih besar adalah
   * satu-satunya penanda hierarki yang tersisa. Varian non-default otomatis
   * mendapat weight 600 supaya ukuran dan tekanan naik bersama.
   */
  titleVariant?: TextVariant
  /**
   * Audit (web a11y): baris yang BERPINDAH LAYAR harus berupa tautan, bukan
   * tombol. Tanpa `href`, baris interaktif dirender sebagai
   * <PressableScale accessibilityRole="button"> — di web tidak ada <a href>
   * sungguhan, jadi tidak bisa ctrl/cmd-klik, klik tengah, atau "buka di tab
   * baru", dan screen reader mengumumkan "tombol" untuk sesuatu yang
   * memindahkan pengguna ke layar lain. Mengirim `href` membungkus baris
   * dengan <Link asChild> (pola yang sama dengan <RouteLink>) sehingga web
   * mendapat elemen <a> dan role-nya otomatis "link".
   *
   * Aditif: call site lama yang hanya mengirim `onPress` tidak berubah.
   */
  href?: Href
  /** Disable row padding when the parent already applies the screen inset. */
  padded?: boolean
  /** Caption text-secondary ATAU node (mis. nomor rekening Mono) — simetris dengan `trailing` */
  /** Caption text-secondary — potong 2 baris agar list tetap 56 tinggi */
  subtitle?: string | ReactNode
  /** Ikon Phosphor (tone default) ATAU node kustom (Avatar, IconBox) */
  leading?: IconComponent | ReactNode
  /** Teks kanan (text-secondary) ATAU node (Amount, Badge, Switch) */
  trailing?: string | ReactNode
  /** CaretRight di ujung kanan — untuk baris yang membuka halaman */
  chevron?: boolean
  divider?: boolean
  /** Divider mulai sejajar teks (melewati kolom leading) */
  inset?: boolean
  selected?: boolean
  /** Judul & subtitle dalam tone danger (mis. "Hapus akun") */
  destructive?: boolean
  titleLines?: number
  className?: string
}

export function ListItem({
  title,
  titleVariant = "body",
  padded = true,
  subtitle,
  leading,
  trailing,
  chevron = false,
  divider = false,
  inset = false,
  selected = false,
  destructive = false,
  titleLines = 1,
  disabled,
  onPress,
  href,
  className,
  containerClassName,
  accessibilityLabel,
  ...rest
}: ListItemProps) {
  const leadingNode = isIconComponent(leading) ? (
    <Icon icon={leading} size="md" tone={destructive ? "danger" : "default"} />
  ) : (
    leading
  )

  const content = (
    <View className={cn("w-full", selected && "bg-surface")}>
      <View
        className={cn(
          "min-h-14 w-full flex-row items-center gap-3 py-3",
          padded && "px-6",
          className,
        )}
      >
        {leadingNode ? <View className="items-center justify-center tabular-nums">{leadingNode}</View> : null}

        <View className="flex-1 gap-0.5">
          <Text ellipsizeMode="tail"
            variant={titleVariant}
            weight={titleVariant === "body" ? 500 : 600}
            tone={destructive ? "danger" : "primary"}
            numberOfLines={titleLines}
          >
            {title}
          </Text>
          {subtitle != null && subtitle !== "" ? (
            typeof subtitle === "string" ? (
              <Text variant="caption" tone={destructive ? "danger" : "secondary"} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : (
              subtitle
            )
          ) : null}
        </View>

        {trailing != null ? (
          typeof trailing === "string" ? (
            <Text variant="body" tone="secondary" numberOfLines={1} className="max-w-[40%]">
              {trailing}
            </Text>
          ) : (
            <View className="items-end justify-center">{trailing}</View>
          )
        ) : null}

        {chevron ? <Icon icon={CaretRight} size="sm" /> : null}
      </View>

      {divider ? (
        <View
          accessibilityRole="none"
          importantForAccessibility="no"
          className="h-px bg-border"
          // Inset turunan (px-4 + IconBox sm + gap-3) diambil dari token, bukan
          // literal 60px: angka itu ikut berubah bila ukuran leading berubah.
          style={{ marginLeft: inset && leadingNode ? tokens.layout.rowDividerInset.listItem : 0 }}
        />
      ) : null}
    </View>
  )

  // Subtitle node tidak bisa dibaca SR dari sini — pemanggil wajib mengirim accessibilityLabel
  const a11yLabel =
    accessibilityLabel ?? summarize([title, typeof subtitle === "string" ? subtitle : undefined])

  // Statis hanya bila TIDAK ada onPress DAN tidak ada href: baris berhref
  // tanpa onPress tetap harus menjadi tautan yang bisa dinavigasi.
  if (!onPress && !href) {
    return (
      <View
        accessible
        accessibilityLabel={a11yLabel}
        className={cn("w-full", containerClassName, disabled && "opacity-disabled")}
      >
        {content}
      </View>
    )
  }

  const row = (
    <PressableScale
      accessibilityRole={href ? "link" : "button"}
      accessibilityLabel={a11yLabel}
      accessibilityState={{ selected, disabled: !!disabled }}
      scaleOnPress={false}
      disabled={disabled}
      onPress={onPress}
      containerClassName={cn("w-full", focusRingInset, containerClassName)}
      {...rest}
    >
      {content}
    </PressableScale>
  )

  return href ? (
    <Link href={href} asChild>
      {row}
    </Link>
  ) : (
    row
  )
}

/** Wrapper opsional: memberi border + radius ke sekumpulan ListItem (§9.6 card list) */
export type ListGroupProps = ViewProps & { children: ReactNode; className?: string }

export function ListGroup({ children, className, ...rest }: ListGroupProps) {
  return (
    <View
      className={cn(
        "w-full overflow-hidden rounded-md border border-border bg-surface-elevated",
        className,
      )}
      {...rest}
    >
      {children}
    </View>
  )
}