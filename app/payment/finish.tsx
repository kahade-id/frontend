/**
 * Kahade — Payment Finish.
 *
 * Halaman redirect tujuan DANA "Finish Redirect URL" (wajib diisi di
 * Production Endpoint Setup DANA). Setelah user menyelesaikan pembayaran
 * di halaman kasir DANA (IPG Cashier Pay), browser diarahkan ke sini.
 *
 * Membaca status dari query params DANA lalu menampilkan hasil yang
 * minimal. Status final sumber kebenaran tetap dari backend (webhook
 * finish-notify), halaman ini hanya tampilan.
 */
import { useMemo } from "react"
import { View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { CheckCircle, Clock, XCircle } from "phosphor-react-native"

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { ROUTES } from "@/lib/routes"

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

const COPY: Record<Status, { title: string; subtitle: string }> = {
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
}

export default function PaymentFinishScreen() {
  const params = useLocalSearchParams<Record<string, string | string[]>>()
  const status = useMemo(() => resolveStatus(params), [params])
  const copy = COPY[status]

  const icon =
    status === "success" ? CheckCircle : status === "pending" ? Clock : XCircle
  const tone =
    status === "success" ? "success" : status === "pending" ? "warning" : "danger"

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
