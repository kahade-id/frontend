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
import { ArrowDown, ArrowUp, Plus, Trash } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Button } from "@/components/ui/button"
import { ChipGroup } from "@/components/ui/chip"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import {
  ALL_SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_ICONS,
  SOCIAL_PLATFORM_LABELS,
  socialPlatformIcon,
  socialPlatformLabel,
  type SocialPlatform,
} from "@/components/ui/social-platforms"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { translate, useLanguage } from "@/lib/i18n"
import { isValidSocialLinkInput } from "@/lib/profile-links"

// Katalog platform pindah ke components/ui/social-platforms.ts (dipakai juga
// oleh <ProfileLinks> di profil publik). Re-export menjaga impor lama.
export { SOCIAL_PLATFORM_ICONS, SOCIAL_PLATFORM_LABELS, socialPlatformIcon, type SocialPlatform }

export type SocialLink = { platform: SocialPlatform | string; url: string; label?: string; displayOrder?: number }

/**
 * Validasi klien = aturan backend (`PUT /v1/users/me/links` menolak selain
 * https). Versi lama menerima `http://` dan nomor telepon WhatsApp sehingga
 * simpan selalu gagal 400 untuk input itu. Kini memakai helper bersama
 * `isValidSocialLinkInput` yang menilai hasil SETELAH normalisasi (nomor WA
 * → wa.me, tanpa skema → https://) — sama dengan yang dikirim saat simpan.
 */
export function validateSocialUrl(platform: string, url: string): boolean {
  return isValidSocialLinkInput(platform, url)
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

/** Label bawaan mengikuti bahasa aktif (dulu konstanta modul Indonesia). */
function useDefaultLabels(): SocialLinksEditorLabels {
  useLanguage()
  return {
    platform: translate("Platform"),
    url: translate("Tautan"),
    label: translate("Label tampilan (opsional)"),
    add: translate("Tambah tautan"),
    remove: translate("Hapus tautan"),
    moveUp: translate("Pindah ke atas"),
    moveDown: translate("Pindah ke bawah"),
    invalidUrl: translate("Tautan harus diawali https:// (WhatsApp: nomor HP atau tautan wa.me)"),
    maxReached: (n) => translate("Maksimal {x} tautan", { x: String(n) }),
  }
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

function withOrder(links: readonly SocialLink[]): SocialLink[] {
  return links.map((l, i) => ({ ...l, displayOrder: i }))
}

export function SocialLinksEditor({
  value,
  onChange,
  platforms = ALL_SOCIAL_PLATFORMS,
  max = 6,
  disabled = false,
  showErrors = false,
  labels,
  className,
  ...rest
}: SocialLinksEditorProps) {
  const defaults = useDefaultLabels()
  const t = { ...defaults, ...labels }
  const chipOptions = platforms.map((p) => ({
    value: p,
    label: socialPlatformLabel(p),
    icon: socialPlatformIcon(p),
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