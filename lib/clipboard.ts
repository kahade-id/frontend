/**
 * Kahade — clipboard (expo-clipboard) untuk <CopyableField>, <OrderLinkShareCard>,
 * <BackupCodesDisplay>, resi di <DeliveryProofViewer>.
 *
 * Komponen UI sengaja TIDAK mengimpor expo-clipboard (lihat header
 * copyable-field.tsx) — mereka memanggil `onCopy(value)`. Layar pemanggil
 * memakai `useCopy()` dari sini: satu tempat untuk menyalin + state "copied"
 * dengan timer yang sinkron dengan Banner "Disalin" (§9.11).
 *
 * Kenapa expo-clipboard, bukan `Clipboard` dari react-native (non-obvious):
 *   `Clipboard` RN core sudah deprecated/dihapus dari RN sejak 0.60-an
 *   (dipindah ke @react-native-clipboard/clipboard). expo-clipboard bekerja di
 *   iOS/Android/Web dengan satu API dan mendukung `setStringAsync` yang
 *   benar-benar menunggu penulisan selesai — penting agar Banner "Disalin"
 *   tidak muncul sebelum clipboard terisi.
 */
import * as Clipboard from "expo-clipboard"
import { useCallback, useEffect, useRef, useState } from "react"

export async function copyToClipboard(value: string): Promise<boolean> {
  try {
    return await Clipboard.setStringAsync(value)
  } catch {
    return false
  }
}

/** Durasi default state "copied" — sama dengan auto-dismiss Banner pendek */
const COPIED_MS = 2000

/**
 * `const { copied, copy } = useCopy()`
 * `copy(value)` menulis ke clipboard; `copied` true selama `durationMs`.
 * Memakai `copiedKey` untuk membedakan field mana yang tersalin bila satu
 * layar punya beberapa CopyableField.
 */
export function useCopy(durationMs = COPIED_MS) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const copy = useCallback(
    async (value: string, key: string = value) => {
      const ok = await copyToClipboard(value)
      if (!ok) return false
      setCopiedKey(key)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopiedKey(null), durationMs)
      return true
    },
    [durationMs],
  )

  return { copied: copiedKey != null, copiedKey, copy }
}
