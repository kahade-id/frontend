/**
 * Kahade — LRU sederhana (audit perf/UX P2, 2026-10-03).
 *
 * Dipakai cache hasil konkretisasi href di root layout
 * (`concretePathCache`). Pola lamanya adalah `Map` + `clear()` TOTAL begitu
 * melewati 100 entri: satu deep link tak dikenal bisa mengosongkan seluruh
 * cache yang sudah hangat, sehingga kerja konkretisasi (regex +
 * encodeURIComponent) terulang di jalur panas tap-notifikasi/deep-link.
 *
 * LRU membuang HANYA entri paling lama — cache tetap hangat, memori tetap
 * terbatas. Implementasi memanfaatkan urutan iterasi `Map` (insertion order):
 * `get` yang mengenai entri memindahkannya ke belakang (paling baru),
 * sehingga kunci pertama selalu yang paling lama dipakai.
 *
 * Sengaja tanpa dependensi & tanpa efek samping — modul ini diuji langsung.
 */
export class LruCache<V> {
  private readonly entries = new Map<string, V>()

  constructor(private readonly maxSize: number) {
    if (maxSize < 1) throw new Error("LruCache: maxSize harus >= 1")
  }

  get size(): number {
    return this.entries.size
  }

  get(key: string): V | undefined {
    if (!this.entries.has(key)) return undefined
    const value = this.entries.get(key) as V
    // Sentuh ulang = tandai sebagai paling baru dipakai.
    this.entries.delete(key)
    this.entries.set(key, value)
    return value
  }

  set(key: string, value: V): void {
    // `delete` dulu supaya kunci yang sudah ada pindah ke urutan terbaru.
    this.entries.delete(key)
    this.entries.set(key, value)
    while (this.entries.size > this.maxSize) {
      const oldest = this.entries.keys().next()
      if (oldest.done) break
      this.entries.delete(oldest.value)
    }
  }

  has(key: string): boolean {
    return this.entries.has(key)
  }

  clear(): void {
    this.entries.clear()
  }

  /** Kunci dari yang paling lama → paling baru (dipakai test & diagnostik). */
  keys(): string[] {
    return [...this.entries.keys()]
  }
}
