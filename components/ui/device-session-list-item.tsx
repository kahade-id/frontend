/**
 * Kahade — <DeviceSessionListItem> (§9.17 List Item, §14 Keamanan & Sesi,
 * §3.1 Mono untuk data teknis, §13 format tanggal eksplisit).
 *
 * Baris satu sesi login di halaman "Perangkat & Sesi": IconBox perangkat ->
 * nama perangkat + Badge "Perangkat ini" -> baris meta (browser/OS · lokasi)
 * -> stempel waktu terakhir aktif (Mono) -> tombol "Keluar" di kanan.
 *
 * Kenapa TIDAK dibangun di atas <ListItem> (non-obvious): baris sesi punya
 * TIGA baris teks (nama, meta, waktu) dan dua target sentuh (baris untuk
 * detail, tombol untuk cabut sesi). ListItem membatasi title/subtitle string
 * dan menaruh trailing DI DALAM Pressable baris, sehingga tap "Keluar" ikut
 * memicu onPress baris. Komponen ini menyalin anatomi ListItem (`px-6 py-3
 * gap-3`, divider inset, tanpa scale) — pola yang sama dengan
 * <UserDiscoverResultItem> — dengan tombol sebagai sibling di luar Pressable.
 *
 * Keputusan non-obvious:
 *   - Ikon perangkat dipilih dari `platform` (mobile/tablet/desktop/web) lewat
 *     <IconBox variant="surface" size="md">, bukan <Icon> polos: halaman sesi
 *     berisi 1–5 baris saja, dan kotak ber-border membuat tiap perangkat
 *     terbaca sebagai "objek" yang bisa dicabut. Ikon TETAP monokrom (§7) —
 *     sesi mencurigakan ditandai lewat teks, bukan ikon merah.
 *   - Sesi saat ini (`current`) memakai <Badge tone="neutral" variant="outline">
 *     "Perangkat ini" dan TIDAK punya tombol "Keluar" — keluar dari sesi
 *     sendiri adalah aksi "Logout" di tempat lain, dan menaruhnya di sini
 *     membuat daftar ambigu. Sebagai gantinya, `onRevokeOthers` opsional
 *     diekspos pemanggil di luar list.
 *   - `suspicious` (login dari lokasi/perangkat baru yang belum dikonfirmasi)
 *     menambah <StatusIndicator tone="warning" size="sm"> "Perlu ditinjau"
 *     di baris meta — warning karena "perlu perhatian", bukan danger
 *     "ditolak" (§2.3). Warna hanya di indikator kecil itu; nama perangkat
 *     tetap text-primary agar tidak terkesan seluruh baris error.
 *   - Waktu terakhir aktif adalah string yang SUDAH diformat pemanggil
 *     ("3 Sep 2026, 14:30" — §13, bukan relative time), dirender `monoBody`
 *     text-tertiary seperti timestamp <Timeline>. Untuk sesi saat ini
 *     pemanggil biasanya mengirim `lastActiveLabel` "Aktif sekarang" yang
 *     dirender caption biasa (bukan Mono) karena bukan data teknis.
 *   - Tombol "Keluar" = <Button variant="ghost" size="sm" fullWidth=false>
 *     dengan ikon SignOut — bukan `destructive`: mencabut sesi bersifat
 *     aman/reversibel (pengguna cukup login lagi) dan §9.1 menyediakan
 *     destructive untuk aksi yang menghilangkan data. Pemanggil menampilkan
 *     Dialog konfirmasi bila kebijakan menuntutnya.
 *   - `revoking` menaruh Button dalam state loading (lebar tetap, tombol
 *     disabled) — komponen tetap stateless; pemanggil yang memegang promise.
 *   - Divider inset ml-[76px] = px-6 (24) + IconBox md (40) + gap-3 (12) —
 *     turunan token, konsisten dengan aturan 60/64 di ListItem/Discover.
 *   - Aksesibilitas: baris membaca "nama, perangkat ini, meta, terakhir aktif
 *     …, perlu ditinjau" sebagai satu elemen; tombol "Keluar" berlabel
 *     "Keluar dari {nama perangkat}" agar jelas saat difokuskan terpisah.
 */
import type { ReactNode } from "react"
import { Desktop, DeviceMobile, DeviceTablet, GlobeSimple, Laptop, SignOut } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconBox } from "@/components/ui/icon-box"
import type { IconComponent } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type DevicePlatform = "mobile" | "tablet" | "laptop" | "desktop" | "web"

export type DeviceSessionLabels = {
  current: string
  revoke: string
  suspicious: string
  /** Awalan label a11y untuk tombol: "Keluar dari" */
  revokeFrom: string
}

