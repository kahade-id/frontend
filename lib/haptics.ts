/**
 * Kahade — haptic feedback (§8 Motion: "dipakai di momen kritikal —
 * konfirmasi PIN berhasil/gagal, threshold pull-to-refresh, konfirmasi
 * transaksi berhasil. TIDAK dipakai di interaksi ringan").
 *
 * Kosakata Kahade (`HapticKind`) memetakan ke expo-haptics supaya pemanggil
 * tidak berpikir dalam istilah OS (impact/notification/selection):
 *   - "light"   : tap ringan yang sengaja diaktifkan (`haptic` di PressableScale/
 *                 Button, default OFF). Untuk aksi yang mengubah dana/status.
 *   - "success" : PIN benar, transfer berhasil, KYC disetujui.
 *   - "error"   : PIN salah, biometrik gagal, transaksi ditolak.
 *   - "warning" : threshold pull-to-refresh, lockout dimulai.
 *   - "select"  : ganti pilihan pada picker/segmented (jarang — hanya bila
 *                 pilihan berdampak besar, mis. metode pembayaran).
 *
 * Keputusan non-obvious:
 *   - Semua fungsi fire-and-forget dan menelan error: di web/emulator
 *     expo-haptics melempar "not available"; getaran bukan alasan crash.
 *   - Tidak ada `Vibration` RN: pola vibrasi mentah terasa "murah" dan tidak
 *     mengikuti Taptic Engine iOS; expo-haptics memakai UIFeedbackGenerator
 *     dan HapticFeedbackConstants Android yang konsisten dengan OS.
 */
import * as Haptics from "expo-haptics"
import { Platform } from "react-native"

export type HapticKind = "light" | "success" | "error" | "warning" | "select"

const available = Platform.OS === "ios" || Platform.OS === "android"

export function haptic(kind: HapticKind): void {
  if (!available) return
  let p: Promise<void>
  switch (kind) {
    case "light":
      p = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      break
    case "success":
      p = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      break
    case "error":
      p = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      break
    case "warning":
      p = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      break
    case "select":
      p = Haptics.selectionAsync()
      break
  }
  p.catch(() => {})
}
