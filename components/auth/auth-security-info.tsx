/**
 * Kahade — <AuthSecurityInfo> ikon ⓘ detail keamanan (overhaul auth 2026-10-10).
 *
 * Rumah baru untuk penjelasan yang dulu menjadi paragraf panjang di kaki layar
 * auth (lokasi perangkat, cara kerja kode WhatsApp, apa yang tidak pernah
 * diminta Kahade). Di layar, pengguna hanya melihat satu baris persetujuan
 * (<LegalConsent>) + ikon ini; detail tersedia satu ketukan, bukan memaksa
 * semua orang membaca tiga paragraf sebelum masuk.
 *
 * Keputusan non-obvious:
 *   - Detail dirender di <Dialog>, bukan di halaman terpisah: konteksnya
 *     "kenapa layar ini menanyakan ini", dan pengguna harus bisa menutup lalu
 *     kembali ke form dengan state utuh. Tautan ke Pusat Bantuan tetap ada di
 *     dalam dialog untuk yang ingin membaca lebih panjang.
 *   - `variant` memilih kumpulan poin per konteks layar (masuk vs daftar vs
 *     OTP WhatsApp) supaya tidak ada dialog generik yang menjelaskan hal yang
 *     tidak relevan dengan layar tempatnya muncul.
 *   - Ikon memakai <IconButton variant="ghost" size="sm">: penanda "ada info"
 *     tanpa menambah bobot visual pada baris persetujuan (hierarki §6/§7).
 */
import { useCallback, useState } from "react"
import { Info } from "phosphor-react-native"
import { useRouter } from "expo-router"

import { BulletList } from "@/components/ui/bullet-list"
import { Dialog } from "@/components/ui/modal"
import { IconButton } from "@/components/ui/icon-button"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { VStack } from "@/components/ui/stack"
import { ROUTES } from "@/lib/routes"
import { AUTH_SECURITY_INFO, type AuthSecurityInfoVariant } from "@/lib/auth-security-info"

export type AuthSecurityInfoProps = {
  variant?: AuthSecurityInfoVariant
  /** Label screen reader. Default mengikuti varian. */
  accessibilityLabel?: string
}

export function AuthSecurityInfo({
  variant = "signIn",
  accessibilityLabel,
}: AuthSecurityInfoProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const content = AUTH_SECURITY_INFO[variant]

  const close = useCallback(() => setOpen(false), [])
  const openHelp = useCallback(() => {
    setOpen(false)
    router.push(
      ROUTES.helpArticle(
        "data-yang-dicatat-saat-masuk",
        "akun-keamanan",
        "Data apa yang dicatat saat saya masuk?",
      ),
    )
  }, [router])

  return (
    <>
      <IconButton
        icon={Info}
        size="sm"
        variant="ghost"
        accessibilityLabel={accessibilityLabel ?? content.buttonLabel}
        onPress={() => setOpen(true)}
      />
      <Dialog
        visible={open}
        title={content.title}
        description={content.description}
        confirmLabel="Mengerti"
        hideCancel
        onConfirm={close}
        onCancel={close}
        onRequestClose={close}
      >
        <VStack gap={4}>
          {/* Object.values mempertahankan urutan kunci (lihat docblock
              lib/auth-security-info.ts: object, bukan array, agar katalog
              i18n mengumpulkan setiap poin). */}
          <BulletList variant="body" tone="secondary" items={Object.values(content.points)} />
          <Text variant="caption" tone="secondary" className="text-pretty">
            <TextLink inline variant="caption" weight={500} onPress={openHelp}>
              Baca selengkapnya di Pusat Bantuan
            </TextLink>
          </Text>
        </VStack>
      </Dialog>
    </>
  )
}
