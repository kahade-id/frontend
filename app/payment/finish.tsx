/**
 * Kahade — Payment Finish.
 *
 * Halaman redirect tujuan DANA "Finish Redirect URL" (wajib diisi di
 * Production Endpoint Setup DANA). Setelah user menyelesaikan pembayaran
 * di halaman kasir DANA (IPG Cashier Pay), browser diarahkan ke sini.
 *
 * BFI-062 (fail-closed): status dari query param DANA TIDAK dipercaya
 * untuk klaim sukses. Saat mount, halaman memverifikasi status ke backend
 * lebih dulu ("Memverifikasi pembayaran…"); layar SUKSES hanya tampil bila
 * backend mengonfirmasi pembayaran sudah masuk. Tanpa identifier yang bisa
 * diverifikasi / backend tak terjangkau → layar "belum terkonfirmasi"
 * (bukan sukses palsu). Status final sumber kebenaran tetap webhook
 * finish-notify di server.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator, View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { CheckCircle, Clock, XCircle } from "phosphor-react-native"

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { api } from "@/lib/api"
import { getSubscriptionPaymentStatus } from "@/lib/api/subscription-payments"
import { ROUTES } from "@/lib/routes"

type Status = "success" | "pending" | "failed"

/** Status halaman — "unverified" = tak bisa dibuktikan ke backend (fail-closed). */
type PageStatus = Status | "unverified"

function pickParam(params: Record<string, string | string[]>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = params[k]
    const s = (Array.isArray(v) ? v[0] : v)?.trim()
    if (s) return s
  }
  return null
}

function resolveStatus(params: Record<string, string | string[]>): Status {
  const raw = (
    pickParam(params, "status", "latestTransactionStatus", "transactionStatus", "responseCode") ??
    ""
  ).toLowerCase()
  if (raw === "00" || raw === "2005600" || raw === "success" || raw === "successful") {
    return "success"
  }
  if (
    raw === "01" ||
    raw === "02" ||
    raw === "03" ||
    raw === "pending" ||
    raw === "processing"
  ) {
    return "pending"
  }
  if (raw) return "failed"
  return "pending"
}

/** Identifier pembayaran dari query param DANA (bila ada). */
function resolveVerifyTarget(params: Record<string, string | string[]>): {
  kind: "order" | "subscription"
  id: string
} | null {
  const orderId = pickParam(params, "orderId", "order_id", "merchantOrderId", "merchantOrderNo")
  if (orderId) return { kind: "order", id: orderId }
  const subscriptionId = pickParam(params, "subscriptionId", "subscription_id")
  if (subscriptionId) return { kind: "subscription", id: subscriptionId }
  return null
}

const FAILED_STATUSES = ["FAILED", "EXPIRED", "CANCELLED", "REFUNDED"]

const COPY: Record<PageStatus, { title: string; subtitle: string }> = {
  success: {
    title: "Pembayaran berhasil",
    subtitle: "Dana sudah masuk escrow Kahade.",
  },
  pending: {
    title: "Menunggu konfirmasi",
    subtitle: "Pembayaran sedang diproses.",
  },
  failed: {
    title: "Pembayaran gagal",
    subtitle: "Silakan coba lagi.",
  },
  unverified: {
    title: "Status belum terkonfirmasi",
    subtitle:
      "Kami belum bisa memastikan status pembayaran ke server. Jangan bayar ulang dulu — cek di menu Transaksi.",
  },
}

export default function PaymentFinishScreen() {
  const params = useLocalSearchParams<Record<string, string | string[]>>()
  const provisional = useMemo(() => resolveStatus(params), [params])
  const [verifying, setVerifying] = useState(true)
  const [finalStatus, setFinalStatus] = useState<PageStatus | null>(null)

  const verify = useCallback(async () => {
    setVerifying(true)
    try {
      const target = resolveVerifyTarget(params)
      if (!target) {
        // Fail-closed: tanpa identifier, klaim "sukses" dari query param
        // DANA tidak boleh ditampilkan. "failed" dari DANA sendiri boleh
        // tampil (bukan klaim sukses).
        setFinalStatus(provisional === "failed" ? "failed" : "unverified")
        return
      }
      if (target.kind === "order") {
        const s = await api.orders.getPaymentStatus(target.id)
        if (s.isPaid || s.status === "PAID") setFinalStatus("success")
        else if (s.status === "PENDING") setFinalStatus("pending")
        else if (FAILED_STATUSES.includes(s.status)) setFinalStatus("failed")
        else setFinalStatus("unverified")
      } else {
        const s = await getSubscriptionPaymentStatus(target.id)
        if (s.isPaid || s.status === "ACTIVE") setFinalStatus("success")
        else if (s.status === "PENDING") setFinalStatus("pending")
        else setFinalStatus("failed")
      }
    } catch {
      // Backend tak terjangkau / sesi habis / respons tak dikenal —
      // fail-closed: jangan tampilkan sukses.
      setFinalStatus("unverified")
    } finally {
      setVerifying(false)
    }
  }, [params, provisional])

  useEffect(() => {
    void verify()
  }, [verify])

  const status = finalStatus ?? provisional
  const copy = COPY[status]

  const icon =
    status === "success" ? CheckCircle : status === "failed" ? XCircle : Clock
  const tone =
    status === "success" ? "success" : status === "failed" ? "danger" : "warning"

  return (
    <Screen>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 32,
          gap: 16,
        }}
      >
        {verifying ? (
          <>
            <ActivityIndicator size="large" />
            <Text variant="h2" style={{ textAlign: "center" }}>
              Memverifikasi pembayaran…
            </Text>
            <Text variant="body" tone="secondary" style={{ textAlign: "center" }}>
              Memastikan status ke server Kahade.
            </Text>
          </>
        ) : (
          <>
            <Icon icon={icon} tone={tone} size={64} />
            <Text variant="h2" style={{ textAlign: "center" }}>
              {copy.title}
            </Text>
            <Text variant="body" tone="secondary" style={{ textAlign: "center" }}>
              {copy.subtitle}
            </Text>
            <View style={{ marginTop: 16, width: "100%", maxWidth: 320, gap: 12 }}>
              {status === "unverified" ? (
                <Button variant="secondary" onPress={() => void verify()}>
                  Coba verifikasi lagi
                </Button>
              ) : null}
              <Button onPress={() => router.replace(ROUTES.transactions)}>
                Lihat Transaksi
              </Button>
            </View>
          </>
        )}
      </View>
    </Screen>
  )
}
