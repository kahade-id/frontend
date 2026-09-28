/**
 * Kahade — <BioText> (Batch 139, E04).
 *
 * Bio profil publik dengan tautan yang di-linkify secara aman:
 *   - URL http(s) di bio dirender sebagai tautan yang menampilkan DOMAIN
 *     tujuan (bukan URL mentah yang panjang/menyesatkan);
 *   - ketukan TIDAK langsung membuka — muncul dialog konfirmasi berisi domain
 *     + URL lengkap, pengguna memutuskan sendiri;
 *   - skema non-http (javascript:, data:, dsb.) tidak pernah jadi tautan.
 *
 * Dipakai di profil publik (app/user/[username].tsx). `expanded` mengikuti
 * pola potong bio yang sudah ada (numberOfLines=4 + toggle Selengkapnya).
 */
import { useMemo, useState } from "react"
import { Linking } from "react-native"

import { extractBioSegments } from "@/lib/bio-links"
import { safeHttpsLink } from "@/lib/external-url"
import { translate } from "@/lib/i18n/translate"
import { logWarn } from "@/lib/telemetry"

import { Dialog } from "@/components/ui/modal"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

export type BioTextProps = {
  bio: string
  expanded: boolean
}

export function BioText({ bio, expanded }: BioTextProps) {
  const segments = useMemo(() => extractBioSegments(bio), [bio])
  const [pending, setPending] = useState<{ url: string; domain: string } | null>(null)
  const toast = useToast()

  const openPending = () => {
    const url = pending?.url
    setPending(null)
    // R-1 (audit ronde-2): segmen tautan sudah divalidasi saat ekstraksi,
    // tapi validasi ulang di sini (defense-in-depth) sebelum openURL —
    // menolak URL berkredensial & skema non-https.
    const safe = url ? safeHttpsLink(url) : undefined
    if (safe) {
      Linking.openURL(safe).catch((err: unknown) => logWarn("bio-text:open-url", err))
    } else {
      toast.show({ title: translate("Tautan tidak bisa dibuka"), tone: "danger" })
    }
  }

  return (
    <>
      <Text variant="body" tone="secondary" numberOfLines={expanded ? undefined : 4}>
        {segments.map((seg, i) =>
          seg.kind === "text" ? (
            seg.text
          ) : (
            <Text
              key={`link-${i}`}
              tone="accent"
              onPress={() => setPending({ url: seg.url, domain: seg.domain })}
              accessibilityRole="link"
              accessibilityLabel={translate("Tautan ke {x}", { x: seg.domain })}
              accessibilityHint={translate("Ketuk untuk pratinjau sebelum membuka")}
              style={{ textDecorationLine: "underline" }}
            >
              {seg.domain}
            </Text>
          ),
        )}
      </Text>
      {/*
       * E04: konfirmasi sebelum membuka tautan eksternal. Domain ditonjolkan
       * (identitas situs sebenarnya), URL lengkap ditampilkan agar tidak ada
       * yang disembunyikan — keputusan membuka tetap di tangan pengguna.
       */}
      <Dialog
        title={translate("Buka tautan luar?")}
        description={translate(
          "Tautan ini mengarah ke situs di luar Kahade. Pastikan Anda percaya sumbernya.",
        )}
        visible={pending !== null}
        confirmLabel={translate("Buka tautan")}
        cancelLabel={translate("Batal")}
        onConfirm={openPending}
        onCancel={() => setPending(null)}
        onRequestClose={() => setPending(null)}
      >
        {pending ? (
          <Text variant="body" tone="primary">
            <Text variant="body" weight={700} tone="primary">
              {pending.domain}
            </Text>
            {"\n"}
            <Text variant="caption" tone="secondary" numberOfLines={3} ellipsizeMode="middle">
              {pending.url}
            </Text>
          </Text>
        ) : null}
      </Dialog>
    </>
  )
}
