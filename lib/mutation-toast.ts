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
import { isApiError, isOfflineError, isUncertainMutationError, userMessage } from "@/lib/api/errors"
import { captureError } from "@/lib/telemetry"

/**
 * Kegagalan yang nasibnya PASTI walau biasanya masuk "tak pasti":
 * perangkat terverifikasi offline (request tak pernah dikirim — NetInfo,
 * audit 2026-10-09 A3) atau OfflineError (ditolak gerbang sebelum kirim).
 * Menampilkan "Aksi mungkin sudah diproses" untuk kasus ini menyesatkan.
 */
function isDefinitelyNotSent(err: unknown): boolean {
  if (isOfflineError(err)) return true
  return isApiError(err) && err.backendCode === "OFFLINE_VERIFIED"
}

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
    /**
     * Audit 2026-10-09: penafsir pesan khusus. Jalur UPLOAD meneruskan
     * `uploadMessage` (klasifikasi offline/timeout/413/5xx berbeda dari
     * mutasi JSON biasa — `userMessage` membuang pesan karangan klien untuk
     * kode NETWORK/TIMEOUT/SERVER). Default tetap `userMessage`.
     */
    describe?: (err: unknown) => string
  },
): boolean {
  const describe = opts.describe ?? ((err: unknown) => (isApiError(err) ? userMessage(err) : ""))
  // Audit 2026-10-09 (A3): offline terverifikasi (NetInfo) = request TAK
  // PERNAH dikirim → kegagalan PASTI, bukan "tak pasti". Menampilkan
  // "Aksi mungkin sudah diproses" untuk kasus ini menyesatkan (mustahil —
  // request tidak pernah keluar perangkat).
  if (!isUncertainMutationError(opts.err) || isDefinitelyNotSent(opts.err)) {
    const desc = describe(opts.err)
    show({
      title: opts.failTitle,
      description: desc || undefined,
      tone: "danger",
    })
    return false
  }
  captureError(opts.scope ?? "mutation.uncertain", opts.err)
  const base = describe(opts.err) || `${opts.failTitle} — penyebab tidak diketahui.`
  show({
    title: opts.uncertainHint,
    description: opts.uncertainDetail ? `${base} ${opts.uncertainDetail}` : base,
    tone: "warning",
    duration: 5000,
  })
  return true
}
