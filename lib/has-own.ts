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

/**
 * Ambil nilai dari peta berindeks string — pengganti `MAP[key] ?? fallback`.
 *
 * Kenapa `??` saja tidak cukup (non-obvious, dan ini yang membuat bug ini
 * mudah lolos review): `??` hanya aktif untuk `null`/`undefined`. Bila `key`
 * berasal dari data eksternal dan berisi nama milik `Object.prototype` —
 * `"toString"`, `"valueOf"`, `"constructor"`, `"hasOwnProperty"` — maka
 * `MAP[key]` mengembalikan sebuah FUNGSI. Fungsi bukan nilai nullish, jadi
 * `??` diam saja, dan fungsi itu berakhir sebagai anak <Badge>/<Text>:
 *
 *     <Badge>{HISTORY_LABELS["toString"]}</Badge>
 *     → Functions are not valid as a React child → error boundary
 *
 * `hasOwn` menutup jalur itu: kunci warisan tidak pernah dianggap ada, jadi
 * fallback-lah yang dipakai. Bandingkan dengan pola `isXStatus()` di
 * komponen status, yang memakai `.includes()` pada daftar eksplisit — itu
 * sudah aman, dan helper ini untuk peta yang TIDAK punya daftar kunci.
 *
 * `null`/`undefined` pada `value` juga jatuh ke fallback: beberapa peta
 * sengaja bertipe `Partial<Record<...>>` dan bisa berisi `undefined`.
 */
export function mapValue<T>(
  source: Record<string, T> | Partial<Record<string, T>>,
  key: string | undefined | null,
  fallback: T,
): T {
  if (key == null) return fallback
  if (!hasOwn(source, key)) return fallback
  const value = source[key]
  return value === undefined || value === null ? fallback : (value as T)
}
