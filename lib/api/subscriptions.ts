/**
 * Kahade — domain `subscriptions` (paket premium bulanan/tahunan).
 */

import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { assertDtoConstraints } from "@/lib/financial"

import { http } from "@/lib/api/client"
import type { RenewDto, SubscribeDto } from "@/lib/api/types"
import { ApiError } from "@/lib/api/errors"
import { invalidResponse, readList } from "@/lib/api/response"

export type { SubscriptionPlan } from "@/lib/api/public-contract"
import { normalizeSubscriptionPlans } from "@/lib/api/public-contract"

/** Status langganan aktif — UNVERIFIED. */
export type SubscriptionStatus = {
  active: boolean
  plan?: string
  expiresAt?: string | null
  autoRenew?: boolean
  /** `POST /v1/subscriptions/pause` → status server PAUSED. */
  paused?: boolean
  pausedAt?: string | null
  /** Auto-resume date (jika pause dikirim `resumeAt`). */
  resumeAt?: string | null
  /** Enum status server (ACTIVE/PAUSED/SUSPENDED/CANCELLED/…) */
  status?: string
}

export type SubscriptionHistoryEntry = {
  id: string
  plan: string
  amount: number
  status: string
  createdAt: string
  expiresAt?: string | null
}

export function getSubscriptionStatus(signal?: AbortSignal) {
  return http.get<Record<string, unknown>>("/v1/subscriptions/status", { auth: "required", retry: 1, signal }).then((raw) => ({
    ...raw,
    active: raw.active ?? raw.isActive ?? false,
    expiresAt: raw.expiresAt ?? raw.currentPeriodEnd ?? null,
    autoRenew: raw.autoRenew ?? raw.isAutoRenew ?? false,
    // Backend mengirim `isPaused`/`pausedAt`/`resumeAt` (model Subscription);
    // kita menormalisasi ke `paused` agar layar tidak menebak bentuk server.
    paused: raw.paused ?? raw.isPaused ?? false,
    pausedAt: (raw.pausedAt ?? null) as string | null,
    resumeAt: (raw.resumeAt ?? null) as string | null,
  }) as SubscriptionStatus)
}

export function getSubscriptionHistory(query?: { page?: number; limit?: number }) {
  return http
    .get<Array<SubscriptionHistoryEntry>>("/v1/subscriptions/history", {
      query,
      auth: "required",
      retry: 1,
    })
    .then((raw) => readList<SubscriptionHistoryEntry>(raw, ["history", "subscriptions"]))
}

export type SubscriptionBenefit = { key: string; title: string; description?: string }

export function normalizeSubscriptionBenefit(value: unknown): SubscriptionBenefit | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const title = row.title ?? row.label
  if (typeof row.key !== "string" || typeof title !== "string") return null
  return {
    key: row.key,
    title,
    description: typeof row.description === "string" ? row.description : undefined,
  }
}

export function getSubscriptionBenefits(signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/subscriptions/benefits", { auth: "required", retry: 1, signal })
    .then((raw) =>
      readList<unknown>(raw, ["benefits"])
        .map(normalizeSubscriptionBenefit)
        .filter((row): row is SubscriptionBenefit => row !== null),
    )
    .catch((error: unknown) => {
      if (
        error &&
        typeof error === "object" &&
        (("backendCode" in error && error.backendCode === "NO_ACTIVE_SUBSCRIPTION") ||
          ("code" in error && error.code === "NOT_FOUND"))
      )
        return []
      throw error
    })
}

export function getSubscriptionPlans(signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/subscriptions/plans", { auth: "required", retry: 1, signal })
    .then(normalizeSubscriptionPlans)
}

export function subscribe(dto: SubscribeDto) {
  assertDtoConstraints(dto, API_CONSTRAINTS.SubscribeDto)
  return http.post<SubscriptionStatus, SubscribeDto>("/v1/subscriptions/subscribe", dto, {
    auth: "required",
  })
}

export function renewSubscription(dto: RenewDto) {
  return http.post<SubscriptionStatus, RenewDto>("/v1/subscriptions/renew", dto, {
    auth: "required",
  })
}

export function cancelSubscription() {
  return http.post<SubscriptionStatus>("/v1/subscriptions/cancel", undefined, { auth: "required" })
}

/**
 * POST /v1/subscriptions/pause — jeda langganan aktif.
 * `resumeAtIso` opsional (ISO 8601, harus tanggal MASA DEPAN); tanpa itu
 * langganan tetap jeda sampai `resumeSubscription()` manual.
 * Respons = model Subscription server (BUKAN bentuk /status) — layar
 * harus `query.refresh()` setelahnya, jangan `setData` mentah-mentah.
 */
