/**
 * Kahade — klasifikasi "etalase tidak tersedia" (DT-03, audit 2026-10-10).
 *
 * Dulu layar detail hanya memperlakukan 404 sebagai "tidak ditemukan";
 * 410 (dihapus permanen), 403 (privat milik orang lain), dan id rusak dari
 * `seg()` (ApiError BAD_REQUEST tanpa status HTTP) jatuh ke ErrorState generik
 * dengan tombol "Coba lagi" yang mustahil berhasil. Fungsi murni — teruji.
 */
export type ShowcaseUnavailability = "not-found" | "private" | null

export function resolveShowcaseUnavailability(input: {
  status: number | null | undefined
  code?: string | null
}): ShowcaseUnavailability {
  if (input.status === 404 || input.status === 410) return "not-found"
  if (input.status === 403) return "private"
  // `seg()` menolak id dengan spasi/garis miring/kontrol SEBELUM request:
  // tidak ada status, kode BAD_REQUEST — deep link rusak, bukan gangguan.
  if (input.status == null && input.code === "BAD_REQUEST") return "not-found"
  return null
}
