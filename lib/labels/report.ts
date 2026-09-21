/**
 * Kahade — SATU sumber label & opsi laporan (G-13 audit 2026-09-20).
 *
 * Sebelumnya ada lima implementasi "alasan laporan" dengan enum berbeda:
 * report-form (SCAM/HARASSMENT/…), sheet inline discover (SPAM/INAPPROPRIATE/
 * HARASSMENT/OTHER), showcase/[id], questions, user/[username] — dan enum
 * backend `ReportUserDto.category` (FRAUD/FAKE_IDENTITY/…). Nilai UI yang
 * tidak dipetakan bisa terkirim mentah ke endpoint yang mengharapkan enum
 * backend (400 / kategori tak dikenal moderasi).
 *
 * Kontrak per endpoint (sumber: lib/api/constraints.ts + adapter):
 *   - POST /v1/users/{id}/report & /v1/settings/report → `category` =
 *     enum ReportUserDto (WAJIB dipetakan lewat `reportReasonToCategory`).
 *   - POST /v1/showcase/{id}/report → `reason` string bebas di spec; kita
 *     kirim nilai `CONTENT_REPORT_REASONS` (set moderasi konten).
 *   - POST /v1/questions/{id}/hide & /v1/users/qa/comments/{id}/hide →
 *     `reason` = HiddenReason (SPAM/INAPPROPRIATE/HARASSMENT/OTHER) — set
 *     yang sama dengan CONTENT_REPORT_REASONS.
 *
 * Semua daftar di sini `as const` + tipe kunci Record sehingga alasan baru
 * tanpa padanan kategori gagal di `tsc`, bukan 400 di produksi.
 */
import type { ReportUserSettingsDto } from "@/lib/api/types"

// ------------------------------------------------------------------
// Laporan pengguna/konten ke endpoint `category` (enum backend)
// ------------------------------------------------------------------

export type UserReportReason =
  | "SCAM"
  | "HARASSMENT"
  | "FAKE_ACCOUNT"
  | "INAPPROPRIATE_CONTENT"
  | "SPAM"
  | "OTHER"

export type ReportReasonOption = {
  value: UserReportReason | string
  label: string
  description?: string
}

export const USER_REPORT_REASONS: readonly ReportReasonOption[] = [
  { value: "SCAM", label: "Penipuan", description: "Meminta pembayaran di luar escrow atau tidak mengirim barang" },
  { value: "HARASSMENT", label: "Pelecehan", description: "Kata-kata kasar, ancaman, atau intimidasi" },
  { value: "FAKE_ACCOUNT", label: "Akun palsu", description: "Mengaku sebagai orang atau bisnis lain" },
  { value: "INAPPROPRIATE_CONTENT", label: "Konten tidak pantas", description: "Gambar atau teks yang melanggar aturan" },
  { value: "SPAM", label: "Spam", description: "Pesan berulang atau promosi tidak diminta" },
  { value: "OTHER", label: "Lainnya", description: "Jelaskan di kolom detail" },
]

/**
 * Peta alasan UI → enum API `category`. Tipe kunci `UserReportReason`
 * memaksa setiap alasan punya padanan; `MONEY_LAUNDERING` sengaja tidak
 * ditawarkan di UI (enum backend boleh lebih luas) dan `OTHER` menjadi
 * jaring pengaman `mapValue`.
 */
export const REPORT_REASON_TO_CATEGORY: Record<UserReportReason, ReportUserSettingsDto["category"]> = {
  SCAM: "FRAUD",
  HARASSMENT: "TNC_VIOLATION",
  FAKE_ACCOUNT: "FAKE_IDENTITY",
  INAPPROPRIATE_CONTENT: "INAPPROPRIATE_CONTENT",
  SPAM: "SPAM",
  OTHER: "OTHER",
}

/** Label kategori backend untuk daftar riwayat laporan (GET /v1/settings/reports). */
export const REPORT_CATEGORY_LABELS: Record<string, string> = {
  FRAUD: "Penipuan",
  FAKE_IDENTITY: "Identitas palsu",
  INAPPROPRIATE_CONTENT: "Konten tidak pantas",
  TNC_VIOLATION: "Pelanggaran ketentuan",
  MONEY_LAUNDERING: "Pencucian uang",
  SPAM: "Spam",
  OTHER: "Lainnya",
}

// ------------------------------------------------------------------
// Moderasi konten (showcase / pertanyaan / komentar) — HiddenReason
// ------------------------------------------------------------------

/** Nilai yang diterima endpoint hide/report konten (`lib/api/users.ts` HiddenReason). */
export type ContentReportReason = "SPAM" | "INAPPROPRIATE" | "HARASSMENT" | "OTHER"

export const CONTENT_REPORT_REASONS: readonly ReportReasonOption[] = [
  { value: "SPAM", label: "Spam", description: "Link/jualan tidak relevan" },
  { value: "INAPPROPRIATE", label: "Tidak pantas", description: "Konten menyinggung" },
  { value: "HARASSMENT", label: "Perundungan", description: "Ancaman/pelecehan" },
  { value: "OTHER", label: "Lainnya", description: "Jelaskan di kolom detail" },
]
