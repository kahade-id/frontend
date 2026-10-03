import { useCallback } from "react"

import { useToast } from "@/components/ui/toast"
import { translate } from "@/lib/i18n"

/**
 * B3O-42 / B3O-43 — konvensi bersama "tutup sheet yang di-guard saat sibuk".
 *
 * Saat `busy` (submit/propose berjalan), back/backdrop/X ditelan + toast
 * "Tunggu…" — sama seperti konvensi PIN sheet transfer/withdraw. Tanpa ini
 * pengguna menutup sheet di tengah request: request tetap jalan tetapi hasil
 * (sukses/gagal) kehilangan konteks sheet tempat aksi dimulai.
 *
 * Dipakai: sheet aksi order (submitting), sheet usul penyelesaian sengketa
 * (proposing).
 */
export function useGuardedRequestClose(busy: boolean, onClose: () => void): () => void {
  const toast = useToast()
  return useCallback(() => {
    if (busy) {
      toast.show({ title: translate("Tunggu sebentar, masih memproses…"), tone: "info" })
      return
    }
    onClose()
  }, [busy, onClose, toast])
}
