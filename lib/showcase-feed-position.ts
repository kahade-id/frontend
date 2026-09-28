/**
 * Kahade — helper murni pemulihan posisi scroll feed (C02, batch 139).
 *
 * Pindah tab/filter lalu kembali memulihkan offset scroll, bukan kembali ke
 * atas. Posisi di-cache per (tab × filter × revision/sesi); saat kembali,
 * anchor (item terlihat paling atas saat pergi) harus masih ada di dataset —
 * bila tidak, dataset dianggap berubah dan posisi TIDAK dipulihkan.
 *
 * Murni & unit-testable — komponen hanya menyimpan/membaca via helper ini.
 */

/** Kunci cache posisi: tab × revision/sesi × filter. */
export function buildFeedPositionKey(
  kind: string,
  revision: number,
  filter: unknown,
): string {
  return `${kind}:${revision}:${JSON.stringify(filter)}`
}

export type SavedFeedPosition = {
  offset: number
  anchorId: string | null
}

/**
 * True bila posisi tersimpan boleh dipulihkan: ada offset positif DAN
 * (tanpa anchor, atau anchor masih ada di dataset kini).
 */
export function isFeedPositionRestorable(
  saved: SavedFeedPosition | undefined,
  itemIds: ReadonlySet<string> | readonly string[],
): saved is SavedFeedPosition {
  if (!saved || saved.offset <= 0) return false
  if (!saved.anchorId) return true
  // Set (punya .has) vs array (punya .includes).
  if (typeof (itemIds as ReadonlySet<string>).has === "function") {
    return (itemIds as ReadonlySet<string>).has(saved.anchorId)
  }
  return (itemIds as readonly string[]).includes(saved.anchorId)
}

/**
 * Pilih anchor = item terlihat dengan indeks terkecil (paling atas).
 * Murni — dipakai dari `onViewableItemsChanged`.
 */
export function selectTopVisibleAnchor<T extends { id: string }>(
  viewableItems: readonly { item: T; index?: number | null }[],
): T | null {
  let top: { item: T; index?: number | null } | null = null
  for (const candidate of viewableItems) {
    if (top == null || (candidate.index ?? Infinity) < (top.index ?? Infinity)) {
      top = candidate
    }
  }
  return top?.item ?? null
}
