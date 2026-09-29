/**
 * Kahade — <QRCodeDisplay> (§2.1 brand hitam-putih, §5 radius, §6 border,
 * §3.1 Mono untuk kode di bawah QR, §9.11 feedback lewat Banner).
 *
 * Menampilkan QR untuk: link pembayaran/order, QRIS (di masa depan), kode
 * undang teman, profil publik. Dipindai kamera orang lain — jadi prioritas
 * utama adalah KETERBACAAN oleh scanner, bukan estetika.
 *
 * Keputusan non-obvious:
 *   - Encode dengan inti `qrcode` (`create` dari `qrcode/lib/core/qrcode`,
 *     ST-008) dan render modul sebagai SATU <Path> react-native-svg (bukan ribuan
 *     <Rect>): QR versi 10 punya 57x57 = 3249 modul; satu path string
 *     jauh lebih ringan untuk bridge/DOM daripada 3249 elemen.
 *   - Warna modul SELALU hitam murni di atas putih murni (`brand.black` /
 *     `brand.white` dari tokens), TIDAK ikut dark mode: scanner mengandalkan
 *     kontras; QR putih-di-hitam (inverted) gagal dibaca banyak kamera
 *     lama. Karena itu di dark mode QR tampil dalam "kartu putih" dengan
 *     border — ini satu-satunya komponen yang sengaja memakai brand.white
 *     langsung, dan alasannya teknis, bukan visual.
 *   - Quiet zone (margin 4 modul, standar ISO 18004) dipertahankan sebagai
 *     padding putih di dalam kartu — jangan diganti padding class abu.
 *   - Error correction default "M" (15%): cukup untuk QR yang dipindai dari
 *     layar (bukan cetak lusuh). "H" dipakai otomatis bila `logo` diberikan,
 *     karena logo menutupi ~10% modul tengah.
 *   - Logo di tengah opsional: kotak putih `rounded-xs` di tengah dengan
 *     <Picture> di dalamnya; ukuran dibatasi 20% sisi QR agar tetap di bawah
 *     toleransi "H" (30%).
 *   - Kode teks (`caption`) di bawah dirender `monoBody` + tombol salin
 *     lewat <CopyableField>: orang yang tidak bisa memindai (mis. link
 *     dibuka di HP yang sama) tetap bisa menyalin nilainya. Ini juga
 *     alternatif aksesibilitas — QR sendiri `accessibilityRole="image"`
 *     dengan label yang menyebut isi ringkas.
 *   - `size` default 200px; minimum yang disarankan 160 untuk QR versi < 6
 *     di layar 360px. Tidak ada responsive `w-full`: QR harus tetap persegi
 *     dengan modul integer-ish agar tajam; pemanggil yang menentukan ukuran.
 *   - Encode gagal (data terlalu panjang) -> fallback kotak abu dengan ikon
 *     QrCode text-tertiary + pesan; tidak melempar error ke render tree.
 *   - Tidak ada animasi/gradient/rounded-dots pada modul (§1 flat, presisi):
 *     modul bulat menurunkan keterbacaan scanner murah.
 */
// PERF-FIX (bundle, 2026-09-30): inti qrcode dimuat LAZY — dievaluasi hanya
// saat komponen pertama kali di-mount, bukan saat modul ini dievaluasi.
// (ST-008 2026-09-29 sudah memangkas dari entry utama ke
// `qrcode/lib/core/qrcode`; ini menunda evaluasinya sepenuhnya.)
// Selama inti dimuat, tampil skeleton netral — BUKAN pesan error
// "Data terlalu panjang" (itu hanya untuk encode yang benar-benar gagal).
import type { create as createQrCodeType } from "qrcode/lib/core/qrcode"
import { QrCode } from "phosphor-react-native"
import { useEffect, useMemo, useState } from "react"
import { View, type ViewProps } from "react-native"
import Svg, { Path, Rect } from "react-native-svg"

import { CopyableField } from "@/components/ui/copyable-field"
import { Icon } from "@/components/ui/icon"
import { Picture, type PictureProps } from "@/components/ui/picture"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
import { translate } from "@/lib/i18n/translate"

export type QRErrorCorrection = "L" | "M" | "Q" | "H"

export type QRCodeDisplayProps = Omit<ViewProps, "children"> & {
  /** Isi QR (URL, payload) */
  value: string
  /** Sisi QR dalam px (default 200) */
  size?: number
  errorCorrection?: QRErrorCorrection
  /** Logo kecil di tengah (otomatis EC "H") */
  logo?: PictureProps["source"]
  /** Judul di atas QR, mis. "Tunjukkan ke penjual" */
  title?: string
  /** Teks di bawah: default = value; kirim "" untuk menyembunyikan */
  caption?: string
  /** Tampilkan kotak salin di bawah QR (default true bila onCopy ada) */
  onCopy?: (value: string) => void
  copied?: boolean
  /** Label a11y ringkas isi QR, mis. "Kode QR link pembayaran order #123" */
  accessibilityLabel?: string
  className?: string
}

