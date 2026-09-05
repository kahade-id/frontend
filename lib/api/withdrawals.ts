import { readList } from "@/lib/api/response"
/**
 * Kahade — domain `withdrawals` (jadwal penarikan otomatis).
 */
import { http, seg } from "@/lib/api/client"
import type { CreateScheduleDto, UpdateScheduleDto } from "@/lib/api/types"

/** Rekening tujuan pada jadwal (denormalisasi dari BankAccount). */
export type ScheduleBankAccount = {
  id: string
  bankName: string
  bankCode?: string
  accountNumber: string
  accountName: string
}

/** Satu jadwal penarikan — UNVERIFIED. */
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

export function listWithdrawalSchedules() {
  return http
    .get<WithdrawalSchedule[]>("/v1/withdrawals/schedules", { auth: "required", retry: 1 })
    .then((raw) => readList<WithdrawalSchedule>(raw, ["schedules"]))
}

export function createWithdrawalSchedule(dto: CreateScheduleDto) {
  return http.post<WithdrawalSchedule, CreateScheduleDto>("/v1/withdrawals/schedules", dto, {
    auth: "required",
  })
}

export function updateWithdrawalSchedule(id: string, dto: UpdateScheduleDto) {
  return http.put<WithdrawalSchedule, UpdateScheduleDto>(
    `/v1/withdrawals/schedules/${seg(id)}`,
    dto,
    {
      auth: "required",
    },
  )
}

export function deleteWithdrawalSchedule(id: string) {
  return http.delete<void>(`/v1/withdrawals/schedules/${seg(id)}`, {
    auth: "required",
    responseType: "void",
  })
}
