/**
 * Kahade — <SocialLinksEditor> (PUT /v1/users/me/links — mengganti semua).
 *
 * Editor daftar tautan sosial: tiap baris = platform (chip pilihan), URL,
 * label tampilan opsional, tombol naik/turun/hapus. `displayOrder` diisi
 * otomatis dari urutan array saat `onChange` — pemanggil tinggal kirim.
 *
 * Keputusan non-obvious:
 *   - Reorder pakai tombol panah, bukan drag — presisi & aksesibel di web
 *     dan pembaca layar; daftar maksimal pendek (default 6) jadi cukup.
 *   - Validasi URL ringan (harus http/https, atau nomor untuk WhatsApp) di
 *     client hanya sebagai bantuan; server tetap otoritas.
 *   - Ikon platform memakai logo Phosphor monokrom (bukan warna brand) —
 *     konsisten §7; pengecualian warna hanya untuk logo bank.
 */
import {
  ArrowDown,
  ArrowUp,
  FacebookLogo,
  Globe,
  InstagramLogo,
  LinkedinLogo,
  Plus,
  Storefront,
  TelegramLogo,
  TiktokLogo,
  Trash,
  WhatsappLogo,
  XLogo,
  YoutubeLogo,
} from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Button } from "@/components/ui/button"
import { ChipGroup } from "@/components/ui/chip"
import { IconButton } from "@/components/ui/icon-button"
import type { IconComponent } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { mapValue } from "@/lib/has-own"

export type SocialPlatform =
  | "instagram"
  | "tiktok"
  | "x"
  | "facebook"
  | "youtube"
  | "linkedin"
  | "whatsapp"
  | "telegram"
  | "shop"
  | "website"

export type SocialLink = { platform: SocialPlatform | string; url: string; label?: string; displayOrder?: number }

export const SOCIAL_PLATFORM_ICONS: Record<SocialPlatform, IconComponent> = {
  instagram: InstagramLogo,
  tiktok: TiktokLogo,
  x: XLogo,
  facebook: FacebookLogo,
  youtube: YoutubeLogo,
  linkedin: LinkedinLogo,
  whatsapp: WhatsappLogo,
  telegram: TelegramLogo,
  shop: Storefront,
  website: Globe,
}

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
  facebook: "Facebook",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  shop: "Toko online",
  website: "Situs web",
}

/**
 * `platform` dibaca dari tautan tersimpan (PUT/GET /v1/users/me/links) dan
 * tidak divalidasi. `MAP[key] ?? Globe` tidak melindungi dari kunci warisan
 * Object.prototype: `MAP["toString"]` adalah sebuah fungsi, bukan undefined,
 * sehingga `??` diam saja dan <Icon> akan merender fungsi itu sebagai
 * komponen. `mapValue` menutupnya (lihat lib/has-own).
 */
export function socialPlatformIcon(platform: string): IconComponent {
  return mapValue(SOCIAL_PLATFORM_ICONS, platform, Globe)
}

export function validateSocialUrl(platform: string, url: string): boolean {
  const v = url.trim()
  if (!v) return false
  if (platform === "whatsapp") return /^(\+?\d{8,15}|https?:\/\/(wa\.me|api\.whatsapp\.com)\/.+)$/i.test(v)
  return /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v)
}

export type SocialLinksEditorLabels = {
  platform: string
  url: string
  label: string
  add: string
  remove: string
  moveUp: string
  moveDown: string
  invalidUrl: string
  maxReached: (n: number) => string
}

const DEFAULT_LABELS: SocialLinksEditorLabels = {
  platform: "Platform",
  url: "Tautan",
  label: "Label tampilan (opsional)",
  add: "Tambah tautan",
  remove: "Hapus tautan",
  moveUp: "Pindah ke atas",
  moveDown: "Pindah ke bawah",
  invalidUrl: "Tautan harus diawali https://",
  maxReached: (n) => `Maksimal ${n} tautan`,
}

