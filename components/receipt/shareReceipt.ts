/**
 * Kahade — bagikan struk tiket sebagai gambar.
 *
 * Alur: `captureView` (lib/capture-view.ts, lazy import react-native-view-shot)
 * menangkap kartu tiket (via ref) -> berkas PNG di direktori cache
 * (`expo-file-system`) -> `expo-sharing` membuka share sheet OS (`lib/share`
 * memilih jalur file yang benar per platform).
 *
 * Fallback: Alert bila gagal — tidak melempar ke pemanggil.
 *
 * Catatan: layar transfer & tarik dana memakai <ScreenCaptureGuard>
 * (FLAG_SECURE Android / preventScreenCapture iOS) — hasil capture di
 * perangkat produksi bisa hitam di sana. Itu keputusan keamanan yang
 * disengaja; share tetap dicoba dan kegagalan dilaporkan lewat Alert.
 */
import { Alert, Platform, type View } from "react-native"

import { captureView } from "@/lib/capture-view"
import { shareContent } from "@/lib/share"
import { translate } from "@/lib/i18n/translate"

async function captureReceiptUri(
  ticket: View | null | undefined,
): Promise<string> {
  if (!ticket) throw new Error("ticket-ref-missing")
  // Web: `data-uri` agar bisa diunduh via anchor; native: `tmpfile` PNG di
  // direktori cache — siap dishare langsung.
  // captureView melempar bila ref kosong / hasil kosong.
  return captureView(ticket, {
    format: "png",
    quality: 1,
    result: Platform.OS === "web" ? "data-uri" : "tmpfile",
  })
}

export async function shareReceipt(
  ticket: View | null | undefined,
  filename = "struk-kahade.png",
): Promise<boolean> {
  try {
    const uri = await captureReceiptUri(ticket)
    const outcome = await shareContent({
      fileUri: uri,
      mimeType: "image/png",
      dialogTitle: filename,
    })
    return outcome === "shared"
  } catch {
    Alert.alert(
      translate("Gagal membagikan"),
      translate("Struk tidak dapat dibagikan saat ini. Coba lagi nanti."),
    )
    return false
  }
}

/**
 * FE-IMP-4 item 16: unduh struk sebagai PNG.
 *
 * - Web: capture -> anchor `download` (berkas tersimpan langsung).
 * - Native: tidak ada API unduh berkas yang andal lintas vendor — dipakai
 *   share sheet OS (pengguna bisa pilih "Simpan ke File/Foto"). Jujur di
 *   komentar & tidak berpura-pura "unduh" padahal share.
 */
export async function downloadReceipt(
  ticket: View | null | undefined,
  filename = "struk-kahade.png",
): Promise<boolean> {
  try {
    const uri = await captureReceiptUri(ticket)
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const anchor = document.createElement("a")
      anchor.href = uri
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      return true
    }
    // Native: fallback ke share sheet (ada opsi simpan).
    const outcome = await shareContent({
      fileUri: uri,
      mimeType: "image/png",
      dialogTitle: filename,
    })
    return outcome === "shared"
  } catch {
    Alert.alert(
      translate("Gagal mengunduh"),
      translate("Struk tidak dapat diunduh saat ini. Coba lagi nanti."),
    )
    return false
  }
}