const QUIET_ZONE = 4
const LOGO_RATIO = 0.2

type QrCoreModule = typeof import("qrcode/lib/core/qrcode")
let qrCorePromise: Promise<QrCoreModule> | null = null
function loadQrCore(): Promise<QrCoreModule> {
  if (!qrCorePromise) qrCorePromise = import("qrcode/lib/core/qrcode")
  return qrCorePromise
}

function buildModulesPath(data: Uint8Array, count: number, scale: number, offset: number): string {
  // Gabungkan modul horizontal berurutan jadi satu rect per run — path lebih pendek.
  let d = ""
  for (let r = 0; r < count; r++) {
    let c = 0
    while (c < count) {
      if (data[r * count + c]) {
        let run = 1
        while (c + run < count && data[r * count + c + run]) run++
        const x = offset + c * scale
        const y = offset + r * scale
        d += `M${x} ${y}h${run * scale}v${scale}h${-run * scale}z`
        c += run
      } else {
        c++
      }
    }
  }
  return d
}

export function QRCodeDisplay({
  value,
  size = 200,
  errorCorrection,
  logo,
  title,
  caption,
  onCopy,
  copied,
  accessibilityLabel,
  className,
  ...rest
}: QRCodeDisplayProps) {
  const ec: QRErrorCorrection = errorCorrection ?? (logo ? "H" : "M")

  // PERF-FIX (bundle): inti qrcode dimuat saat mount, bukan saat evaluasi modul.
  const [createQrCode, setCreateQrCode] = useState<typeof createQrCodeType | null>(null)
  useEffect(() => {
    let alive = true
    loadQrCore()
      .then((m) => {
        if (alive) setCreateQrCode(() => m.create)
      })
      .catch(() => {
        // Import gagal: encoded di bawah jatuh ke status error seperti
        // encode gagal (tidak melempar ke render tree).
      })
    return () => {
      alive = false
    }
  }, [])

  const encoded = useMemo(() => {
    if (!createQrCode) return { path: "", ok: false as const, loading: true as const }
    try {
      const qr = createQrCode(value, { errorCorrectionLevel: ec })
      const count = qr.modules.size
      const scale = size / (count + QUIET_ZONE * 2)
      const offset = QUIET_ZONE * scale
      return { path: buildModulesPath(qr.modules.data, count, scale, offset), ok: true as const, loading: false as const }
    } catch {
      return { path: "", ok: false as const, loading: false as const }
    }
  }, [createQrCode, value, ec, size])

  const captionText = caption === undefined ? value : caption
  const logoSize = Math.round(size * LOGO_RATIO)

  return (
    <View className={cn("items-center gap-4", className)} {...rest}>
      {title ? (
        <Text variant="h3" className="text-center tabular-nums">
          {title}
        </Text>
      ) : null}

      {/* Kartu putih murni — kontras scanner, bukan estetika (lihat header) */}
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel ?? translate("Kode QR: {x}", { x: captionText || value })}
        className="relative items-center justify-center overflow-hidden rounded-md border border-border"
        style={{ width: size, height: size, backgroundColor: tokens.colors.brand.white }}
      >
        {encoded.ok ? (
          <Svg width={size} height={size}>
            <Rect x={0} y={0} width={size} height={size} fill={tokens.colors.brand.white} />
            <Path d={encoded.path} fill={tokens.colors.brand.black} />
          </Svg>
        ) : encoded.loading ? (
          // PERF-FIX (bundle): inti qrcode masih dimuat — skeleton netral,
          // bukan pesan error.
          <Skeleton width={size - 16} height={size - 16} />
        ) : (
          <View className="items-center gap-2 px-4">
            <Icon icon={QrCode} size="xl" />
            <Text variant="caption" tone="secondary" className="text-center">
              Data terlalu panjang untuk QR
            </Text>
          </View>
        )}

        {logo && encoded.ok ? (
          <View
            className="absolute items-center justify-center rounded-xs"
            style={[{ pointerEvents: "none" }, {
              width: logoSize + tokens.space[2],
              height: logoSize + tokens.space[2],
              backgroundColor: tokens.colors.brand.white,
            }]}
          >
            <Picture source={logo} alt="" width={logoSize} height={logoSize} radius="xs" bordered={false} />
          </View>
        ) : null}
      </View>

      {captionText ? (
        onCopy ? (
          <CopyableField value={captionText} copyValue={value} onCopy={onCopy} copied={copied} wrap />
        ) : (
          <Text variant="monoBody" tone="secondary" selectable className="max-w-full text-center">
            {captionText}
          </Text>
        )
      ) : null}
    </View>
  )
}
