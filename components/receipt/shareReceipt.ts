/**
 * Kahade — bagikan struk tiket sebagai gambar.
 *
 * Alur: `react-native-view-shot` menangkap kartu tiket (via ref) -> berkas
 * PNG di direktori cache (`expo-file-system`) -> `expo-sharing` membuka share
 * sheet OS (`lib/share` memilih jalur file yang benar per platform).
 *
 * Fallback: Alert bila gagal — tidak melempar ke pemanggil.
 *
 * Catatan: layar transfer & tarik dana memakai <ScreenCaptureGuard>
 * (FLAG_SECURE Android / preventScreenCapture iOS) — hasil capture di
 * perangkat produksi bisa hitam di sana. Itu keputusan keamanan yang
 * disengaja; share tetap dicoba dan kegagalan dilaporkan lewat Alert.
 */
import { Alert, type View } from "react-native"
import { captureRef } from "react-native-view-shot"

import { shareContent } from "@/lib/share"
import { translate } from "@/lib/i18n/translate"

export async function shareReceipt(
  ticket: View | null | undefined,
  filename = "struk-kahade.png",
): Promise<boolean> {
  try {
    if (!ticket) throw new Error("ticket-ref-missing")
    // `tmpfile` = PNG di direktori cache — siap dishare langsung.
    const uri = await captureRef(ticket, {
      format: "png",
      quality: 1,
      result: "tmpfile",
    })
    if (!uri) throw new Error("capture-empty")
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
