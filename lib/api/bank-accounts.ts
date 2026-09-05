import { readList } from "@/lib/api/response"
/**
 * Kahade — domain `bank-accounts` (tag "bank-accounts").
 *
 * Rekening bank user: list, tambah, hapus, set utama. Semua endpoint
 * `security: access-token` → `auth: "required"`. Tipe response UNVERIFIED.
 */
import { http, seg } from "@/lib/api/client"
import type { AddBankAccountDto } from "@/lib/api/types"

/** Satu rekening bank — UNVERIFIED (spec tanpa response schema). */
export type BankAccount = {
  id: string
  bankCode: string
  bankName: string
  accountNumber: string
  accountName: string
  isPrimary: boolean
  isVerified?: boolean
  createdAt?: string
}

export function listBankAccounts() {
  return http
    .get<BankAccount[]>("/v1/bank-accounts", { auth: "required", retry: 1 })
    .then((raw) => readList<BankAccount>(raw, ["bankAccounts", "accounts"]))
}

export function addBankAccount(dto: AddBankAccountDto) {
  return http.post<BankAccount, AddBankAccountDto>("/v1/bank-accounts", dto, { auth: "required" })
}

export function deleteBankAccount(id: string) {
  return http.delete<void>(`/v1/bank-accounts/${seg(id)}`, {
    auth: "required",
    responseType: "void",
  })
}

export function setPrimaryBankAccount(id: string) {
  return http.post<BankAccount>(`/v1/bank-accounts/${seg(id)}/set-primary`, undefined, {
    auth: "required",
  })
}
