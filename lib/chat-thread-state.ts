/**
 * Kahade — keadaan tampilan thread ruang chat (audit chat I23, MURNI).
 *
 * Keluhan: layar kosong saat membuka ruang. Penyebab sistemik: tampilan thread
 * adalah hasil RANGKAIAN boolean (`loading`, `error`, `roomGone`, jumlah
 * pesan) yang dipilah di dalam `ListEmptyComponent` FlatList — bila ada
 * kombinasi yang tidak tertangani (mis. tanpa `roomId` → loading selamanya;
 * atau list kosong yang tinggi isinya menyusut ke 0 di dalam kontainer
 * FlatList), hasilnya LAYAR KOSONG tanpa penjelasan.
 *
 * `resolveThreadState` memetakan SEMUA kombinasi ke tepat satu dari enam
 * keadaan, masing-masing punya tampilan yang jelas (shimmer → pesan / kosong /
 * galat+coba lagi / ruang hilang / rute tak valid) — tidak ada cabang "tidak
 * ada". Dibuat total dan berurutan supaya bisa diuji lengkap.
 */
export type ThreadState =
  /** Tanpa id ruang (rute rusak) — jelaskan, jangan shimmer selamanya. */
  | "invalid"
  /** Memuat pertama kali — shimmer berbentuk bubble. */
  | "loading"
  /** Gagal memuat — pesan galat + Coba lagi. */
  | "error"
  /** Ruang dihapus/dinonaktifkan (404). */
  | "gone"
  /** Dimuat, tetapi belum ada pesan — ilustrasi + panduan. */
  | "empty"
  /** Ada pesan untuk ditampilkan. */
  | "ready"

export type ThreadStateInput = {
  hasRoomId: boolean
  loading: boolean
  error: string | null
  roomGone: boolean
  /** Jumlah baris pesan yang bisa ditampilkan (sudah tanpa yang disembunyikan). */
  rowCount: number
  /**
   * Muat awal belum memberi data selama `THREAD_LOADING_TIMEOUT_MS` (Bug 2,
   * 2026-10-08). Diberikan pemanggil dari timer yang hanya menyala saat
   * `loading` dan belum ada baris; begitu ada baris, keadaan "ready" menang.
   */
  timedOut?: boolean
}

/**
 * Urutan keputusan (setiap pertanyaan menjawab satu hal):
 *   1. tanpa id ruang → "invalid" (tidak ada yang bisa dimuat);
 *   2. ADA pesan → "ready" — pesan yang sudah ada selalu menang, juga saat
 *      muat-ulang berjalan, galat sementara, ATAU setelah timeout (respons
 *      terlambat yang akhirnya membawa pesan langsung menggantikan galat);
 *   3. ruang hilang → "gone" (404: mencoba lagi sia-sia);
 *   4. muat awal melewati batas waktu → "error" (Bug 2: pesan galat + Coba lagi,
 *      bukan shimmer tanpa akhir);
 *   5. sedang memuat → "loading";
 *   6. galat → "error";
 *   7. selain itu → "empty".
 */
export function resolveThreadState(input: ThreadStateInput): ThreadState {
  if (!input.hasRoomId) return "invalid"
  if (input.rowCount > 0) return "ready"
  if (input.roomGone) return "gone"
  if (input.timedOut) return "error"
  if (input.loading) return "loading"
  if (input.error) return "error"
  return "empty"
}

/**
 * Batas tunggu muat awal (ms) tanpa data. Lewat dari ini, layar menampilkan
 * galat + "Coba lagi" (Bug 2, permintaan produk: "lebih dari 10 detik").
 * Permintaan di belakangnya tetap berjalan: bila datanya tiba, pesan menang.
 */
export const THREAD_LOADING_TIMEOUT_MS = 10_000
