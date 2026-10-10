/**
 * Kahade — helper murni batch 139 area D (Dompet & Transaksi).
 *
 * UI-only, fail-closed. Tidak menyentuh logika uang/escrow/ledger — hanya
 * keputusan presentasi yang bisa diuji tanpa render.
 */
import { translate } from "@/lib/i18n/translate"

/** D04: hasil lookup ulang penerima transfer. */
export type RevalidatedRecipient =
  | { valid: true; name: string }
  | { valid: false }

/**
 * D04 (batch 139): cocokkan hasil lookup ulang dengan penerima terpilih.
 *
 * Identifier (id) adalah kunci — bukan username/nama yang bisa berubah.
 * - Tidak ada entri dengan id yang sama → `{ valid: false }`: pemanggil
 *   WAJIB membuang pilihan dan kembali ke langkah pilih penerima
 *   (fail-closed — jangan kirim ke penerima yang belum tervalidasi).
 * - Ada → `{ valid: true, name }` dengan nama TERBARU dari server
 *   (fullName bila ada, kalau tidak username). Nama tampilan yang basi
 *   diperbarui, bukan dibiarkan.
 */
export function resolveRevalidatedRecipient(
  results: ReadonlyArray<{ id: string; username: string; fullName?: string | null }>,
  selected: { id: string; name: string },
): RevalidatedRecipient {
  const match = results.find((r) => r.id === selected.id)
  if (!match) return { valid: false }
  return { valid: true, name: match.fullName || match.username || selected.name }
}

/**
 * D05 (batch 139): alasan chip nominal cepat dinonaktifkan.
 *
 * Mengembalikan teks alasan bila ADA chip yang melebihi `max` (dan keypad
 * tidak disabled secara keseluruhan), selain itu `null`. `max` di pemanggil
 * = min(limit server, saldo tersedia), jadi pesan "melebihi batas" mencakup
 * kedua sebab tanpa menebak mana yang mengikat.
 */
export function disabledPresetReason(
  presets: ReadonlyArray<number> | undefined,
  max: number | undefined,
  disabled: boolean,
  formatMax: (value: number) => string,
): string | null {
  if (disabled || max == null || !presets || presets.length === 0) return null
  if (!presets.some((p) => p > max)) return null
  return `Nominal cepat di atas ${formatMax(max)} dinonaktifkan — melebihi batas`
}

/**
 * D03 (batch 139): apakah rincian saldo konsisten (tersedia + ditahan = total).
 *
 * Hanya true bila ketiga angka terdefinisi dan penjumlahan PAS — selain itu
 * pemanggil menampilkan label netral ("Jumlah seluruh dana di dompet Anda"),
 * bukan klaim konsistensi yang tidak terbukti.
 */
export function breakdownAddsUp(
  available: number | undefined,
  held: number,
  total: number | undefined,
): boolean {
  return (
    typeof available === "number" &&
    Number.isFinite(available) &&
    typeof total === "number" &&
    Number.isFinite(total) &&
    Number.isFinite(held) &&
    available + held === total
  )
}

/** D15 (batch 139): peran aktor order untuk alasan CTA. */
export type OrderActorRole139 = "BUYER" | "SELLER"

/**
 * D15 (batch 139): alasan tombol aksi tidak tersedia, diturunkan murni dari
 * status × peran — prasyarat yang bisa dijelaskan tanpa menebak (status pihak
 * lain, bukti kirim, tenggat). Sengaja TIDAK menyebut KYC/verifikasi akun:
 * klien tidak tahu status verifikasi di titik ini, jangan mengarang syarat.
 *
 * Mengembalikan daftar alasan (bisa kosong = tidak ada yang perlu
 * dijelaskan, mis. status terminal).
 */
export function ctaUnavailableReasons(
  status: string,
  role: OrderActorRole139 | undefined,
): string[] {
  switch (status) {
    case "WAITING_CONFIRMATION":
      return role === "BUYER"
        ? ["Menunggu penjual mengonfirmasi order — tombol bayar aktif setelah penjual menerima."]
        : []
    case "WAITING_PAYMENT":
    case "PENDING_PAYMENT":
      return role === "SELLER"
        ? ["Menunggu pembeli membayar ke Kahade — aksi penjual dibuka setelah pembayaran masuk."]
        : []
    case "PROCESSING":
      return role === "BUYER"
        ? ["Menunggu penjual mengisi nomor resi dan mengirim pesanan Anda."]
        : []
    case "IN_DELIVERY":
    case "SHIPPED":
    case "DELIVERED":
      return role === "SELLER"
        ? ["Menunggu pembeli mengonfirmasi penerimaan barang — atau dana cair otomatis saat tenggat habis."]
        : []
    case "DISPUTED":
      return ["Sengketa sedang ditangani tim Kahade — aksi transaksi dikunci sampai ada keputusan."]
    default:
      // COMPLETED / CANCELLED / REFUNDED / EXPIRED / tak dikenal: tidak ada
      // aksi yang ditunggu — jangan mengarang alasan.
      return []
  }
}