export function pauseSubscription(resumeAtIso?: string) {
  return http.post<Record<string, unknown>, { resumeAt?: string }>(
    "/v1/subscriptions/pause",
    { ...(resumeAtIso ? { resumeAt: resumeAtIso } : {}) },
    { auth: "required" },
  )
}

/** POST /v1/subscriptions/resume — aktifkan kembali langganan yang dijeda. Tanpa body. */
export function resumeSubscription() {
  return http.post<Record<string, unknown>>("/v1/subscriptions/resume", undefined, {
    auth: "required",
  })
}

/**
 * POST /v1/subscriptions/upgrade — ganti paket dengan proration (11.1).
 * `newPlan` = key paket server ("MONTHLY" | "ANNUAL"); `pin` = PIN dompet
 * (biaya prorasi dipotong dari saldo). Dipagari KycRequiredGuard di backend.
 * Respons = objek hasil upgrade (bukan bentuk /status) → `query.refresh()`.
 */
export function upgradeSubscription(dto: { newPlan: "MONTHLY" | "ANNUAL"; pin: string }) {
  return http.post<Record<string, unknown>, { newPlan: "MONTHLY" | "ANNUAL"; pin: string }>(
    "/v1/subscriptions/upgrade",
    dto,
    { auth: "required" },
  )
}

// ============================================================================
// Kahade+ — KONTRAK API BARU (tetap, prefix https://api.kahade.id/v1).
//
// Fungsi-fungsi di bawah mengikuti kontrak yang ditetapkan tim backend dan
// SENGAJA tidak memakai ulang normalizer lama (normalizeSubscriptionPlans):
// kontrak lama memakai key "ANNUAL" + field `name`, kontrak baru memakai key
// "YEARLY" + field `label`. Jangan mencampur keduanya.
// ============================================================================

/** Kunci paket pada kontrak Kahade+ baru (bukan "ANNUAL" seperti kontrak lama). */
export type KahadePlusPlanKey = "MONTHLY" | "YEARLY"

/** GET /v1/subscriptions/me — status langganan pemegang token. */
export type KahadePlusStatus = {
  isActive: boolean
  plan: KahadePlusPlanKey | null
  status: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  /** True bila user membatalkan tapi benefit masih berjalan sampai currentPeriodEnd. */
  cancelAtPeriodEnd: boolean
  /** Rupiah biaya layanan yang sudah digratiskan pada periode berjalan. */
  feeWaivedThisPeriod: number
  /** Batas kuota gratis biaya layanan per periode (IDR). */
  feeWaiverLimit: number
  /**
   * Dihitung backend: true bila langganan aktif DAN KYC lengkap. Frontend
   * WAJIB memakai nilai ini apa adanya — jangan menghitung ulang KYC di sini.
   */
  showGreyBadge: boolean
  earlyAccess: { patungan: boolean; "split-bill": boolean }
}

export const INACTIVE_KAHADE_PLUS: KahadePlusStatus = {
  isActive: false,
  plan: null,
  status: null,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  feeWaivedThisPeriod: 0,
  feeWaiverLimit: 0,
  showGreyBadge: false,
  earlyAccess: { patungan: false, "split-bill": false },
}

function asKahadePlusPlanKey(value: unknown): KahadePlusPlanKey | null {
  return value === "MONTHLY" || value === "YEARLY" ? value : null
}

function asNonNegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0
}

function asIsoString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

/** Normalisasi respons GET /v1/subscriptions/me — field hilang = default aman. */
export function normalizeKahadePlusStatus(raw: unknown): KahadePlusStatus {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw invalidResponse("kahade-plus-me")
  const row = raw as Record<string, unknown>
  const early = (row.earlyAccess ?? {}) as Record<string, unknown>
  return {
    isActive: row.isActive === true,
    plan: asKahadePlusPlanKey(row.plan),
    status: typeof row.status === "string" ? row.status : null,
    currentPeriodStart: asIsoString(row.currentPeriodStart),
    currentPeriodEnd: asIsoString(row.currentPeriodEnd),
    cancelAtPeriodEnd: row.cancelAtPeriodEnd === true,
    feeWaivedThisPeriod: asNonNegativeNumber(row.feeWaivedThisPeriod),
    feeWaiverLimit: asNonNegativeNumber(row.feeWaiverLimit),
    showGreyBadge: row.showGreyBadge === true,
    earlyAccess: {
      patungan: early.patungan === true,
      "split-bill": early["split-bill"] === true,
    },
  }
}

