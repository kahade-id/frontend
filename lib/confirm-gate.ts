/**
 * Kahade — gerbang konfirmasi berbasis Promise (audit chat G20, MURNI).
 *
 * Alur async yang butuh jawaban ya/tidak dari dialog di tengah jalan ("File
 * 40 MB, lanjutkan?" sebelum unggah) paling rapi ditulis sebagai
 * `if (!(await gate.ask(x))) return`. Gerbang ini menjaga tiga hal yang mudah
 * salah bila ditulis ulang di tiap layar:
 *   - pertanyaan BARU membatalkan yang masih menggantung (jawabannya `false`) —
 *     dua dialog tidak pernah menunggu bersamaan dan tak ada Promise yatim;
 *   - `settle` tanpa pertanyaan menggantung = tidak berbuat apa-apa;
 *   - `dispose` (layar ditutup) menjawab `false` supaya alur async yang
 *     menunggu berhenti, bukan tergantung selamanya.
 */
export type ConfirmGate<T> = {
  /** Tampilkan pertanyaan; resolve `true` (lanjut) / `false` (batal/tergantikan). */
  ask: (payload: T) => Promise<boolean>
  /** Jawab pertanyaan yang sedang menggantung. */
  settle: (ok: boolean) => void
  /** Layar ditutup: pertanyaan menggantung dijawab `false`. */
  dispose: () => void
}

/** `onChange(payload | null)` dipanggil saat pertanyaan muncul / selesai (untuk state dialog). */
export function createConfirmGate<T>(onChange: (pending: T | null) => void): ConfirmGate<T> {
  let resolver: ((ok: boolean) => void) | null = null
  const settle = (ok: boolean) => {
    const current = resolver
    resolver = null
    if (!current) return
    onChange(null)
    current(ok)
  }
  return {
    ask(payload) {
      // Pertanyaan lama (bila ada) dibatalkan DULU, lalu yang baru dipasang.
      const previous = resolver
      resolver = null
      previous?.(false)
      return new Promise<boolean>((resolve) => {
        resolver = resolve
        onChange(payload)
      })
    },
    settle,
    dispose() {
      settle(false)
    },
  }
}
