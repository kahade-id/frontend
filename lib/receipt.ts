/**
 * Kahade — utilitas struk tiket ("momen uang").
 *
 * Dipakai `components/receipt/ReceiptTicket.tsx` dan layar-layar yang
 * menampilkannya (detail mutasi, transfer, top-up, penarikan, order).
 *
 * Prinsip defensif (backend dikerjakan tim lain):
 *   - `fetchReceiptToken()` TIDAK pernah melempar — endpoint belum ada /
 *     gagal = tiket dirender TANPA QR, bukan crash dan bukan blokir.
 *   - `receiptQrDataUrl()` mengembalikan `null` bila encode gagal.
 */

import type * as QRCodeModule from "qrcode"
// N1-004 (PERF): JANGAN impor statis entry utama `qrcode` di sini.
// Entry itu di-resolve Metro via field `browser` ke lib/browser.js yang
// ikut menarik renderer canvas/svg ke chunk struk — padahal `toDataURL()`
// hanya dibutuhkan saat struk benar-benar dirender (route-level, bukan
// boot). Modul dimuat lazy pada pemakaian pertama dan di-cache.
// (ST-008: core `qrcode/lib/core/qrcode` tidak cukup — butuh `toDataURL()`,
// renderer canvas yang hanya bermakna di web; di native selalu gagal dan
// mengembalikan null, sesuai kontrak defensif di bawah.)
let qrCodeModulePromise: Promise<typeof QRCodeModule> | null = null
function loadQrCodeModule(): Promise<typeof QRCodeModule> {
  if (!qrCodeModulePromise) qrCodeModulePromise = import("qrcode")
  return qrCodeModulePromise
}

import { http } from "@/lib/api/client"
import { formatDate, formatTime, WIB_TIME_ZONE } from "@/lib/format"

/** Status yang bisa ditampilkan struk tiket (kosakata struk, bukan enum backend). */
export type ReceiptStatus = "SUCCESS" | "PENDING" | "FAILED" | "REFUND"

/** Jenis referensi untuk `POST /v1/receipts/token`. */
export type ReceiptKind = "WALLET_TX" | "TRANSFER" | "ORDER_PAYMENT" | "TOPUP" | "WITHDRAWAL"

export const RECEIPT_STATUS_LABEL: Record<ReceiptStatus, string> = {
  SUCCESS: "BERHASIL",
  PENDING: "DIPROSES",
  FAILED: "GAGAL",
  REFUND: "REFUND",
}

/**
 * ID transaksi unik untuk tampilan bila tidak ada ID server yang cocok,
 * mis. transfer yang `txId`-nya kosong. Format: `KHD-<base36 waktu>-<acak 6>`.
 */
export function makeReceiptId(now: number = Date.now()): string {
  const time = Math.max(0, Math.floor(now)).toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")
  return `KHD-${time}-${rand}`
}

export type ReceiptTokenResult = {
  token: string
  verifyUrl: string
}

type ReceiptTokenBody = {
  kind: ReceiptKind
  referenceId: string
}

/**
 * Minta token verifikasi struk ke backend.
 *
 * Defensif: `null` bila endpoint belum ada / respons tak berbentuk / gagal —
 * pemanggil merender tiket tanpa QR.
 */
export async function fetchReceiptToken(
  kind: ReceiptKind,
  referenceId: string,
  signal?: AbortSignal,
): Promise<ReceiptTokenResult | null> {
  if (!referenceId) return null
  try {
    const res = await http.post<ReceiptTokenResult, ReceiptTokenBody>(
      "/v1/receipts/token",
      { kind, referenceId },
      { auth: "required", signal },
    )
    if (!res || typeof res.verifyUrl !== "string" || res.verifyUrl.length === 0) return null
    return { token: typeof res.token === "string" ? res.token : "", verifyUrl: res.verifyUrl }
  } catch {
    return null
  }
}

/**
 * Baris "Tanggal" + "Waktu" untuk struk — dua baris/field TERPISAH (bukan satu
 * gabungan), zona WIB eksplisit.
 *
 * Fail closed: nilai kosong/tidak valid = placeholder netral "—" (bukan angka
 * palsu, bukan label zona untuk data yang tidak ada).
 */
export function receiptDateRows(
  d: Date | number | string | null | undefined,
): Array<{ label: string; value: string }> {
  if (d == null || d === "") {
    return [
      { label: "Tanggal", value: "—" },
      { label: "Waktu", value: "—" },
    ]
  }
  const time = formatTime(d, { timeZone: WIB_TIME_ZONE })
  return [
    { label: "Tanggal", value: formatDate(d, { long: true, timeZone: WIB_TIME_ZONE }) },
    { label: "Waktu", value: time === "—" ? "—" : `${time} WIB` },
  ]
}

/**
 * Encode payload QR (verifyUrl) menjadi data URL PNG.
 * `null` bila encode gagal — tiket tetap dirender tanpa QR.
 */
export async function receiptQrDataUrl(payload: string): Promise<string | null> {
  if (!payload) return null
  try {
    const QRCode = await loadQrCodeModule()
    return await QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 320,
    })
  } catch {
    return null
  }
}
