/**
 * Kahade — `useWalletExport()`: unduh riwayat dompet (CSV / cetak).
 *
 * Endpoint:
 *   GET /v1/wallet/export/csv  → { csv }   (lib/api/wallet.ts membungkus Blob)
 *   GET /v1/wallet/export/pdf  → { html }  (HTML siap cetak, BUKAN biner PDF)
 *
 * Satu hook dipakai tiga layar (Tab Dompet, Riwayat Dompet, Analitik/Laporan)
 * supaya perilaku unduh identik: state `exporting` (dua tombol mati bersamaan
 * agar tidak ada dua berkas bersaing), penyimpanan lewat `saveBlobFile`
 * (anchor di web / share sheet di native), dan toast hasil yang menyebut
 * dengan jelas apakah berkas diunduh atau dibuka di share sheet.
 */
import { useCallback, useState } from "react"

import { api, userMessage } from "@/lib/api"
import { saveBlobFile } from "@/lib/export-file"

import { useToast } from "@/components/ui/toast"

export type WalletExportKind = "csv" | "pdf"

const FILENAME: Record<WalletExportKind, string> = {
  csv: "kahade-riwayat-dompet.csv",
  // Backend mengembalikan HTML siap cetak; ekstensi .html agar aplikasi
  // pembuka benar (menamai berkas .pdf akan membuat viewer gagal membukanya).
  pdf: "kahade-riwayat-dompet.html",
}

const MIME: Record<WalletExportKind, string> = {
  csv: "text/csv",
  pdf: "text/html",
}

export function useWalletExport() {
  const toast = useToast()
  const [exporting, setExporting] = useState<WalletExportKind | null>(null)

  const exportWallet = useCallback(
    async (kind: WalletExportKind) => {
      if (exporting) return
      setExporting(kind)
      try {
        const blob =
          kind === "csv" ? await api.wallet.exportWalletCsv() : await api.wallet.exportWalletPdf()
        const saved = await saveBlobFile(blob, FILENAME[kind], MIME[kind])
        toast.show({
          title: saved.kind === "downloaded" ? "Riwayat dompet diunduh" : "Riwayat dompet siap dibagikan",
          description: saved.filename,
          tone: "success",
          duration: 3000,
        })
      } catch (err: unknown) {
        toast.show({
          title: "Gagal mengekspor riwayat",
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        setExporting(null)
      }
    },
    [exporting, toast.show],
  )

  return { exporting, exportWallet }
}
