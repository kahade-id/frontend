/**
 * Kahade — tuning jendela render FlatList (audit chat F15, MURNI).
 *
 * `ListWindowing` = subset prop VirtualizedList yang menentukan berapa banyak
 * sel di-mount dan seberapa cepat. Default `FEED_LIST_WINDOWING` (LR-005) cocok
 * untuk kartu tinggi/berat; daftar yang barisnya rapat dan berjumlah ribuan
 * (daftar chat) memakai nilai sendiri — lihat lib/chat-list-windowing.
 */
export type ListWindowing = {
  initialNumToRender?: number
  maxToRenderPerBatch?: number
  windowSize?: number
  updateCellsBatchingPeriod?: number
}

/**
 * Default feed (LR-005):
 *   - initialNumToRender 6: kartu feed berat (galeri + teks + bar aksi +
 *     animasi hati); 8 kartu = first paint mahal;
 *   - maxToRenderPerBatch 6: batch inkremental kecil = scroll lebih halus;
 *   - windowSize 11 (±5 layar): headroom saat fling cepat; default RN 21
 *     terlalu boros untuk kartu seberat ini.
 */
export const FEED_LIST_WINDOWING = {
  initialNumToRender: 6,
  maxToRenderPerBatch: 6,
  windowSize: 11,
} as const satisfies ListWindowing
