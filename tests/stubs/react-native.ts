/**
 * Stub `react-native` untuk Vitest.
 *
 * `lib/api/client.ts` mengimpor `Platform` hanya untuk mengisi header
 * `X-Platform`. Memuat paket `react-native` yang asli di Node gagal pada baris
 * `import typeof …` (sintaks Flow) sebelum satu pun test berjalan. Nilai di sini
 * tidak memengaruhi logika yang diuji.
 */
export const Platform = {
  OS: "web" as const,
  select: <T,>(specific: { web?: T; default?: T }) => specific.web ?? specific.default,
}

export default { Platform }
