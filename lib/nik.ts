/**
 * Kahade — validasi struktural NIK (D-08 audit 2026-09-20).
 *
 * Backend dan klien sebelumnya hanya mengecek `^\d{16}$`. NIK yang secara
 * struktur mustahil (kode provinsi tidak ada, tanggal lahir 99) lolos ke
 * antrean review KYC dan memenuhi antrean dengan sampah.
 *
 * Struktur NIK (UU Adminduk / Permendagri 76/2015):
 *   P P R R K K T T M M Y Y S S S S
 *   - PP : kode provinsi (daftar sah di bawah)
 *   - RR : kode kabupaten/kota (01-99)
 *   - KK : kode kecamatan (01-99)
 *   - TTMMYY: tanggal lahir. Perempuan: tanggal +40 (41-71). Tahun 2 digit.
 *   - SSSS: nomor urut (0001-9999)
 *
 * Keputusan non-obvious:
 *   - Validasi ini PENOLAK DINI di klien, bukan sumber kebenaran: daftar
 *     kode provinsi bisa bertambah (pemekaran) dan backend tetap harus
 *     memvalidasi. Karena itu pesan errornya menjelaskan bagian mana yang
 *     janggal, dan `isValidNikStructure` mengembalikan alasan terstruktur.
 *   - Tanggal lahir memakai kalender nyata (Februari 29 hanya di tahun
 *     kabisat). Ambiguitas abad (YY) diterima apa adanya — tidak bisa
 *     diputuskan tanpa data lain, dan usia minimum diverifikasi terpisah
 *     lewat `birthDate` di form KYC.
 *   - Nomor urut 0000 ditolak: spesifikasi Adminduk memakai 0001-9999.
 */

/** Kode provinsi yang sah (termasuk provinsi baru Papua 93-96). */
export const NIK_PROVINCE_CODES: readonly string[] = [
  // Sumatera
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "21",
  // Jawa
  "31", "32", "33", "34", "35", "36",
  // Bali & Nusa Tenggara
  "51", "52", "53",
  // Kalimantan
  "61", "62", "63", "64", "65",
  // Sulawesi
  "71", "72", "73", "74", "75", "76",
  // Maluku
  "81", "82",
  // Papua
  "91", "92", "93", "94", "95", "96",
]

export const NIK_LENGTH = 16

export type NikValidation = {
  valid: boolean
  /** Alasan terstruktur — kosong bila valid. Kunci pesan, bukan teks final. */
  reason?:
    | "LENGTH"
    | "NOT_DIGITS"
    | "PROVINCE"
    | "BIRTH_DATE"
    | "SERIAL"
  /** Jenis kelamin yang dikodekan NIK (tanggal > 40 = perempuan). */
  encodedGender?: "MALE" | "FEMALE"
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/**
 * Validasi struktur NIK. Mengembalikan alasan spesifik agar UI bisa menolak
 * dini dengan pesan yang jelas (bukan "NIK tidak valid" generik).
 */
export function validateNikStructure(value: string): NikValidation {
  const nik = value.trim()
  if (nik.length !== NIK_LENGTH) return { valid: false, reason: "LENGTH" }
  if (!/^\d{16}$/.test(nik)) return { valid: false, reason: "NOT_DIGITS" }

  const province = nik.slice(0, 2)
  if (!NIK_PROVINCE_CODES.includes(province)) return { valid: false, reason: "PROVINCE" }

  // Kabupaten/kota & kecamatan: 00 tidak dipakai di kode wilayah resmi.
  const regency = Number(nik.slice(2, 4))
  const district = Number(nik.slice(4, 6))
  if (regency === 0 || district === 0) return { valid: false, reason: "PROVINCE" }

  // Tanggal lahir — perempuan dikodekan tanggal + 40.
  let day = Number(nik.slice(6, 8))
  const month = Number(nik.slice(8, 10))
  const yearDigits = Number(nik.slice(10, 12))
  let encodedGender: "MALE" | "FEMALE" | undefined
  if (day >= 41 && day <= 71) {
    day -= 40
    encodedGender = "FEMALE"
  } else if (day >= 1 && day <= 31) {
    encodedGender = "MALE"
  } else {
    return { valid: false, reason: "BIRTH_DATE" }
  }
  if (month < 1 || month > 12) return { valid: false, reason: "BIRTH_DATE" }
  // Tahun 2 digit: dua abad mungkin (19xx/20xx). Februari 29 valid bila
  // SALAH SATU kandidat abad adalah tahun kabisat — menolak 29/02 yang
  // mungkin sah lebih buruk daripada meloloskan yang jarang salah.
  const maxDay =
    month === 2 && (isLeapYear(1900 + yearDigits) || isLeapYear(2000 + yearDigits))
      ? 29
      : DAYS_IN_MONTH[month - 1]
  if (day > maxDay) return { valid: false, reason: "BIRTH_DATE" }

  const serial = Number(nik.slice(12, 16))
  if (serial < 1 || serial > 9999) return { valid: false, reason: "SERIAL" }

  return { valid: true, encodedGender }
}

/**
 * Pesan penolakan per alasan (Bahasa Indonesia — konsisten dengan copy KYC).
 * Dipisah dari validator supaya mudah diterjemahkan kamus i18n.
 */
export function nikRejectionMessage(reason: NonNullable<NikValidation["reason"]>): string {
  switch (reason) {
    case "LENGTH":
      return "NIK harus terdiri dari 16 digit."
    case "NOT_DIGITS":
      return "NIK hanya boleh berisi angka."
    case "PROVINCE":
      return "Kode wilayah NIK tidak dikenali. Periksa kembali angka NIK Anda."
    case "BIRTH_DATE":
      return "Tanggal lahir yang terkandung di NIK tidak valid. Periksa kembali angka NIK Anda."
    case "SERIAL":
      return "Nomor urut NIK tidak valid. Periksa kembali angka NIK Anda."
  }
}
