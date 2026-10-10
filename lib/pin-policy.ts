/**
 * Kahade — kebijakan PIN dompet sisi klien (Audit Auth 2026-10-10, #FE-I6).
 *
 * Mirror `WalletService.validatePinPolicy` di backend: 6 digit, bukan semua
 * digit sama, bukan deret naik/turun, bukan pola dua digit berulang
 * (121212), bukan pasangan digit (112233). Backend tetap otoritas — ini hanya
 * agar layar PIN memberi alasan Indonesia yang jelas SEBELUM request, bukan
 * pesan Inggris class-validator setelahnya. Bila backend menambah aturan,
 * sinkronkan di sini.
 */

const WEAK_SEQUENCES: ReadonlySet<string> = new Set([
  "012345", "123456", "234567", "345678", "456789", "567890",
  "098765", "987654", "876543", "765432", "654321", "543210",
])

export type PinWeakness =
  | "format"
  | "repeated"
  | "sequential"
  | "pair-pattern"
  | "paired-digits"
  | null

/** Alasan PIN lemah, atau `null` bila lolos semua aturan backend. */
export function pinWeakness(pin: string): PinWeakness {
  if (!/^\d{6}$/.test(pin)) return "format"
  if (/^(\d)\1{5}$/.test(pin)) return "repeated"
  if (WEAK_SEQUENCES.has(pin)) return "sequential"
  const pair = /^(\d)(\d)\1\2\1\2$/.exec(pin)
  if (pair && pair[1] !== pair[2]) return "pair-pattern"
  if (/^(\d)\1(\d)\2(\d)\3$/.test(pin)) return "paired-digits"
  return null
}

export function isWeakPin(pin: string): boolean {
  return pinWeakness(pin) !== null
}

/** Pesan Indonesia per alasan — kunci i18n (sumber = string ini). */
export function pinWeaknessMessage(reason: Exclude<PinWeakness, null>): string {
  switch (reason) {
    case "format":
      return "PIN harus tepat 6 angka."
    case "repeated":
      return "PIN tidak boleh satu angka yang diulang (mis. 111111)."
    case "sequential":
      return "PIN tidak boleh angka berurutan (mis. 123456)."
    case "pair-pattern":
      return "PIN tidak boleh pola dua angka berulang (mis. 121212)."
    case "paired-digits":
      return "PIN tidak boleh pasangan angka (mis. 112233)."
  }
}