export type DeviceSessionListItemProps = Omit<ViewProps, "children"> & {
  /** Mis. "iPhone 15 Pro", "Chrome di Windows" */
  deviceName: string
  platform?: DevicePlatform
  /** Override ikon perangkat */
  icon?: IconComponent
  /** Browser / OS / versi app, mis. "Kahade 2.4.1 · iOS 18" */
  client?: string
  /** Lokasi perkiraan, mis. "Jakarta, Indonesia" */
  location?: string
  /** Alamat IP bertopeng atau penuh — dirender Mono */
  ip?: string
  /** Sudah diformat lib/format: "3 Sep 2026, 14:30" (§13) */
  lastActiveAt?: string
  /** Label non-teknis pengganti timestamp, mis. "Aktif sekarang" */
  lastActiveLabel?: string
  /** Sesi perangkat yang sedang dipakai — Badge, tanpa tombol Keluar */
  current?: boolean
  /** Login dari lokasi/perangkat baru yang belum dikonfirmasi */
  suspicious?: boolean
  /** Buka detail sesi (Push §10) */
  onPress?: () => void
  /** Cabut sesi ini; undefined = tombol tidak dirender */
  onRevoke?: () => void
  revoking?: boolean
  disabled?: boolean
  divider?: boolean
  labels?: Partial<DeviceSessionLabels>
  className?: string
}

const PLATFORM_ICON: Record<DevicePlatform, IconComponent> = {
  mobile: DeviceMobile,
  tablet: DeviceTablet,
  laptop: Laptop,
  desktop: Desktop,
  web: GlobeSimple,
}

const DEFAULT_LABELS: DeviceSessionLabels = {
  current: "Perangkat ini",
  revoke: "Keluar",
  suspicious: "Perlu ditinjau",
  revokeFrom: "Keluar dari",
}

export function DeviceSessionListItem({
  deviceName,
  platform = "mobile",
  icon,
  client,
  location,
  ip,
  lastActiveAt,
  lastActiveLabel,
  current = false,
  suspicious = false,
  onPress,
  onRevoke,
  revoking = false,
  disabled = false,
  divider = false,
  labels,
  className,
  ...rest
}: DeviceSessionListItemProps) {
  const t = { ...DEFAULT_LABELS, ...labels }

  const meta: string[] = []
  if (client) meta.push(client)
  if (location) meta.push(location)

  const showRevoke = !!onRevoke && !current

  const row: ReactNode = (
    <View className="min-h-14 flex-1 flex-row items-start gap-3 py-3">
      <IconBox icon={icon ?? PLATFORM_ICON[platform]} size="md" variant="surface" active={current} />

      <View className="flex-1 gap-[2px]">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text variant="body" weight={500} tone={disabled ? "disabled" : "primary"} numberOfLines={1} className="shrink">
            {deviceName}
          </Text>
          {current ? (
            <Badge tone="neutral" variant="outline">
              {t.current}
            </Badge>
          ) : null}
        </View>

        {meta.length > 0 || ip ? (
          <View className="flex-row flex-wrap items-center gap-x-2">
            {meta.length > 0 ? (
              <Text variant="caption" tone={disabled ? "disabled" : "secondary"} numberOfLines={1} className="shrink">
                {meta.join(" \u00B7 ")}
              </Text>
            ) : null}
            {ip ? (
              <Text variant="monoBody" tone="tertiary" numberOfLines={1}>
                {ip}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
          {lastActiveLabel ? (
            <Text variant="caption" weight={500} tone={disabled ? "disabled" : "secondary"}>
              {lastActiveLabel}
            </Text>
          ) : lastActiveAt ? (
            <Text variant="monoBody" tone="tertiary" numberOfLines={1}>
              {lastActiveAt}
            </Text>
          ) : null}
          {suspicious ? <StatusIndicator label={t.suspicious} tone="warning" size="sm" /> : null}
        </View>
      </View>
    </View>
  )

  const a11yLabel = [
    deviceName,
    current ? t.current : null,
    ...meta,
    ip,
    lastActiveLabel ?? lastActiveAt,
    suspicious ? t.suspicious : null,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <View className={cn("w-full", disabled && "opacity-disabled", className)} {...rest}>
      <View className="flex-row items-center gap-3 px-6">
        {onPress ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={a11yLabel}
            accessibilityHint="Buka detail sesi"
            accessibilityState={{ disabled }}
            scaleOnPress={false}
            disabled={disabled}
            onPress={onPress}
            containerClassName="flex-1"
            className="flex-1"
          >
            {row}
          </PressableScale>
        ) : (
          <View accessible accessibilityLabel={a11yLabel} className="flex-1">
            {row}
          </View>
        )}

        {showRevoke ? (
          <Button
            variant="ghost"
            size="sm"
            fullWidth={false}
            leftIcon={SignOut}
            loading={revoking}
            disabled={disabled}
            onPress={onRevoke}
            accessibilityLabel={`${t.revokeFrom} ${deviceName}`}
          >
            {t.revoke}
          </Button>
        ) : null}
      </View>

      {divider ? <View className="ml-[76px] h-px bg-border" /> : null}
    </View>
  )
}
