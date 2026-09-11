/**
 * Kahade — bentuk (shape) string untuk pencarian kamus.
 *
 * Kenapa perlu (non-obvious): banyak teks UI Indonesia mengandung nilai
 * yang baru diketahui saat runtime — `Saldo Rp1.250.000 dipindahkan`,
 * `3 item dipilih`. Kalau kamus hanya menyimpan string persis, semua teks
 * itu tidak akan pernah cocok dan pengguna English melihat bahasa Indonesia.
 *
 * Solusinya: kamus boleh menyimpan **bentuk** string, yaitu teks dengan
 * setiap angka diganti token `{x}`, dan `t()` mencoba dua langkah:
 *   1. cocok persis (paling cepat, selalu menang);
 *   2. cocok bentuk — angka sumber diekstrak lalu dipasang kembali ke
 *      terjemahan pada posisi `{x}` berurutan.
 *
 * Kedua sisi (codegen katalog dan runtime) WAJIB memakai fungsi ini supaya
 * bentuk yang dihasilkan identik.
 */
export const SHAPE_TOKEN = "{x}"

/** Token yang dipakai codegen untuk `${expr}` di template literal. */
export const SLOT_TOKEN = "\u0000"

/**
 * Angka yang mungkin muncul di teks UI: pemisah ribuan titik/spasi, desimal
 * koma/titik, persentase. BUKAN untuk memvalidasi angka — hanya untuk memask.
 */
const NUMBER_RUN =
  /(?:Rp\s?)?\d{1,3}(?:[.\s\u00a0]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?%/g

/** Nomor/ID yang berdiri sendiri (min. 1 digit) setelah teks lain diformat. */
const BARE_NUMBER = /\d+/g

export type Shaped = { shape: string; values: string[] }

/**
 * Mask angka menjadi token `{x}`.
 *
 * Dua pass dengan sengaja: `NUMBER_RUN` menangkap format khas finansial
 * ("Rp1.250.000", "2,5%") sebagai SATU token, `BARE_NUMBER` menyisakan angka
 * lepas ("item 3"). Urutan token hasil = urutan kemunculan di teks, dan
 * pengisian nilai memakai urutan yang sama.
 */
export function maskNumbers(input: string): Shaped {
  const values: string[] = []
  let out = input.replace(NUMBER_RUN, (m) => {
    values.push(m)
    return SHAPE_TOKEN
  })
  out = out.replace(BARE_NUMBER, (m) => {
    values.push(m)
    return SHAPE_TOKEN
  })
  return { shape: collapse(out), values }
}

/**
 * Bentuk kanonik untuk kunci kamus.
 *
 * `SLOT_TOKEN` (dari codegen, berarti "di sini ada ekspresi") dipetakan ke
 * `SHAPE_TOKEN` yang sama, sehingga kunci yang dibangun dari template literal
 * cocok dengan hasil masking string jadi di runtime.
 */
export function shapeOf(input: string): Shaped {
  const withSlots = input.split(SLOT_TOKEN).join(SHAPE_TOKEN)
  const masked = maskNumbers(withSlots)
  return {
    shape: masked.shape.split(SHAPE_TOKEN).join(SHAPE_TOKEN),
    values: masked.values,
  }
}

/** Isi token `{x}` berurutan dengan nilai. Token tanpa nilai dibiarkan. */
export function fillTokens(text: string, values: readonly string[]): string {
  if (values.length === 0 || !text.includes(SHAPE_TOKEN)) return text
  let i = 0
  return text.replace(new RegExp(SHAPE_TOKEN.replace("{", "\\{"), "g"), () =>
    i < values.length ? values[i++] : SHAPE_TOKEN,
  )
}

/** Nama/variabel bebas → `{x}` (dipakai codegen untuk `${name}` yang bukan angka). */
export function collapse(text: string): string {
  // Semua whitespace (termasuk newline hasil JSX multi-baris) jadi satu spasi:
  // JSX juga mengganti baris baru dengan SATU spasi saat merender, jadi kunci
  // yang dibangun dari sumber tetap sama dengan string yang dilihat runtime.
  return text.replace(/\s+/g, " ").trim()
}

/** Interpolasi bernama: `t("Halo {name}", { name })` dan posisi `{0}`. */
export function interpolate(
  text: string,
  vars?: Record<string, string | number> | readonly (string | number)[],
): string {
  if (!vars) return text
  if (Array.isArray(vars)) {
    const list = vars as readonly (string | number)[]
    let i = 0
    return text.replace(/\{\d+\}/g, () => String(list[i++] ?? ""))
  }
  const map = vars as Record<string, string | number>
  return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (m, key: string) =>
    Object.prototype.hasOwnProperty.call(map, key) ? String(map[key]) : m,
  )
}
