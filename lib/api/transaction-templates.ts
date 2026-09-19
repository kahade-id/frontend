/**
 * Kahade — domain `transaction-templates` (template order cepat).
 *
 * Respons server TIDAK menyimpan `role`/`counterpartUsername` (lihat
 * TransactionTemplatesService produksi) — kedua field dipertahankan di tipe
 * ini hanya sebagai preferensi lokal form. REQUEST body mengikuti DTO
 * produksi (CreateTemplateDto/UpdateTemplateDto di lib/api/types).
 */
import { http, seg } from "@/lib/api/client"
import { readList } from "@/lib/api/response"
import type { CreateTemplateDto, UpdateTemplateDto } from "@/lib/api/types"

export type TransactionTemplate = {
  id: string
  name: string
  role: "BUYER" | "SELLER"
  title: string
  description?: string
  orderType: "PHYSICAL_GOODS" | "DIGITAL_GOODS" | "SERVICE" | "OTHER"
  orderValue: number
  deliveryDeadlineDays: number
  feeResponsibility: "BUYER" | "SELLER" | "SPLIT"
  counterpartUsername?: string | null
  usageCount?: number
  lastUsedAt?: string | null
}

export function listTransactionTemplates(signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/transaction-templates", { auth: "required", retry: 1, signal })
    .then((raw) => readList<TransactionTemplate>(raw, ["templates"]))
}

export function getTransactionTemplate(id: string) {
  return http.get<TransactionTemplate>(`/v1/transaction-templates/${seg(id)}`, {
    auth: "required",
    retry: 1,
  })
}

/**
 * DTO produksi CreateTemplateDto/UpdateTemplateDto TIDAK mengenal `role` dan
 * `counterpartUsername` (forbidNonWhitelisted menolak field ekstra dengan 400).
 * Adapter kini menerima tipe DTO eksplisit, bukan Partial<TransactionTemplate>.
 */
export function createTransactionTemplate(dto: CreateTemplateDto) {
  return http.post<TransactionTemplate, CreateTemplateDto>(
    "/v1/transaction-templates",
    dto,
    { auth: "required" },
  )
}

export function updateTransactionTemplate(id: string, dto: UpdateTemplateDto) {
  return http.put<TransactionTemplate, UpdateTemplateDto>(
    `/v1/transaction-templates/${seg(id)}`,
    dto,
    { auth: "required" },
  )
}

export function deleteTransactionTemplate(id: string) {
  return http.delete<void>(`/v1/transaction-templates/${seg(id)}`, {
    auth: "required",
    responseType: "void",
  })
}

/**
 * POST /v1/transaction-templates/{id}/use — catat pemakaian template
 * (usageCount/lastUsedAt di sisi server). Dipanggil saat user menekan
 * "Pakai" dan berpindah ke create-transaction — statistik, bukan transaksi.
 */
export function useTransactionTemplate(id: string) {
  return http.post<Record<string, unknown>>(
    `/v1/transaction-templates/${seg(id)}/use`,
    undefined,
    { auth: "required" },
  )
}