export type SocialLinksEditorProps = Omit<ViewProps, "children"> & {
  value: readonly SocialLink[]
  onChange: (links: SocialLink[]) => void
  platforms?: readonly SocialPlatform[]
  max?: number
  disabled?: boolean
  /** Tampilkan error URL walau field belum disentuh (mis. setelah submit) */
  showErrors?: boolean
  labels?: Partial<SocialLinksEditorLabels>
  className?: string
}

const ALL_PLATFORMS = Object.keys(SOCIAL_PLATFORM_ICONS) as SocialPlatform[]

function withOrder(links: readonly SocialLink[]): SocialLink[] {
  return links.map((l, i) => ({ ...l, displayOrder: i }))
}

export function SocialLinksEditor({
  value,
  onChange,
  platforms = ALL_PLATFORMS,
  max = 6,
  disabled = false,
  showErrors = false,
  labels,
  className,
  ...rest
}: SocialLinksEditorProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const chipOptions = platforms.map((p) => ({
    value: p,
    label: mapValue(SOCIAL_PLATFORM_LABELS, p, p),
    icon: mapValue(SOCIAL_PLATFORM_ICONS, p, Globe),
  }))
  const canAdd = value.length < max && !disabled

  const update = (i: number, patch: Partial<SocialLink>) =>
    onChange(withOrder(value.map((l, idx) => (idx === i ? { ...l, ...patch } : l))))
  const remove = (i: number) => onChange(withOrder(value.filter((_, idx) => idx !== i)))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= value.length) return
    const next = [...value]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(withOrder(next))
  }
  const add = () => canAdd && onChange(withOrder([...value, { platform: platforms[0], url: "", label: "" }]))

  return (
    <View className={cn("w-full gap-4", className)} {...rest}>
      {value.map((link, i) => {
        const invalid = showErrors && !validateSocialUrl(link.platform, link.url)
        return (
          <View key={`${i}-${link.platform}`} className="gap-4 rounded-md border border-border bg-surface-elevated p-5">
            <View className="flex-row items-center justify-between">
              <Text variant="label" tone="secondary">
                {t.platform}
              </Text>
              <View className="flex-row gap-1">
                <IconButton
                  icon={ArrowUp}
                  size="sm"
                  variant="ghost"
                  accessibilityLabel={t.moveUp}
                  disabled={disabled || i === 0}
                  onPress={() => move(i, -1)}
                />
                <IconButton
                  icon={ArrowDown}
                  size="sm"
                  variant="ghost"
                  accessibilityLabel={t.moveDown}
                  disabled={disabled || i === value.length - 1}
                  onPress={() => move(i, 1)}
                />
                <IconButton
                  icon={Trash}
                  size="sm"
                  variant="ghost"
                  accessibilityLabel={t.remove}
                  disabled={disabled}
                  onPress={() => remove(i)}
                />
              </View>
            </View>

            <ChipGroup
              options={chipOptions}
              value={[link.platform]}
              single
              disabled={disabled}
              onChange={(next) => update(i, { platform: next[0] ?? link.platform })}
            />

            <Input
              label={t.url}
              value={link.url}
              onChangeText={(url) => update(i, { url })}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={link.platform === "whatsapp" ? "phone-pad" : "url"}
              leftIcon={socialPlatformIcon(link.platform)}
              errorText={invalid ? t.invalidUrl : undefined}
              disabled={disabled}
            />
            <Input
              label={t.label}
              value={link.label ?? ""}
              onChangeText={(label) => update(i, { label })}
              maxLength={40}
              disabled={disabled}
              reserveHelperSpace={false}
            />
          </View>
        )
      })}

      <Button variant="secondary" leftIcon={Plus} disabled={!canAdd} onPress={add} fullWidth>
        {t.add}
      </Button>
      {value.length >= max ? (
        <Text variant="caption" tone="secondary" className="text-center">
          {t.maxReached(max)}
        </Text>
      ) : null}
    </View>
  )
}
