/**
 * Kahade — pesan standar hasil mutasi yang gagal.
 *
 * R2 (audit escrow ronde-2, butir #1–#16): enam layar escrow menangani kegagalan
 * mutasi dengan pola identik — cabang "kegagalan TAK PASTI" (jaringan/timeout/
 * PARSE) harus menampilkan pesan netral (mungkin sudah diproses) + memicu
 * penyegaran status, BUKAN toast merah "gagal" yang memusuhi kenyataan.
 * Pola itu sebelumnya tersalin per-handler (layar order ronde-1); dipusatkan
 * di sini supaya seluruh mutasi mendapat perilaku yang sama.
 */
import { isApiError, isUncertainMutationError, userMessage } from "@/lib/api/errors"
import { captureError } from "@/lib/telemetry"

/** Bentuk minimal `toast.show` — struktural supaya tanpa impor sirkular. */
export type ShowMutationToast = (opts: {
  title: string
  description?: string
  tone?: "neutral" | "success" | "danger" | "warning" | "info"
  duration?: number
}) => void

/**
 * Tampilkan toast kegagalan mutasi sesuai klasifikasinya.
 *
 * Mengembalikan `true` bila kegagalannya TAK PASTI — pemanggil WAJIB memuat
 * ulang status dari server pada kasus itu (state lokal tidak lagi dapat
 * dipercaya berdiri sendiri).
 */
export function showMutationError(
  show: ShowMutationToast,
  opts: {
    /** Judul bila kegagalan PASTI (server menolak jelas). */
    failTitle: string
    /** Kalimat aksi untuk kegagalan tak pasti, mis. "Memuat ulang status…". */
    uncertainHint: string
    err: unknown
    /** Deskripsi tambahan waktu jalur tak pasti. */
    uncertainDetail?: string
    /**
     * R2 (audit ronde-2, butir #105): scope telemetri. Kegagalan TAK PASTI di
     * jalur uang sebelumnya mengakhiri jejak di toast — tanpa jejak yang bisa
     * menyelamatkan rekonsiliasi support. Kini dilaporkan ke ring buffer
     * telemetri (dan sink remote bila diaktifkan) dengan scope layar.
     */
    scope?: string
  },
): boolean {
  if (!isUncertainMutationError(opts.err)) {
    show({
      title: opts.failTitle,
      description: isApiError(opts.err) ? userMessage(opts.err) : undefined,
      tone: "danger",
    })
    return false
  }
  captureError(opts.scope ?? "mutation.uncertain", opts.err)
  const base = isApiError(opts.err)
    ? userMessage(opts.err)
    : `${opts.failTitle} — penyebab tidak diketahui.`
  show({
    title: opts.uncertainHint,
    description: opts.uncertainDetail ? `${base} ${opts.uncertainDetail}` : base,
    tone: "warning",
    duration: 5000,
  })
  return true
}