export function getKahadePlusMe(signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/subscriptions/me", { auth: "required", retry: 1, signal })
    .then(normalizeKahadePlusStatus)
}

/** Satu baris GET /v1/subscriptions/plans (publik). */
export type KahadePlusPlan = {
  plan: KahadePlusPlanKey
  label: string
  price: number
  durationDays: number
}

/** Normalisasi GET /v1/subscriptions/plans — baris tak dikenal dibuang. */
export function normalizeKahadePlusPlans(raw: unknown): KahadePlusPlan[] {
  return readList<unknown>(raw, ["plans"]).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return []
    const row = item as Record<string, unknown>
    const plan = asKahadePlusPlanKey(row.plan)
    if (
      plan === null ||
      typeof row.label !== "string" ||
      typeof row.price !== "number" ||
      !Number.isFinite(row.price) ||
      row.price < 0 ||
      typeof row.durationDays !== "number" ||
      !Number.isFinite(row.durationDays) ||
      row.durationDays <= 0
    )
      return []
    return [{ plan, label: row.label, price: row.price, durationDays: row.durationDays }]
  })
}

/** GET /v1/subscriptions/plans — publik; auth:"optional" supaya tamu bisa melihat harga. */
export function getKahadePlusPlans(signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/subscriptions/plans", { auth: "optional", retry: 1, signal })
    .then(normalizeKahadePlusPlans)
}

/** Body POST /v1/subscriptions/subscribe — kontrak baru: hanya plan + PIN. */
export type KahadePlusSubscribeDto = { plan: KahadePlusPlanKey; pin: string }

function assertKahadePlusSubscribeDto(dto: KahadePlusSubscribeDto): void {
  if (dto.plan !== "MONTHLY" && dto.plan !== "YEARLY")
    throw new ApiError({ code: "VALIDATION", message: "Paket tidak dikenal." })
  if (!/^\d{6}$/.test(dto.pin))
    throw new ApiError({ code: "VALIDATION", message: "PIN dompet harus 6 digit angka." })
}

/**
 * POST /v1/subscriptions/subscribe { plan, pin } — pin = PIN dompet 6 digit,
 * TIDAK butuh KYC. Biaya dipotong dari saldo dompet. Respons = status baru.
 */
export function subscribeKahadePlus(dto: KahadePlusSubscribeDto) {
  assertKahadePlusSubscribeDto(dto)
  return http
    .post<unknown, KahadePlusSubscribeDto>("/v1/subscriptions/subscribe", dto, {
      auth: "required",
    })
    .then(normalizeKahadePlusStatus)
}

/** POST /v1/subscriptions/cancel — tanpa body. Benefit tetap aktif sampai akhir periode. Respons = status baru. */
export function cancelKahadePlus() {
  return http
    .post<unknown>("/v1/subscriptions/cancel", undefined, { auth: "required" })
    .then(normalizeKahadePlusStatus)
}

/** POST /v1/subscriptions/reactivate — batalkan pembatalan sebelum periode berakhir. */
export function reactivateKahadePlus() {
  return http
    .post<unknown>("/v1/subscriptions/reactivate", undefined, { auth: "required" })
    .then(normalizeKahadePlusStatus)
}

/** QRIS subscription payment (Flash Mobile). */
export interface QrisSubscribeResult {
  subscriptionId: string;
  subscription: SubscriptionStatus;
  qrString: string;
  expiredAt: string;
  flashTransactionId: string;
}

/** POST /v1/subscriptions/subscribe-qris — buat pembayaran QRIS, kembalikan qrString untuk dirender. PIN wajib. */
export function subscribeQrisKahadePlus(dto: SubscribeDto) {
  assertDtoConstraints(dto, API_CONSTRAINTS.SubscribeDto)
  return http.post<QrisSubscribeResult, SubscribeDto>("/v1/subscriptions/subscribe-qris", dto, {
    auth: "required",
  })
}

/** GET /v1/subscriptions/qris-status/:id — polling status pembayaran QRIS (PENDING/ACTIVE). */
export function getQrisPaymentStatus(subscriptionId: string) {
  return http.get<{ status: string; qrString: string | null; expiredAt: string | null }>(
    `/v1/subscriptions/qris-status/${encodeURIComponent(subscriptionId)}`,
    { auth: "required" },
  )
}
