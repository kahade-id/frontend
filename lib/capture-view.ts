/**
 * Kahade — capture tampilan sebagai gambar (lazy).
 *
 * `react-native-view-shot` di-import DINAMIS (bukan di top-level) supaya
 * dependensi beratnya — terutama `html2canvas` (~430 KB source) yang dipakai
 * implementasi web — TIDAK masuk bundle awal aplikasi. Modul hanya diunduh
 * saat pengguna benar-benar mengetuk "simpan/bagikan sebagai gambar"
 * (layar QR, struk tiket). Di native, dynamic import tidak memecah bundle
 * (Metro native memaketkan semuanya) — perilaku tidak berubah.
 */

import type { RefObject } from "react"
import type { View } from "react-native"

export interface CaptureViewOptions {
  format?: "png" | "jpg"
  quality?: number
  result?: "tmpfile" | "base64" | "data-uri"
  width?: number
  height?: number
}

/**
 * Tangkap View (via ref) menjadi gambar. Melempar bila ref kosong atau
 * capture gagal — pemanggil yang menampilkan feedback ke pengguna.
 */
export async function captureView(
  ref: RefObject<View | null> | View | null | undefined,
  options: CaptureViewOptions = {},
): Promise<string> {
  const target = ref && typeof ref === "object" && "current" in ref ? ref.current : ref
  if (!target) throw new Error("capture-ref-missing")
  const { captureRef } = await import("react-native-view-shot")
  const uri = await captureRef(target, {
    format: "png",
    quality: 1,
    ...options,
  })
  if (!uri) throw new Error("capture-empty")
  return uri
}
