/**
 * Kahade — domain `transaction-templates` (template order cepat).
 * Spec: DTO `Record<string, never>` (UNVERIFIED) — bentuk disamakan dengan
 * TransactionTemplateCard di components/ui (satu sumber bentuk template order).
 */
import { http, seg } from "@/lib/api/client"

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

export function listTransactionTemplates() {
  return http.get<TransactionTemplate[]>("/v1/transaction-templates", { auth: "required", retry: 1 })
}

export function getTransactionTemplate(id: string) {
  return http.get<TransactionTemplate>(`/v1/transaction-templates/${seg(id)}`, {
    auth: "required",
    retry: 1,
  })
}

export function createTransactionTemplate(dto: Partial<TransactionTemplate>) {
  return http.post<TransactionTemplate, Partial<TransactionTemplate>>(
    "/v1/transaction-templates",
    dto,
    { auth: "required" },
  )
}

export function updateTransactionTemplate(id: string, dto: Partial<TransactionTemplate>) {
  return http.put<TransactionTemplate, Partial<TransactionTemplate>>(
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
