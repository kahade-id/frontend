/**
 * Kahade — domain `withdrawals` (jadwal penarikan otomatis).
 *
 * Prefix endpoint: `/v1/scheduled-withdrawals/schedules*` (prefix baru backend,
 * diumumkan sebagai alias dari `/v1/withdrawals/schedules*` yang lama). App
 * sudah bermigrasi ke prefix baru; alias lama bisa dihapus backend tanpa
 * mem-break aplikasi.
 */

import { readList } from "@/lib/api/response"

import { http, seg } from "@/lib/api/client"
import type { CreateScheduleDto, UpdateScheduleDto } from "@/lib/api/types"

/** Rekening tujuan pada jadwal (denormalisasi dari BankAccount — kontrak backend). */
export type ScheduleBankAccount = {
  id: string
  bankName: string
  bankCode?: string
  /** Nomor tersamar "****1234" — backend TIDAK PERNAH mengirim nomor mentah. */
  maskedAccountNumber: string
  accountName: string
}

/** Satu jadwal penarikan. */
export type WithdrawalSchedule = {
  id: string
  dayOfWeek: number
  minAmount: number | null
  isActive: boolean
  bankAccount: ScheduleBankAccount
  nextRunAt?: string | null
  lastRunAt?: string | null
  createdAt: string
}

/**
 * DRIFT-01/02 (fix 2026-09-26): normalizer kontrak jadwal.
 * Backend mengirim `bankAccount` nested (bukan flat `bankAccountId`),
 * `lastRunAt` (fallback: `lastExecutedAt` warisan), dan `nextRunAt` (ISO).
 */
function normalizeWithdrawalSchedule(raw: unknown): WithdrawalSchedule {
  const r = (raw ?? {}) as Record<string, unknown>
  const bank = (r.bankAccount ?? {}) as Record<string, unknown>
  const str = (v: unknown): string => (typeof v === "string" ? v : "")
  return {
    id: str(r.id),
    dayOfWeek: typeof r.dayOfWeek === "number" ? r.dayOfWeek : 0,
    minAmount: typeof r.minAmount === "number" ? r.minAmount : null,
    isActive: r.isActive === true,
    bankAccount: {
      id: str(bank.id) || str(r.bankAccountId),
      bankName: str(bank.bankName),
      bankCode: typeof bank.bankCode === "string" ? bank.bankCode : undefined,
      maskedAccountNumber:
        typeof bank.maskedAccountNumber === "string"
          ? bank.maskedAccountNumber
          : str(bank.accountNumber),
      accountName: str(bank.accountName),
    },
    nextRunAt: typeof r.nextRunAt === "string" ? r.nextRunAt : null,
    lastRunAt:
      typeof r.lastRunAt === "string"
        ? r.lastRunAt
        : typeof r.lastExecutedAt === "string"
          ? r.lastExecutedAt
          : null,
    createdAt: str(r.createdAt),
  }
}

export function listWithdrawalSchedules(signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/scheduled-withdrawals/schedules", { auth: "required", retry: 1, signal })
    .then((raw) => readList<unknown>(raw, ["schedules"]).map(normalizeWithdrawalSchedule))
}

export function createWithdrawalSchedule(dto: CreateScheduleDto) {
  return http
    .post<unknown, CreateScheduleDto>("/v1/scheduled-withdrawals/schedules", dto, {
      auth: "required",
    })
    .then(normalizeWithdrawalSchedule)
}

export function updateWithdrawalSchedule(id: string, dto: UpdateScheduleDto) {
  return http
    .put<unknown, UpdateScheduleDto>(
      `/v1/scheduled-withdrawals/schedules/${seg(id)}`,
      dto,
      {
        auth: "required",
      },
    )
    .then(normalizeWithdrawalSchedule)
}

export function deleteWithdrawalSchedule(id: string) {
  return http.delete<void>(`/v1/scheduled-withdrawals/schedules/${seg(id)}`, {
    auth: "required",
    responseType: "void",
  })
}
