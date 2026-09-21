/**
 * Kahade — penanda update OTA (F-14 audit 2026-09-20).
 *
 * `expo-updates` dengan `checkAutomatically: ON_LOAD` menukar bundle di balik
 * layar: pengguna membuka app dan perubahan sudah aktif TANPA pemberitahuan.
 * Modul ini mendeteksi "bundle berbeda sejak launch terakhir" dan memberi
 * root layout bahan untuk toast "Aplikasi baru saja diperbarui" sekali per
 * update — bukan changelog penuh (butuh pipeline rilis), sekadar acknowledgment.
 *
 * Keputusan non-obvious:
 *   - `Updates.updateId` null di dev/expo-start → no-op (tidak ada OTA).
 *   - Launch PERTAMA setelah fitur ini dipasang hanya MENCATAT id (tidak
 *     mengumumkan): tidak ada "sebelumnya" untuk dibandingkan, dan mengklaim
 *     "baru diperbarui" pada install segar adalah kebohongan kecil yang
 *     mengikis kepercayaan pada pesan ini.
 *   - Penyimpanan di SecureStore key `lastUpdateId` (bukan rahasia, tapi repo
 *     ini tidak memasang AsyncStorage — lihat komentar `onboardingSeen`).
 *   - Kegagalan baca/tulis ditelan via logWarn: pengumuman update adalah
 *     kenyamanan, tidak boleh menghalangi boot.
 */
import { Platform } from "react-native"
import * as Updates from "expo-updates"

import { getSecureItem, setSecureItem, SecureKeys } from "@/lib/secure-storage"
import { logWarn } from "@/lib/telemetry"

export type OtaUpdateNotice = {
  updateId: string
  runtimeVersion: string | null
}

/**
 * Bandingkan update id saat ini dengan yang tercatat; kembalikan notice bila
 * BERBEDA (dan catat yang baru). Null bila tidak ada yang berubah / dev / web.
 */
export async function consumeOtaUpdateNotice(): Promise<OtaUpdateNotice | null> {
  if (Platform.OS === "web") return null
  const current = Updates.updateId
  if (!current) return null
  let previous: string | null = null
  try {
    previous = await getSecureItem(SecureKeys.lastUpdateId)
  } catch (err) {
    logWarn("ota:read-last-update", err)
    return null
  }
  if (previous === current) return null
  try {
    await setSecureItem(SecureKeys.lastUpdateId, current)
  } catch (err) {
    logWarn("ota:write-last-update", err)
  }
  if (!previous) return null // pencatatan pertama — jangan umumkan
  return { updateId: current, runtimeVersion: Updates.runtimeVersion ?? null }
}
