/**
 * Kahade — <GreyCheckBadge> (benefit 2 Kahade+, "centang abu").
 *
 * Centang abu-abu untuk anggota Kahade+ yang KYC-nya lengkap. Syaratnya
 * DIHITUNG BACKEND (`showGreyBadge` dari GET /v1/subscriptions/me) — komponen
 * ini TIDAK menghitung ulang KYC di frontend, hanya membaca nilainya lewat
 * `useKahadePlus()` dan me-render null bila false.
 *
 * Beda dengan <VerifiedSeal> (jangan digabung/diubah): VerifiedSeal adalah
 * seal 3-tier (emas/biru/abu) yang digerakkan `type` badge dari backend dan
 * berlaku untuk profil siapa pun yang dilihat; komponen ini adalah lencana
 * keanggotaan Plus MILIK PENGGUNA SENDIRI (viewer), jadi hanya dipasang di
 * permukaan profil sendiri / area akun sendiri.
 */
import { useState } from "react"
import { Pressable, View } from "react-native"
import { SealCheck } from "phosphor-react-native"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { translate } from "@/lib/i18n/translate"
import { useKahadePlus } from "@/lib/use-kahade-plus"

/** Warna abu identitas — sama dengan tier gray <VerifiedSeal>. */
export const GREY_CHECK_COLOR = "#6B7280"

export type GreyCheckBadgeProps = {
  /** Diameter lingkaran (px). Default 20. */
  size?: number
}

export function GreyCheckBadge({ size = 20 }: GreyCheckBadgeProps) {
  const { showGreyBadge } = useKahadePlus()
  const [open, setOpen] = useState(false)

  if (!showGreyBadge) return null

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={translate("Lencana centang abu-abu Kahade+")}
        accessibilityHint={translate("Lihat keterangan lencana")}
        onPress={() => setOpen(true)}
        hitSlop={8}
      >
        <View
          className="items-center justify-center rounded-full"
          style={{ width: size, height: size, backgroundColor: `${GREY_CHECK_COLOR}1A` }}
        >
          <Icon icon={SealCheck} size={size * 0.75} weight="fill" color={GREY_CHECK_COLOR} />
        </View>
      </Pressable>
      <BottomSheet
        visible={open}
        onRequestClose={() => setOpen(false)}
        title={translate("Centang abu-abu")}
      >
        <View className="gap-2 pb-4">
          <Text variant="body" tone="secondary">
            {translate(
              "Akun ini berlangganan Kahade+ dan telah menyelesaikan verifikasi identitas. Lencana ini dihitung otomatis oleh sistem.",
            )}
          </Text>
        </View>
      </BottomSheet>
    </>
  )
}
