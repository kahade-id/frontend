/**
 * Kahade — <SecurityLogItem> (§9.17 List Item, §14 Keamanan & Sesi, §2.3
 * semantic eksklusif untuk status, §3.1 Mono, §13 format tanggal eksplisit).
 *
 * Baris satu kejadian di "Aktivitas keamanan": login berhasil/gagal,
 * perubahan kata sandi, 2FA diaktifkan, sesi dicabut, PIN terkunci. Anatomi:
 * IconBox kejadian -> judul + konteks (perangkat · lokasi · IP Mono) ->
 * stempel waktu Mono di kanan -> tautan "Bukan Anda?" opsional.
 *
 * Kenapa TIDAK memakai <Timeline> (non-obvious): Timeline menggambar garis
 * penghubung dan status done/current/upcoming untuk PROSES berurutan
 * (escrow dibuat -> dibayar -> dikirim). Log keamanan adalah daftar kejadian
 * independen yang dipaginasi (FlatList), tanpa "langkah berikutnya"; garis
 * penghubung akan menyiratkan kausalitas yang tidak ada. Karena itu ia
 * mengikuti irama ListItem (`px-6 py-3 gap-3`, divider inset).
 *
 * Keputusan non-obvious:
 *   - Ikon per `kind` ada default-nya (SignIn, Password, ShieldCheck, …) tapi
 *     bisa di-override; SEMUA dirender di <IconBox> yang variannya ditentukan
 *     oleh `outcome`, bukan `kind`: success -> variant "success", failed ->
 *     "danger", blocked -> "warning", info -> "surface". Ini satu-satunya
 *     tempat warna semantik muncul — outcome login memang status (§2.3),
 *     sedangkan jenis kejadian hanyalah kategori (monokrom).
 *   - Judul TIDAK diwarnai mengikuti outcome (tetap text-primary). Di daftar
 *     panjang, teks merah berderet membuat log terasa "alarm" padahal login
 *     gagal sekali itu normal. Kontras cukup datang dari IconBox + Badge.
 *   - Badge outcome (`outcomeLabel`, mis. "Gagal", "Diblokir") hanya dirender
 *     untuk failed/blocked — success adalah default yang tidak perlu
 *     diucapkan, dan info tidak punya outcome.
 *   - Konteks teknis dipisah: perangkat & lokasi dalam satu Text caption
 *     dengan "·", IP di Text `monoBody` terpisah (§3.1: IP/ID = data teknis)
 *     — sama dengan <DeviceSessionListItem> supaya dua layar keamanan
 *     terbaca serupa.
 *   - Timestamp `monoBody` text-secondary rata kanan, string sudah diformat
 *     pemanggil ("3 Sep 2026, 14:30" — §13, tanpa relative time). Ditaruh di
 *     baris judul, bukan di bawah, agar pemindaian vertikal "kapan?" cepat.
 *   - `onReport` ("Bukan Anda?") = <TextLink variant="caption"> di bawah
 *     konteks, hanya untuk kejadian yang bisa disengketakan (login/2FA dari
 *     perangkat baru). Tautan, bukan Button: aksi sekunder yang jarang
 *     ditekan; Button ghost di setiap baris membuat daftar berat. Tautan
 *     berada di LUAR Pressable baris (sibling) agar tap-nya tidak memicu
 *     onPress baris — pola yang sama dengan FollowButton di Discover.
 *     Inset pl-[52px] = IconBox md (40) + gap-3 (12) menyejajarkannya dengan
 *     kolom teks, sehingga terbaca sebagai lanjutan konteks, bukan aksi baris.
 *   - `unread` (kejadian baru sejak terakhir dibuka) memberi bg-surface pada
 *     baris — sama dengan `selected` ListItem — bukan NotificationDot: titik
 *     merah §9.14 khusus untuk ikon tab/avatar.
 *   - Divider inset ml-[76px] = px-6 (24) + IconBox md (40) + gap-3 (12).
 *   - Aksesibilitas: satu label gabungan "judul, hasil, konteks, waktu";
 *     tautan lapor berlabel "Laporkan: bukan Anda?" agar konteksnya jelas
 *     saat difokuskan terpisah dari baris.
 */
import type { ReactNode } from "react"
import {
  DeviceMobile,
  Fingerprint,
  Key,
  LockKey,
  Password,
  ShieldCheck,
  ShieldWarning,
  SignIn,
  SignOut,
} from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Badge, type BadgeTone } from "@/components/ui/badge"
import { IconBox, type IconBoxVariant } from "@/components/ui/icon-box"
import type { IconComponent } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { cn } from "@/lib/cn"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type SecurityLogKind =
  | "login"
  | "logout"
  | "passwordChange"
  | "pinChange"
  | "twoFactorEnabled"
  | "twoFactorDisabled"
  | "biometricEnabled"
  | "sessionRevoked"
  | "newDevice"
  | "lockout"

export type SecurityLogOutcome = "success" | "failed" | "blocked" | "info"

export type SecurityLogLabels = {
  failed: string
  blocked: string
  report: string
  reportA11y: string
}

