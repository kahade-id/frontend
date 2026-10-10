/**
 * CR-04 (audit etalase 2026-10-10): penjaga autosave draf berbasis epoch.
 *
 * Masalah lama: flag `draftSuppressed` di layar buat etalase dinyalakan saat
 * draf dibuang ("Buang" di dialog "Lanjutkan draf?") dan TIDAK PERNAH direset
 * — autosave mati untuk sisa sesi, ketikan berikutnya hilang bila aplikasi
 * ditutup. Yang sebenarnya perlu dicegah hanya timer yang SUDAH berjalan saat
 * draf dibuang (SH-02), bukan timer yang dijadwalkan setelahnya.
 *
 * Pola: timer menyimpan token `arm()` saat dijadwalkan; `invalidate()`
 * menaikkan epoch sehingga token lama basi; timer baru otomatis memakai epoch
 * baru dan hidup kembali.
 */
export type DraftAutosaveGuard = {
  /** Token untuk timer yang baru dijadwalkan. */
  arm: () => number
  /** Draf dibuang/terbit: semua timer yang sedang berjalan menjadi basi. */
  invalidate: () => void
  /** `true` bila token masih berlaku (tidak ada pembuangan sejak dijadwalkan). */
  isLive: (token: number) => boolean
}

export function createDraftAutosaveGuard(): DraftAutosaveGuard {
  let epoch = 0
  return {
    arm: () => epoch,
    invalidate: () => {
      epoch += 1
    },
    isLive: (token) => token === epoch,
  }
}
