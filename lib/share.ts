/**
 * Kahade — share sheet native.
 *
 * Dua jalur, dipilih otomatis oleh `shareContent()`:
 *   1. TEKS / URL (Order Link, kode referral, pesan)  -> `Share.share` RN core.
 *      expo-sharing hanya menerima **file URI lokal** — tidak bisa membagikan
 *      string teks. RN `Share` justru sebaliknya: teks/URL saja.
 *   2. FILE (PDF invoice, foto bukti yang diunduh)      -> `expo-sharing.shareAsync`.
 *      RN `Share` di Android tidak bisa melampirkan file; expo-sharing memakai
 *      FileProvider/UIActivityViewController dengan benar.
 *
 * Keputusan non-obvious:
 *   - iOS `Share.share` membedakan `message` dan `url`: kalau keduanya diisi,
 *     WhatsApp/iMessage menerima teks + link preview. Android hanya membaca
 *     `message`, jadi untuk Android URL DIGABUNG ke message bila belum ada di
 *     dalamnya — kalau tidak, link hilang.
 *   - Hasil dinormalkan ke `ShareOutcome` ("shared" | "dismissed" |
 *     "unavailable"). RN hanya melaporkan `dismissedAction` di iOS; Android
 *     selalu `sharedAction` walau pengguna batal. Pemanggil JANGAN menampilkan
 *     Banner "Berhasil dibagikan" berdasarkan outcome ini di Android — cukup
 *     tidak menampilkan apa-apa (sheet OS sudah cukup sebagai feedback).
 *   - Web: `navigator.share` bila ada (mobile browser), kalau tidak
 *     "unavailable" — pemanggil jatuh ke tombol Salin (<CopyableField>).
 */
import * as Sharing from "expo-sharing"
import { Platform, Share } from "react-native"

export type ShareTextPayload = {
  /** Kalimat siap kirim */
  message?: string
  url?: string
  /** Judul sheet (Android) / subject email (iOS) */
  title?: string
}

export type ShareFilePayload = {
  /** URI file LOKAL (file://…), bukan https */
  fileUri: string
  mimeType?: string
  /** Judul dialog Android */
  dialogTitle?: string
  /** UTI iOS (mis. "com.adobe.pdf") — opsional, biasanya terdeteksi */
  uti?: string
}

export type SharePayload = ShareTextPayload | ShareFilePayload

export type ShareOutcome = "shared" | "dismissed" | "unavailable"

export function isFilePayload(p: SharePayload): p is ShareFilePayload {
  return "fileUri" in p
}

export async function shareContent(payload: SharePayload): Promise<ShareOutcome> {
  return isFilePayload(payload) ? shareFile(payload) : shareText(payload)
}

async function shareText({ message, url, title }: ShareTextPayload): Promise<ShareOutcome> {
  if (!message && !url) return "unavailable"

  if (Platform.OS === "web") {
    const nav = globalThis.navigator as Navigator | undefined
    if (!nav?.share) return "unavailable"
    try {
      await nav.share({ text: message, url, title })
      return "shared"
    } catch (err) {
      return (err as { name?: string })?.name === "AbortError" ? "dismissed" : "unavailable"
    }
  }

  // Android mengabaikan `url`; tempelkan ke message bila belum ada
  const androidMessage =
    url && !(message ?? "").includes(url) ? [message, url].filter(Boolean).join("\n") : message ?? url ?? ""

  // RN `ShareContent` adalah union `{ message: string } | { url: string }` —
  // objek dengan `message: undefined` tidak lolos type-check. Bangun konten
  // secara eksplisit: iOS boleh url-only, message-only, atau keduanya.
  const content: Parameters<typeof Share.share>[0] =
    Platform.OS === "ios"
      ? message
        ? { message, url, title }
        : { url: url as string, title }
      : { message: androidMessage, title }

  try {
    const result = await Share.share(content, { dialogTitle: title, subject: title })
    return result.action === Share.dismissedAction ? "dismissed" : "shared"
  } catch {
    return "unavailable"
  }
}

async function shareFile({ fileUri, mimeType, dialogTitle, uti }: ShareFilePayload): Promise<ShareOutcome> {
  if (!(await Sharing.isAvailableAsync())) return "unavailable"
  try {
    await Sharing.shareAsync(fileUri, { mimeType, dialogTitle, UTI: uti })
    // expo-sharing tidak melaporkan batal/berhasil; anggap sheet sudah tampil
    return "shared"
  } catch {
    return "unavailable"
  }
}
