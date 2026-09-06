/**
 * Kahade — keanggotaan kunci yang AMAN untuk objek peta dari data eksternal.
 *
 * Kenapa bukan operator `in` (non-obvious): `key in obj` menelusuri SELURUH
 * rantai prototipe, bukan hanya kunci milik objek itu sendiri. Untuk peta
 * status yang diindeks dengan nilai dari backend — `STATUS_TONE[status]` —
 * itu berarti `"toString" in STATUS_TONE` bernilai `true`. Cabang "dikenal"
 * lalu diambil dan `STATUS_LABELS["toString"]` mengembalikan sebuah FUNGSI,
 * yang diteruskan sebagai anak <Badge>/<Text>. React menolaknya dengan
 * "Functions are not valid as a React child" → seluruh layar jatuh ke error
 * boundary.
 *
 * Kenapa bukan `Object.hasOwn` (ES2022): ia benar secara semantik, tetapi
 * baru tersedia di iOS 15.4+/Chrome 93+ dan bergantung pada versi Hermes yang
 * ikut terpasang. `Object.prototype.hasOwnProperty.call` identik hasilnya dan
 * tersedia di semua engine yang didukung app ini — jadi jangan "dimodernisasi"
 * ke `Object.hasOwn` nanti tanpa menaikkan target platform minimum.
 *
 * Catatan: helper ini TIDAK memvalidasi bahwa nilainya string. Peta dengan
 * nilai bertipe Record<string, X> tetap diasumsikan berisi X.
 */
export function hasOwn<T extends object>(source: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(source, key)
}