/** D16 (batch 139): hasil validasi format input pengiriman. */
export type TrackingValidation = {
  courierError?: string
  trackingError?: string
}

/**
 * D16 (batch 139): validasi format kurir + nomor resi SEBELUM disimpan.
 *
 * - Barang fisik (`physical=true`): keduanya wajib. Resi harus alfanumerik
 *   (boleh strip) 6–40 karakter — pola umum nomor resi kurir Indonesia;
 *   spasi di dalam resi hampir pasti salah ketik → ditolak dengan pesan
 *   yang menjelaskan, bukan diam-diam disimpan.
 * - Jasa/digital (`physical=false`): keduanya opsional; bila diisi tetap
 *   divalidasi formatnya (jangan simpan resi rusak "nanti saja").
 */
export function validateTrackingInput(
  courier: string,
  tracking: string,
  physical: boolean,
): TrackingValidation {
  const out: TrackingValidation = {}
  const c = courier.trim()
  const t = tracking.trim()
  if (physical) {
    if (c.length < 2) out.courierError = "Isi nama kurir (mis. JNE, SiCepat, J&T)."
  }
  if (t.length === 0) {
    if (physical) out.trackingError = "Nomor resi wajib diisi untuk barang fisik."
  } else if (!/^[A-Za-z0-9-]{6,40}$/.test(t)) {
    out.trackingError =
      "Format resi tidak valid — 6–40 karakter huruf/angka (boleh tanda -), tanpa spasi."
  }
  return out
}

/** D09 (batch 139): alamat pengiriman minimal untuk ringkasan checkout. */
export type CheckoutAddress = {
  label: string
  recipientName: string
  phone: string
  addressLine: string
  city: string
  postalCode: string
} | null

/**
 * D09 (batch 139): kelengkapan alamat aktif untuk checkout barang fisik.
 * Mengembalikan field yang kosong agar pemanggil bisa memberi peringatan
 * spesifik ("belum ada alamat" vs "kota belum diisi"), bukan vonis generik.
 */
export function addressMissingFields(address: CheckoutAddress): string[] {
  // Penanda "belum ada alamat sama sekali" — pemanggil membandingkan dengan
  // `ADDRESS_MISSING_ALL` (bukan string literal) agar tetap benar saat diterjemahkan.
  if (!address) return [ADDRESS_MISSING_ALL]
  const missing: string[] = []
  // C14 (audit alamat & kurir 2026-10-10): nama field lewat `translate` —
  // dulu disisipkan mentah (Indonesia) ke kalimat terjemahan "{x}".
  if (!address.label.trim()) missing.push(translate("label alamat"))
  if (!address.recipientName.trim()) missing.push(translate("nama penerima"))
  if (!address.phone.trim()) missing.push(translate("nomor HP penerima"))
  if (!address.addressLine.trim()) missing.push(translate("alamat jalan"))
  if (!address.city.trim()) missing.push(translate("kota tujuan"))
  if (!address.postalCode.trim()) missing.push(translate("kode pos"))
  return missing
}

/** Nilai tunggal yang dikembalikan `addressMissingFields(null)`. */
export const ADDRESS_MISSING_ALL = "alamat"

/**
 * D13 (batch 139): pisahkan kejadian TERBARU dari riwayat lama.
 *
 * Entri dianggap kronologis naik (terlama dulu — sesuai kontrak
 * <OrderHistoryTimeline>). Mengembalikan kejadian terakhir + hitungan
 * entri lama untuk label ekspander ("Lihat N kejadian sebelumnya").
 */
export function splitTimelineLatest<T>(entries: readonly T[]): {
  latest: T | null
  older: readonly T[]
} {
  if (entries.length === 0) return { latest: null, older: [] }
  return { latest: entries[entries.length - 1]!, older: entries.slice(0, -1) }
}
