/**
 * Kahade — Payment Finish.
 *
 * Halaman redirect tujuan DANA "Finish Redirect URL" (wajib diisi di
 * Production Endpoint Setup DANA). Setelah user menyelesaikan pembayaran
 * di halaman kasir DANA (IPG Cashier Pay), browser diarahkan ke sini.
 *
 * MFE-010: parameter query DANA di URL redirect TIDAK terverifikasi
 * (siapa pun bisa membuka URL ini dengan status=success) — halaman ini
 * TIDAK BOLEH mengklaim definitif "dana sudah masuk escrow". Copy default
 * bersifat PROVISIONAL ("sedang mengonfirmasi"); copy definitif hanya
 * ditampilkan setelah verifikasi ke backend via
 * `GET /v1/orders/:orderId/dana-payment-status` yang mengembalikan PAID.
 * Bila param orderId tidak tersedia, halaman tetap provisional.
 */
import { useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { CheckCircle, Clock, XCircle } from "phosphor-react-native"

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { ROUTES } from "@/lib/routes"
import { api } from "@/lib/api"

type Status = "success" | "pending" | "failed"

function resolveStatus(params: Record<string, string | string[]>): Status {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = params[k]
      const s = (Array.isArray(v) ? v[0] : v)?.trim().toLowerCase()
      if (s) return s
    }
    return ""
  }
  const raw = pick(
    "status",
    "latestTransactionStatus",
    "transactionStatus",
    "responseCode",
  )
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

function firstParam(params: Record<string, string | string[]>, key: string): string | null {
  const v = params[key]
  const s = (Array.isArray(v) ? v[0] : v)?.trim()
  return s || null
}

/**
 * Copy PROVISIONAL — ditampilkan sampai backend memastikan PAID. Klaim
 * definitif "dana sudah masuk escrow" hanya sah dari sumber kebenaran
 * server (webhook finish-notify → status payment).
 */
const PROVISIONAL_COPY: Record<Status, { title: string; subtitle: string }> = {
  success: {
    title: "Pembayaran diterima",
    subtitle: "Kami sedang mengonfirmasi pembayaran ke escrow Kahade.",
  },
  pending: {
    title: "Menunggu konfirmasi",
    subtitle: "Pembayaran sedang diproses.",
  },
  failed: {
    title: "Pembayaran gagal",
    subtitle: "Silakan coba lagi.",
  },
}

/** Copy DEFINITIF — hanya setelah backend menyatakan PAID. */
const VERIFIED_COPY = {
  title: "Pembayaran berhasil",
  subtitle: "Dana sudah masuk escrow Kahade.",
}

export default function PaymentFinishScreen() {
  const params = useLocalSearchParams<Record<string, string | string[]>>()
  const status = useMemo(() => resolveStatus(params), [params])
  /** null = belum diverifikasi; true = backend menyatakan PAID. */
  const [verifiedPaid, setVerifiedPaid] = useState(false)

  useEffect(() => {
    const orderId = firstParam(params, "orderId")
    if (!orderId) return
    let cancelled = false
    // MFE-010: verifikasi server-side — naikkan copy ke definitif HANYA
    // bila status kanonis PAID. Gagal verifikasi (jaringan/ditolak) =
    // tetap provisional (fail-closed untuk klaim, bukan untuk UI).
    api.orders
      .getPaymentStatus(orderId)
      .then((s) => {
        if (!cancelled && (s.status === "PAID" || s.isPaid === true)) {
          setVerifiedPaid(true)
        }
      })
      .catch(() => {
        // Sengaja ditelan: halaman tetap provisional.
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const copy = verifiedPaid ? VERIFIED_COPY : PROVISIONAL_COPY[status]
  const displayStatus: Status = verifiedPaid ? "success" : status

  const icon =
    displayStatus === "success" ? CheckCircle : displayStatus === "pending" ? Clock : XCircle
  const tone =
    displayStatus === "success" ? "success" : displayStatus === "pending" ? "warning" : "danger"

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
        <Icon icon={icon} tone={tone} size={64} />
        <Text variant="h2" style={{ textAlign: "center" }}>
          {copy.title}
        </Text>
        <Text variant="body" tone="secondary" style={{ textAlign: "center" }}>
          {copy.subtitle}
        </Text>
        <View style={{ marginTop: 16, width: "100%", maxWidth: 320 }}>
          <Button onPress={() => router.replace(ROUTES.transactions)}>
            Lihat Transaksi
          </Button>
        </View>
      </View>
    </Screen>
  )
}
