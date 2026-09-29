/**
 * Kahade — domain `subscriptions` (paket premium bulanan/tahunan).
 */

import { http } from "@/lib/api/client"
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

// DIHAPUS (Mode Tanpa Wallet Internal, BI-safe): `POST /v1/subscriptions/subscribe`
// era-dompet (PIN) diganti alur DANA — lihat lib/api/subscription-payments.ts
// + lib/use-subscription-payment.ts. Jangan hidupkan kembali tanpa kontrak baru.

// DIHAPUS (Mode Tanpa Wallet Internal, BI-safe): `POST /v1/subscriptions/renew`
// memakai PIN dompet. Perpanjangan kini = langganan ulang via paket
// (app/kahade-plus/plans.tsx) yang dibayar langsung via DANA.

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

// DIHAPUS (Mode Tanpa Wallet Internal, BI-safe): `POST /v1/subscriptions/upgrade`
// memotong biaya prorasi dari saldo dompet + PIN. Ganti paket kini lewat
// langganan ulang di app/kahade-plus/plans.tsx (DANA, tanpa saldo/PIN).

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

// DIHAPUS (Mode Tanpa Wallet Internal, BI-safe): `POST /v1/subscriptions/subscribe`
// { plan, pin } — biaya dipotong dari saldo dompet. Diganti alur DANA
// (lib/api/subscription-payments.ts + lib/use-subscription-payment.ts).

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

// DIHAPUS (Mode Tanpa Wallet Internal, BI-safe): `POST /v1/subscriptions/subscribe-qris`
// + `GET /v1/subscriptions/qris-status/:id` (Flash Mobile) — provider lama.
// Pembayaran langganan kini via DANA (lib/api/subscription-payments.ts).

