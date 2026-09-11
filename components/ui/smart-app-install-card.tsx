/**
 * Kahade — <SmartAppInstallCard>: ajakan unduh aplikasi versi KARTU di
 * Beranda (di bawah kartu saldo), khusus pengunjung web seluler.
 *
 * Menggantikan banner fixed di atas viewport (dihapus per keputusan produk:
 * banner menutupi Header saat baru membuka web). Kartu ini mengikuti alur
 * konten biasa, ikut ter-scroll, dan bisa ditutup — penutupan diingat 7 hari
 * lewat util yang sama dengan banner lama (lib/smart-app-banner).
 *
 * Seperti banner lama: render pertama selalu null lalu visibilitas
 * diputuskan di useEffect agar HTML static-export dan hidrasi identik (tanpa
 * `window` saat SSR). Di native / desktop / mode standalone kartu null.
 */
import { useCallback, useEffect, useState } from "react"
import { Platform, View } from "react-native"
import { GooglePlayLogo, AppleLogo, X } from "phosphor-react-native"

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

export function SmartAppInstallCard() {
  const [os, setOs] = useState<MobileOS | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return
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

  const dismiss = useCallback(() => {
    recordDismiss()
    setVisible(false)
  }, [])

  if (Platform.OS !== "web" || !visible || !os) return null

  // Tanpa accessibilityLabel di root: kartu berisi tombol fokusable
  // (Unduh, Tutup) sehingga dikelompokkan justru menyembunyikannya dari
  // pembaca layar; teks dan tombol dibaca terpisah.
  return (
    <View className="mx-6 mt-3 flex-row items-center gap-3 rounded-md border border-border bg-surface p-4">
      <Logo variant="mark" size="sm" />

      <View className="min-w-0 flex-1 gap-0.5">
        <Text variant="body" weight={600} tone="primary">
          Buka lebih nyaman di aplikasi
        </Text>
        <Text variant="caption" tone="secondary">
          Notifikasi, biometrik, dan pengalaman transaksi yang lebih lengkap.
        </Text>
      </View>

      <View className="items-center gap-1">
        <Button
          size="sm"
          variant="primary"
          accessibilityLabel={`Unduh aplikasi Kahade di ${os === "ios" ? "App Store" : "Google Play"}`}
          // Bukan router.push: keluar dari SPA menuju domain toko.
          onPress={() => {
            window.open(STORE_URLS[os], "_blank", "noopener,noreferrer")
          }}
        >
          Unduh
        </Button>
        <View className="flex-row items-center gap-1">
          {/* Indikator toko sekadar isyarat visual kecil, bukan tombol kedua */}
          {os === "ios" ? <AppleLogo size={12} weight="fill" /> : <GooglePlayLogo size={12} weight="fill" />}
          <Text variant="caption" tone="secondary">
            {os === "ios" ? "App Store" : "Google Play"}
          </Text>
        </View>
      </View>

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
