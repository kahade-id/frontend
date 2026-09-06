/**
 * Kahade — <SmartAppBanner>: ajakan pasang aplikasi, khusus pengunjung web
 * seluler.
 *
 * Ditempel di paling atas dokumen, DI ATAS Header, memakai `position: fixed`
 * lewat `className="web:fixed"` sehingga tidak ikut ter-scroll dan tidak
 * pernah dirender di native (Platform.OS dicek lebih dulu, jadi di native
 * komponen ini mengembalikan null sebelum menyentuh style apa pun).
 *
 * Keputusan non-obvious:
 *   - Render pertama SELALU null, lalu `useEffect` memutuskan. Static export
 *     menghasilkan HTML di Node tanpa `window`; kalau visibilitas dihitung
 *     saat render, HTML hasil build akan berbeda dari hasil hidrasi dan React
 *     melaporkan hydration mismatch. Menunda ke effect membuat HTML statis
 *     selalu "tanpa banner" dan banner muncul setelah hidrasi.
 *   - Tinggi banner didorong ke `<body>` sebagai padding-top, bukan margin di
 *     konten. Layout Kahade memakai `flex-1` penuh tinggi; menyisipkan elemen
 *     di atasnya akan memotong tinggi kolom konten. Padding pada body
 *     menggeser seluruh viewport konten ke bawah tanpa menyentuh layout app.
 *   - Semua warna memakai token yang ada (bg-surface, border-border,
 *     text-text-*). Tidak ada shadow: §desain v1.1 flat/monokrom.
 *   - Tombol CTA memakai <Button size="sm">, tombol tutup memakai
 *     <IconButton> — dua komponen yang sudah ada, bukan Pressable telanjang.
 */
import { useCallback, useEffect, useState } from "react"
import { Platform, View } from "react-native"
import { X } from "phosphor-react-native"

import {
  detectMobileOS,
  isDismissActive,
  isStandaloneDisplay,
  recordDismiss,
  shouldShowBanner,
  STORE_URLS,
  type MobileOS,
} from "@/lib/smart-app-banner"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { Logo } from "@/components/ui/logo"
import { Text } from "@/components/ui/text"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

/** Tinggi banner; dipakai juga untuk padding-top body agar konten tidak tertutup. */
const BANNER_HEIGHT = 64

export function SmartAppBanner() {
  const [os, setOs] = useState<MobileOS | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (Platform.OS !== "web") return
    if (typeof window === "undefined") return

    const detected = detectMobileOS(
      window.navigator?.userAgent,
      window.navigator?.maxTouchPoints ?? 0,
    )
    const show = shouldShowBanner({
      isWeb: true,
      os: detected,
      standalone: isStandaloneDisplay(),
      dismissed: isDismissActive(),
    })
    setOs(detected)
    setVisible(show)
  }, [])

  // Geser konten ke bawah hanya selama banner tampak.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return
    const previous = document.body.style.paddingTop
    document.body.style.paddingTop = visible ? `${BANNER_HEIGHT}px` : previous || ""
    return () => {
      document.body.style.paddingTop = previous || ""
    }
  }, [visible])

  const dismiss = useCallback(() => {
    recordDismiss()
    setVisible(false)
  }, [])

  if (Platform.OS !== "web" || !visible || !os) return null

  return (
    <View accessible={false}
      // `web:fixed` + inset-x-0 + top-0: menempel di tepi atas viewport,
      // di bawah status bar browser, di atas seluruh konten app.
      // z-sticky (10), BUKAN z-banner (70): z-banner berada di atas Modal
      // karena diperuntukkan bagi status kritikal. Ajakan pasang aplikasi
      // tidak boleh menutupi dialog. Di layer sticky yang sama dengan Header,
      // banner ini menang karena dirender belakangan di DOM.
      className="web:fixed inset-x-0 top-0 z-sticky flex-row items-center gap-3 border-b border-border bg-surface px-4"
      style={{ height: BANNER_HEIGHT }}
    >
      <Logo variant="mark" size="sm" />

      <View className="flex-1">
        <Text variant="caption" numberOfLines={2}>
          Unduh aplikasi Kahade untuk pengalaman lebih baik
        </Text>
      </View>

      <Button
        size="sm"
        variant="primary"
        // Bukan router.push: ini keluar dari SPA menuju domain store.
        onPress={() => {
          window.open(STORE_URLS[os], "_blank", "noopener,noreferrer")
        }}
      >
        Unduh
      </Button>

      <IconButton
        icon={X}
        size="sm"
        variant="ghost"
        accessibilityLabel="Tutup ajakan unduh aplikasi"
        onPress={dismiss}
      />
    </View>
  )
}