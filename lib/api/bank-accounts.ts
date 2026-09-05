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

export async function listBankAccounts() {
  const raw = await http.get<BankAccount[]>("/v1/bank-accounts", { auth: "required", retry: 1 });
  const accounts = readList<BankAccount>(raw, ["bankAccounts", "accounts", "bank_accounts"]);
  return accounts.map(account => ({
    ...account,
    bankCode: account.bankCode ?? (account as any).bank_code,
    bankName: account.bankName ?? (account as any).bank_name,
    accountNumber: account.accountNumber ?? (account as any).account_number,
    accountName: account.accountName ?? (account as any).account_name,
    isPrimary: account.isPrimary ?? (account as any).is_primary,
    isVerified: account.isVerified ?? (account as any).is_verified,
    createdAt: account.createdAt ?? (account as any).created_at,
  }))
}

export async function addBankAccount(dto: AddBankAccountDto) {
  const account = await http.post<BankAccount, AddBankAccountDto>("/v1/bank-accounts", dto, { auth: "required" })
  return {
    ...account,
    bankCode: account.bankCode ?? (account as any).bank_code,
    bankName: account.bankName ?? (account as any).bank_name,
    accountNumber: account.accountNumber ?? (account as any).account_number,
    accountName: account.accountName ?? (account as any).account_name,
    isPrimary: account.isPrimary ?? (account as any).is_primary,
    isVerified: account.isVerified ?? (account as any).is_verified,
    createdAt: account.createdAt ?? (account as any).created_at,
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
    bankCode: account.bankCode ?? (account as any).bank_code,
    bankName: account.bankName ?? (account as any).bank_name,
    accountNumber: account.accountNumber ?? (account as any).account_number,
    accountName: account.accountName ?? (account as any).account_name,
    isPrimary: account.isPrimary ?? (account as any).is_primary,
    isVerified: account.isVerified ?? (account as any).is_verified,
    createdAt: account.createdAt ?? (account as any).created_at,
  }
}
