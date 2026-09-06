/**
 * Kahade — <Card> + <CardHeader> / <CardBody> / <CardFooter> (§9.6).
 *
 * Kontainer konten dengan radius `md` (8px — maksimum non-pill §5) dan
 * border 1px. TIDAK ADA shadow: hierarki "naik satu layer" dibentuk dari
 * kombinasi fill + border (§6):
 *   - "default"  : bg-surface (abu sangat muda) + border — card biasa di atas
 *                  background putih.
 *   - "elevated" : bg-surface-elevated (putih) + border — dipakai di layar
 *                  yang background-nya `surface`, sehingga card terlihat
 *                  lebih terang dari sekitarnya (kesan naik).
 *   - "inverted" : Stat/Highlight card — bg-primary + teks primary-foreground.
 *                  Di dark mode IKUT INVERT (fill putih, teks hitam) secara
 *                  otomatis karena token primary sudah invert (§9.6 v1.1).
 *   - "outline"  : transparan + border — untuk card di dalam card.
 *
 * Keputusan non-obvious:
 *   - Padding default 20px (`p-5`, tokens.layout.cardPadding). `padded={false}`
 *     untuk card yang isinya list ber-divider full-bleed; sub-komponen Header/
 *     Body/Footer lalu membawa padding sendiri.
 *   - Card interaktif (`onPress`) memakai PressableScale agar pressed 0.97 (§8)
 *     — kartu transaksi di list adalah kasus utama (shared element ke detail).
 *   - `selected` menaikkan border ke border-focus 1.5px (pola sama dengan
 *     Radio card) — padding dikompensasi `p-[19.5px]` supaya konten tidak
 *     bergeser; nilai arbitrary ini turunan langsung dari token (20 − 0.5).
 *   - Grouping screen reader (audit #4): Card interaktif otomatis satu elemen
 *     karena PressableScale. Card STATIS dengan `accessibilityLabel` kini juga
 *     di-`accessible` — sebelumnya label diam-diam dibuang (tidak diteruskan
 *     ke <View>), sehingga kartu terbaca 5–8 fragmen lepas. Kartu statis yang
 *     PUNYA tombol di dalamnya tidak boleh memakai `accessibilityLabel` di
 *     root (`accessible` akan menelan tombolnya) — pakai <CardSummary>.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { Divider } from "@/components/ui/divider"
import { PressableScale, type PressableScaleProps } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type CardVariant = "default" | "elevated" | "inverted" | "outline"

export type CardProps = Omit<ViewProps, "children"> &
  Pick<PressableScaleProps, "onPress" | "onLongPress" | "accessibilityLabel" | "accessibilityHint"> & {
    children?: ReactNode
    variant?: CardVariant
    /** Padding 20px semua sisi (default true) */
    padded?: boolean
    /** Border tebal border-focus — kartu terpilih */
    selected?: boolean
    disabled?: boolean
    className?: string
  }

const variantClass: Record<CardVariant, string> = {
  default: "bg-surface",
  elevated: "bg-surface-elevated",
  inverted: "bg-primary",
  outline: "bg-transparent",
}

/** Border: inverted memakai warna primary agar tidak ada garis abu di tepi fill hitam */
function borderClass(variant: CardVariant, selected: boolean) {
  if (selected) return "border-focus border-border-focus"
  // audit #088: secondary outline di atas surface harus elevated agar border 3.32:1 terlihat; logic di pemanggil (Screen bg)
  return variant === "inverted" ? "border border-primary" : "border border-border"
}

export function Card({
  children,
  variant = "default",
  padded = true,
  selected = false,
  disabled = false,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  className,
  ...rest
}: CardProps) {
  const box = cn(
    "w-full overflow-hidden rounded-md",
    variantClass[variant],
    borderClass(variant, selected),
    padded && (selected ? "p-[19.5px]" : "p-5"),
    className,
  )

  if (onPress || onLongPress) {
    return (
      <PressableScale hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ selected, disabled }}
        disabled={disabled}
        onPress={onPress}
        onLongPress={onLongPress}
        containerClassName="w-full"
        className={box}
        {...rest}
      >
        {children}
      </PressableScale>
    )
  }

  // Card statis. `accessibilityLabel` HARUS dibarengi `accessible` agar RN
  // benar-benar mengelompokkan subtree jadi satu elemen SR; tanpa itu label
  // diabaikan dan setiap Text di dalamnya dibaca terpisah (audit #4).
  return (
    <View
      accessible={accessibilityLabel ? true : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      className={cn(box, disabled && "opacity-disabled")}
      {...rest}
    >
      {children}
    </View>
  )
}

/**
 * Grup baca untuk BAGIAN informasi di dalam kartu yang punya aksi (audit #4).
 *
 * Kenapa ada: `accessible` pada root kartu menelan seluruh subtree — tombol
 * "Bayar", "Perpanjang", IconButton favorit berhenti bisa difokus screen
 * reader. Jadi kartu beraksi tidak boleh diberi label di root; sebagai
 * gantinya bungkus blok teksnya dengan <CardSummary> supaya bagian informasi
 * tetap terbaca sebagai SATU elemen, sementara tombol tetap fokusable
 * terpisah sesudahnya.
 *
 * ```tsx
 * <Card>
 *   <CardSummary label={summarize([title, statusLabel, amount])}>
 *     ...teks & badge...
 *   </CardSummary>
 *   <Button onPress={onPay}>Bayar</Button>
 * </Card>
 * ```
 */
export function CardSummary({
  label,
  children,
  className,
  ...rest
}: CardSectionProps & { label: string }) {
  return (
    <View accessible accessibilityLabel={label} className={className} {...rest}>
      {children}
    </View>
  )
}

// ------------------------------------------------------------------
// Sub-komponen — dipakai saat Card `padded={false}`
// ------------------------------------------------------------------

export type CardSectionProps = ViewProps & { children?: ReactNode; className?: string }

/** Header: judul H3 + aksi kanan opsional, dipisah divider dari body */
export function CardHeader({
  title,
  subtitle,
  action,
  children,
  divider = true,
  className,
  ...rest
}: CardSectionProps & {
  title?: string
  subtitle?: string
  /** Slot kanan (IconButton, TextLink, Badge) */
  action?: ReactNode
  divider?: boolean
}) {
  return (
    <>
      <View className={cn("flex-row items-center gap-3 px-5 py-4", className)} {...rest}>
        <View className="flex-1 gap-1">
          {title ? (
            <Text ellipsizeMode="tail" variant="h3" tone="primary" numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text variant="caption" tone="secondary" numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
          {children}
        </View>
        {action}
      </View>
      {divider ? <Divider /> : null}
    </>
  )
}

export function CardBody({ children, className, ...rest }: CardSectionProps) {
  return (
    <View className={cn("p-5", className)} {...rest}>
      {children}
    </View>
  )
}

/** Footer: dipisah divider, umumnya untuk CTA sekunder / meta */
export function CardFooter({
  children,
  divider = true,
  className,
  ...rest
}: CardSectionProps & { divider?: boolean }) {
  return (
    <>
      {divider ? <Divider /> : null}
      <View className={cn("flex-row items-center gap-3 px-5 py-4", className)} {...rest}>
        {children}
      </View>
    </>
  )
}