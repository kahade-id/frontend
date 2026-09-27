/**
 * Kahade — guard ketuk-ganda-untuk-suka (murni, unit-testable).
 *
 * Aturan:
 * - tidak ada handler suka → false (item statis);
 * - request like sedang berjalan (`likePending`) → false (debounce: jangan
 *   tembak request kedua selagi yang pertama belum selesai);
 * - item sudah disukai → false (double-tap TIDAK boleh menjadi unlike);
 * - belum disukai + tidak pending → true (tembak tepat sekali).
 *
 * Animasi hati tetap dimainkan di semua kasus (feedback visual); hanya
 * pemanggilan handler yang dijaga fungsi ini.
 */
export function shouldFireDoubleTapLike(args: {
  liked: boolean
  likePending: boolean
  hasHandler: boolean
}): boolean {
  return args.hasHandler && !args.liked && !args.likePending
}
