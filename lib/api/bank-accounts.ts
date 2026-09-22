/**
 * Kahade — domain `bank-accounts` (tag "bank-accounts").
 *
 * Rekening bank user: list, tambah, hapus, set utama. Semua endpoint
 * `security: access-token` → `auth: "required"`. Tipe response UNVERIFIED.
 */

import { pickBoolean, pickString, readList } from "@/lib/api/response"

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

export async function listBankAccounts(signal?: AbortSignal) {
  const raw = await http.get<BankAccount[]>("/v1/bank-accounts", { auth: "required", retry: 1, signal });
  const accounts = readList<BankAccount>(raw, ["bankAccounts", "accounts", "bank_accounts"]);
  return accounts.map(account => ({
    ...account,
    bankCode: pickString(account, ["bankCode", "bank_code"]) ?? account.bankCode,
    bankName: pickString(account, ["bankName", "bank_name"]) ?? account.bankName,
    accountNumber: pickString(account, ["accountNumber", "account_number"]) ?? account.accountNumber,
    accountName: pickString(account, ["accountName", "account_name"]) ?? account.accountName,
    isPrimary: pickBoolean(account, ["isPrimary", "is_primary"]) ?? account.isPrimary,
    isVerified: pickBoolean(account, ["isVerified", "is_verified"]) ?? account.isVerified,
    createdAt: pickString(account, ["createdAt", "created_at"]) ?? account.createdAt,
  }))
}

export async function addBankAccount(dto: AddBankAccountDto) {
  const account = await http.post<BankAccount, AddBankAccountDto>("/v1/bank-accounts", dto, { auth: "required" })
  return {
    ...account,
    bankCode: pickString(account, ["bankCode", "bank_code"]) ?? account.bankCode,
    bankName: pickString(account, ["bankName", "bank_name"]) ?? account.bankName,
    accountNumber: pickString(account, ["accountNumber", "account_number"]) ?? account.accountNumber,
    accountName: pickString(account, ["accountName", "account_name"]) ?? account.accountName,
    isPrimary: pickBoolean(account, ["isPrimary", "is_primary"]) ?? account.isPrimary,
    isVerified: pickBoolean(account, ["isVerified", "is_verified"]) ?? account.isVerified,
    createdAt: pickString(account, ["createdAt", "created_at"]) ?? account.createdAt,
  }
}

export function deleteBankAccount(id: string) {
  return http.delete<void>(`/v1/bank-accounts/${seg(id)}`, {
    auth: "required",
    responseType: "void",
  })
}

export async function setPrimaryBankAccount(id: string) {
  const account = await http.post<BankAccount>(`/v1/bank-accounts/${seg(id)}/set-primary`, undefined, {
    auth: "required",
  })
  return {
    ...account,
    bankCode: pickString(account, ["bankCode", "bank_code"]) ?? account.bankCode,
    bankName: pickString(account, ["bankName", "bank_name"]) ?? account.bankName,
    accountNumber: pickString(account, ["accountNumber", "account_number"]) ?? account.accountNumber,
    accountName: pickString(account, ["accountName", "account_name"]) ?? account.accountName,
    isPrimary: pickBoolean(account, ["isPrimary", "is_primary"]) ?? account.isPrimary,
    isVerified: pickBoolean(account, ["isVerified", "is_verified"]) ?? account.isVerified,
    createdAt: pickString(account, ["createdAt", "created_at"]) ?? account.createdAt,
  }
}

/**
 * PATCH /v1/bank-accounts/{id} — edit rekening.
 * Backend HANYA menerima `{ accountName }` (nama pemilik); nomor & bank tidak
 * bisa diubah (controller: `@Body() dto: { accountName: string }`).
 */
export function updateBankAccountName(id: string, accountName: string) {
  return http.patch<BankAccount, { accountName: string }>(
    `/v1/bank-accounts/${seg(id)}`,
    { accountName: accountName.trim() },
    { auth: "required" },
  )
}
