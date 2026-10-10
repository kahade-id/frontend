/**
 * Kahade — <ProfileLinks>: tautan sosial di profil publik.
 *
 * Bug yang dilaporkan pengguna: "link di profil tidak muncul padahal punya
 * link". Akar masalah: backend mengirim `links` di GET /v1/users/{username},
 * tetapi frontend tidak pernah membaca (tipe `PublicUserProfile` tanpa
 * `links`) maupun merendernya (tab Tentang hanya kontak & info akun).
 *
 * Dua mode tampilan, satu sumber data (`normalizeProfileLinks`):
 *   - `compact` (di bawah bio, gaya Instagram): maksimal 3 chip
 *     ikon-platform + label/domain, sisanya chip "+N" yang membuka tab
 *     Tentang. Tidak ada teks penjelasan — ikon platform sudah bercerita.
 *   - penuh (tab Tentang): kartu "Tautan" berisi baris ikon + label + domain.
 *
 * Keamanan (sama dengan <BioText>, E04): tautan TIDAK langsung dibuka —
 * dialog konfirmasi menampilkan domain + URL lengkap; hanya https ber-host
 * yang lolos (`safeHttpsLink`), divalidasi ulang tepat sebelum openURL.
 */
import { useCallback, useState } from "react"
import { Linking, Pressable, View } from "react-native"
import { ArrowSquareOut } from "phosphor-react-native"

import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"
import { safeHttpsLink } from "@/lib/external-url"
import {
  PROFILE_LINKS_COMPACT_LIMIT,
  profileLinkDomain,
  profileLinkText,
  type ProfileLink,
} from "@/lib/profile-links"
import { logWarn } from "@/lib/telemetry"

import { Chip } from "@/components/ui/chip"
import { Icon } from "@/components/ui/icon"
import { Dialog } from "@/components/ui/modal"
import { socialPlatformIcon, socialPlatformLabel } from "@/components/ui/social-platforms"
import { Text } from "@/components/ui/text"

export type ProfileLinksProps = {
  links: readonly ProfileLink[]
  /** Baris ringkas di bawah bio (chip, maks 3 + "+N"). Default: daftar penuh. */
  compact?: boolean
  /** Dipanggil saat chip "+N" ditekan (mode compact) — buka tab Tentang. */
  onMore?: () => void
}

/** Label aksesibilitas satu tautan: "Instagram: tokobudi.id". */
function linkA11yLabel(link: ProfileLink): string {
  return translate("{x}: {y}", {
    x: socialPlatformLabel(link.platform),
    y: profileLinkText(link),
  })
}

/**
 * Konfirmasi + buka tautan — dipakai kedua mode. Dialog hidup di sini
 * (bukan per baris) supaya hanya ada satu overlay pada satu waktu (§9.9).
 *
 * Tanpa `useToast`: komponen ini dirender di tab Tentang yang di-test tanpa
 * <ToastProvider>, dan URL sudah lolos `safeHttpsLink` saat normalisasi —
 * kegagalan di sini hanya mungkin dari OS (tidak ada handler), yang cukup
 * dicatat ke telemetri.
 */
function useOpenProfileLink() {
  const [pending, setPending] = useState<ProfileLink | null>(null)
  const open = useCallback(() => {
    const url = pending?.url
    setPending(null)
    // Validasi ulang tepat sebelum openURL (defense-in-depth, pola <BioText>).
    const safe = url ? safeHttpsLink(url) : undefined
    if (!safe) {
      logWarn("profile-links:unsafe-url", { url })
      return
    }
    Linking.openURL(safe).catch((err: unknown) => logWarn("profile-links:open-url", err))
  }, [pending])
  const dialog = (
    <Dialog
      title={translate("Buka tautan luar?")}
      description={translate(
        "Tautan ini mengarah ke situs di luar Kahade. Pastikan Anda percaya sumbernya.",
      )}
      visible={pending !== null}
      confirmLabel={translate("Buka")}
      cancelLabel={translate("Batal")}
      onConfirm={open}
      onCancel={() => setPending(null)}
      onRequestClose={() => setPending(null)}
    >
      {pending ? (
        <View className="gap-1">
          <Text variant="body" weight={700} tone="primary">
            {profileLinkDomain(pending) ?? pending.url}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={3}>
            {pending.url}
          </Text>
        </View>
      ) : null}
    </Dialog>
  )
  return { request: setPending, dialog }
}

export function ProfileLinks({ links, compact = false, onMore }: ProfileLinksProps) {
  // i18n: label platform generik ("Situs web"/"Toko online") & a11y mengikuti bahasa aktif.
  useLanguage()
  const { request, dialog } = useOpenProfileLink()
  if (links.length === 0) return null

  if (compact) {
    const visible = links.slice(0, PROFILE_LINKS_COMPACT_LIMIT)
    const rest = links.length - visible.length
    return (
      <>
        <View className="flex-row flex-wrap items-center gap-2" accessibilityRole="list">
          {visible.map((link) => (
            <Chip
              key={link.platform}
              icon={socialPlatformIcon(link.platform)}
              accessibilityRole="link"
              accessibilityLabel={linkA11yLabel(link)}
              accessibilityHint={translate("Ketuk untuk pratinjau sebelum membuka")}
              onPress={() => request(link)}
            >
              {profileLinkText(link)}
            </Chip>
          ))}
          {rest > 0 ? (
            <Chip
              accessibilityLabel={translate("{x} tautan lainnya", { x: String(rest) })}
              onPress={onMore}
            >
              {`+${rest}`}
            </Chip>
          ) : null}
        </View>
        {dialog}
      </>
    )
  }

  return (
    <>
      <View className="w-full gap-3 rounded-md border border-border bg-surface p-4">
        <Text variant="body" weight={600} tone="primary">
          {translate("Tautan")}
        </Text>
        <View className="gap-1">
          {links.map((link) => {
            const domain = profileLinkDomain(link)
            const text = profileLinkText(link)
            return (
              <Pressable
                key={link.platform}
                accessibilityRole="link"
                accessibilityLabel={linkA11yLabel(link)}
                accessibilityHint={translate("Ketuk untuk pratinjau sebelum membuka")}
                onPress={() => request(link)}
                className="flex-row items-center gap-3 py-2"
              >
                <Icon icon={socialPlatformIcon(link.platform)} size="sm" tone="default" />
                <View className="min-w-0 flex-1">
                  <Text variant="body" tone="primary" numberOfLines={1}>
                    {text}
                  </Text>
                  {domain && domain !== text ? (
                    <Text variant="caption" tone="tertiary" numberOfLines={1}>
                      {domain}
                    </Text>
                  ) : null}
                </View>
                <Icon icon={ArrowSquareOut} size="xs" tone="default" />
              </Pressable>
            )
          })}
        </View>
      </View>
      {dialog}
    </>
  )
}
