/**
 * Payload PUT /v1/users/me/showcase/:id dari editor "Ubah detail"
 * (audit etalase 2026-10-10, CR-07 & CR-08).
 *
 * CR-07 — editor detail TIDAK mengirim `media[]`/`imageFileKeys`. PUT dengan
 * `media` adalah REPLACE penuh; mengirim snapshot media saat sheet dibuka
 * menghapus foto yang ditambah dari perangkat lain dan memaksa server
 * memvalidasi ulang fileKey (UPLOAD_NOT_CONFIRMED → simpan dua kali). Media
 * dikelola lewat sheet "Kelola foto" (attach/delete/reorder) — bukan di sini.
 *
 * CR-08 — `visibility` hanya dikirim bila nilainya DIKETAHUI dari server
 * ("PUBLIC"/"PRIVATE") atau pengguna mengubah sakelar. Respons tanpa field
 * visibility (klien lama/cache) dulu ditulis balik sebagai PRIVATE hanya karena
 * pengguna mengganti judul.
 */
import type { UpdateShowcaseItemDto } from "@/lib/api/types"

export type ShowcaseEditForm = {
  title: string
  description: string
  priceMin: number | null
  priceMax: number | null
  category: string
  isPublic: boolean
  condition: "" | "BARU" | "BEKAS"
}

export type ShowcaseVisibilityMeta = {
  /** Nilai untuk sakelar (fail-closed: tak dikenal = privat di layar). */
  isPublic: boolean
  /** `true` hanya bila server mengirim "PUBLIC"/"PRIVATE". */
  known: boolean
}

export function visibilityFromRaw(raw: unknown): ShowcaseVisibilityMeta {
  if (raw === "PUBLIC") return { isPublic: true, known: true }
  if (raw === "PRIVATE") return { isPublic: false, known: true }
  // SH-F-011: nilai asing/absen tampil sebagai privat, tetapi (CR-08) TIDAK
  // ditulis balik ke server kecuali pengguna sendiri menggeser sakelar.
  return { isPublic: false, known: false }
}

export function buildShowcaseUpdatePayload(input: {
  title: string
  form: ShowcaseEditForm
  initialVisibility: ShowcaseVisibilityMeta
  /** Kahade+: deskripsi HTML disanitasi SEBELUM dikirim. */
  sanitizeDescription?: (html: string) => string
}): UpdateShowcaseItemDto {
  const { title, form, initialVisibility, sanitizeDescription } = input
  /*
   * Harga minimum TANPA maksimum = HARGA PASTI (2026-09-26): penjual yang
   * menetapkan satu harga hanya mengisi kolom pertama; menyimpannya apa adanya
   * membuat kartu menampilkan "Mulai Rp 100.000" seolah batas bawah.
   */
  const priceMin = form.priceMin ?? undefined
  const priceMax = form.priceMax ?? (form.priceMin != null ? form.priceMin : undefined)
  const description = form.description.trim()
  const visibilityTouched = form.isPublic !== initialVisibility.isPublic
  return {
    title,
    description: sanitizeDescription ? sanitizeDescription(description) : description,
    priceMin,
    priceMax,
    category: form.category.trim().replace(/\s+/g, " "),
    ...(initialVisibility.known || visibilityTouched
      ? { visibility: form.isPublic ? ("PUBLIC" as const) : ("PRIVATE" as const) }
      : null),
    // Item 53: hanya kirim bila dipilih — backend opsional & case-insensitive.
    ...(form.condition === "BARU" || form.condition === "BEKAS" ? { condition: form.condition } : null),
  }
}