export type SecurityLogItemProps = Omit<ViewProps, "children"> & {
  /** Judul kejadian, mis. "Login berhasil", "Kata sandi diubah" */
  title: string
  kind?: SecurityLogKind
  /** Override ikon default `kind` */
  icon?: IconComponent
  outcome?: SecurityLogOutcome
  /** Mis. "iPhone 15 Pro · Kahade 2.4.1" */
  device?: string
  /** Mis. "Jakarta, Indonesia" */
  location?: string
  /** IP bertopeng/penuh — dirender Mono */
  ip?: string
  /** Sudah diformat lib/format: "3 Sep 2026, 14:30" (§13) */
  timestamp: string
  /** Kejadian baru sejak terakhir dibuka: bg-surface */
  unread?: boolean
  /** Buka detail kejadian (Push §10) */
  onPress?: () => void
  /** Tampilkan tautan "Bukan Anda?" */
  onReport?: () => void
  /** Konten tambahan di bawah konteks (mis. peta kecil, tombol) */
  extra?: ReactNode
  divider?: boolean
  labels?: Partial<SecurityLogLabels>
  className?: string
}

const KIND_ICON: Record<SecurityLogKind, IconComponent> = {
  login: SignIn,
  logout: SignOut,
  passwordChange: Password,
  pinChange: Key,
  twoFactorEnabled: ShieldCheck,
  twoFactorDisabled: ShieldWarning,
  biometricEnabled: Fingerprint,
  sessionRevoked: SignOut,
  newDevice: DeviceMobile,
  lockout: LockKey,
}

const OUTCOME_BOX: Record<SecurityLogOutcome, IconBoxVariant> = {
  success: "success",
  failed: "danger",
  blocked: "warning",
  info: "surface",
}

const OUTCOME_BADGE: Partial<Record<SecurityLogOutcome, BadgeTone>> = {
  failed: "danger",
  blocked: "warning",
}

const DEFAULT_LABELS: SecurityLogLabels = {
  failed: "Gagal",
  blocked: "Diblokir",
  report: "Bukan Anda?",
  reportA11y: "Laporkan: bukan Anda?",
}

export function SecurityLogItem({
  title,
  kind = "login",
  icon,
  outcome = "info",
  device,
  location,
  ip,
  timestamp,
  unread = false,
  onPress,
  onReport,
  extra,
  divider = false,
  labels,
  className,
  ...rest
}: SecurityLogItemProps) {
  const t = { ...DEFAULT_LABELS, ...labels }

  const context: string[] = []
  if (device) context.push(device)
  if (location) context.push(location)

  const badgeTone = OUTCOME_BADGE[outcome]
  const outcomeLabel = outcome === "failed" ? t.failed : outcome === "blocked" ? t.blocked : undefined

  const row: ReactNode = (
    <View className="min-h-14 flex-1 flex-row items-start gap-3 py-3">
      <IconBox icon={icon ?? KIND_ICON[kind]} size="md" variant={OUTCOME_BOX[outcome]} />

      <View className="flex-1 gap-[2px]">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 flex-row flex-wrap items-center gap-2">
            <Text ellipsizeMode="tail" variant="body" weight={unread ? 600 : 500} tone="primary" numberOfLines={2} className="shrink">
              {title}
            </Text>
            {badgeTone && outcomeLabel ? (
              <Badge tone={badgeTone} variant="soft">
                {outcomeLabel}
              </Badge>
            ) : null}
          </View>
          <Text variant="monoBody" tone="secondary" numberOfLines={1}>
            {timestamp}
          </Text>
        </View>

        {context.length > 0 || ip ? (
          <View className="flex-row flex-wrap items-center gap-x-2">
            {context.length > 0 ? (
              <Text variant="caption" tone="secondary" numberOfLines={1} className="shrink">
                {context.join(" \u00B7 ")}
              </Text>
            ) : null}
            {ip ? (
              <Text variant="monoBody" tone="secondary" numberOfLines={1}>
                {ip}
              </Text>
            ) : null}
          </View>
        ) : null}

        {extra ? <View className="pt-2">{extra}</View> : null}
      </View>
    </View>
  )

  const a11yLabel = [title, outcomeLabel, ...context, ip, timestamp].filter(Boolean).join(", ")

  return (
    <View className={cn("w-full", unread && "bg-surface", className)} {...rest}>
      <View className="px-6">
        {onPress ? (
          <PressableScale hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button"
            accessibilityRole="button"
            accessibilityLabel={a11yLabel}
            accessibilityHint="Buka detail kejadian"
            scaleOnPress={false}
            onPress={onPress}
            containerClassName="w-full"
            className="w-full focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {row}
          </PressableScale>
        ) : (
          <View accessible accessibilityLabel={a11yLabel}>
            {row}
          </View>
        )}

        {onReport ? (
          <View className="flex-row pb-3 pl-[52px]">
            <TextLink variant="caption" weight={500} onPress={onReport} accessibilityLabel={t.reportA11y}>
              {t.report}
            </TextLink>
          </View>
        ) : null}
      </View>

      {divider ? <View className="ml-[76px] h-px bg-border" /> : null}
    </View>
  )
}