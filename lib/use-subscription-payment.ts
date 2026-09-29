/**
 * Kahade — alur pembayaran langganan Kahade+ via DANA (Mode Tanpa Wallet
 * Internal, BI-safe).
 *
 * KONTRAK FINAL (2026-09-29): `POST /v1/subscriptions/subscribe-dana`
 * → subscription PENDING + intent checkout; polling
 * `GET /v1/subscriptions/dana-status/:id` sampai ACTIVE.
 *
 * Wrapper di atas `lib/use-dana-intent.ts` (siklus intent generik: buat
 * intent, polling status tiap 3 detik, batas 15 menit, rekonsiliasi setelah
 * kegagalan tak pasti + catatan aksi menggantung `subscription-payment` yang
 * pulih ke daftar paket). Langganan TIDAK memakai PIN dompet — hanya metode
 * DANA dinamis (QRIS/VA/BALANCE).
 */
import { useMemo, useRef } from "react"

import {
  createSubscriptionPayment,
  getSubscriptionPaymentStatus,
} from "@/lib/api/subscription-payments"
import type { KahadePlusPlanKey } from "@/lib/api/subscriptions"
import { useDanaIntent, type DanaIntentAdapter } from "@/lib/use-dana-intent"

export type UseSubscriptionPaymentOptions = {
  /** Paket yang dibayar; `null` saat belum dipilih. */
  plan: KahadePlusPlanKey | null
  /** Kode metode UI (mis. "QRIS", "VA_BCA", "DANA") → payKind backend. */
  methodCode: string
  /** Label metode untuk copy error/banner. Default = methodCode. */
  methodLabel?: string
  /** Kode promo opsional (diteruskan ke subscribe-dana). */
  promoCode?: string
  /** Nominal paket — fallback bila respons server tidak memuat `amount`. */
  fallbackAmount: number
  /** Sheet pembayaran sedang terbuka; polling hanya hidup saat true. */
  active: boolean
  /** Dipanggil sekali saat subscription menjadi ACTIVE. */
  onPaid: () => void
  /** Galat pembuatan intent — layar menampilkannya sebagai toast. */
  onError: (message: string) => void
}

export function useSubscriptionPayment({
  plan,
  methodCode,
  methodLabel,
  promoCode,
  fallbackAmount,
  active,
  onPaid,
  onError,
}: UseSubscriptionPaymentOptions) {
  // ID subscription PENDING dari respons subscribe-dana — dipakai polling
  // dana-status/:id. Disimpan di ref agar adapter (dibuat sekali per plan)
  // selalu membaca nilai terbaru tanpa rebuild.
  const subscriptionIdRef = useRef<string | null>(null)

  const adapter = useMemo<DanaIntentAdapter | null>(
    () =>
      plan
        ? {
            actionKey: plan,
            pendingKind: "subscription-payment",
            createIntent: async (code, idempotencyKey) => {
              const intent = await createSubscriptionPayment(
                plan,
                code,
                idempotencyKey,
                promoCode,
              )
              subscriptionIdRef.current = intent.subscriptionId ?? null
              return intent
            },
            getStatus: () => {
              const id = subscriptionIdRef.current
              // Fail-closed: tanpa subscriptionId, status tak bisa dibaca —
              // lempar agar polling menampilkan error, bukan menebak.
              if (!id) throw new Error("ID langganan belum tersedia")
              return getSubscriptionPaymentStatus(id)
            },
          }
        : null,
    [plan, promoCode],
  )

  return useDanaIntent({
    adapter,
    methodCode,
    methodLabel,
    fallbackAmount,
    active,
    // Langganan: user yang login selalu boleh membuat intent (backend yang
    // memutuskan kelayakan paket di server).
    canCreate: plan != null,
    onPaid,
    onError,
  })
}
