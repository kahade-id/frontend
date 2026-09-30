/**
 * Kahade — Payment Finish.
 *
 * Halaman redirect tujuan DANA "Finish Redirect URL" (wajib diisi di
 * Production Endpoint Setup DANA). Setelah user menyelesaikan pembayaran
 * di halaman kasir DANA (IPG Cashier Pay), browser diarahkan ke sini.
 *
 * BFI-062/MFE-010 (fail-closed): status dari query param DANA TIDAK
 * dipercaya untuk klaim sukses (siapa pun bisa membuka URL ini dengan
 * status=success). Saat mount, halaman memverifikasi status ke backend
 * lebih dulu ("Memverifikasi pembayaran…"); layar SUKSES ("Dana sudah masuk
 * escrow") hanya tampil bila backend mengonfirmasi pembayaran sudah masuk
 * (GET /v1/orders/:orderId/dana-payment-status → PAID). Tanpa identifier yang
 * bisa diverifikasi / backend tak terjangkau → layar "belum terkonfirmasi"
 * (bukan sukses palsu). Status final sumber kebenaran tetap webhook
 * finish-notify di server.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { ArrowClockwise, CheckCircle, Clock, XCircle } from "phosphor-react-native"

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { api } from "@/lib/api"
import { getSubscriptionPaymentStatus } from "@/lib/api/subscription-payments"
import { ROUTES } from "@/lib/routes"
import { usePolling } from "@/lib/use-polling"

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

/**
 * UX-FDB-002 (audit UI/UX 2026-10-01): layar pending mem-poll status ke
 * backend — pola yang sama dengan use-dana-intent (BFI-085): backoff linear
 * + cap jumlah poll. Berhenti otomatis saat status final (success/failed/
 * unverified) atau cap tercapai; pengguna tetap bisa cek manual.
 */
const POLL_BASE_MS = 10_000
const MAX_POLLS = 10

/**
 * Copy per status — klaim definitif "Dana sudah diterima Kahade" HANYA untuk
 * status `success` yang SUDAH diverifikasi backend (lihat verify()).
 */
const COPY: Record<PageStatus, { title: string; subtitle: string }> = {
  success: {
    title: "Pembayaran berhasil",
    subtitle: "Dana sudah diterima Kahade.",
  },
  pending: {
    title: "Menunggu konfirmasi",
    subtitle:
      "Pembayaran sedang diproses — umumnya terkonfirmasi dalam beberapa menit. Dana Anda aman, status di layar ini diperbarui otomatis.",
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
  const verifyTarget = useMemo(() => resolveVerifyTarget(params), [params])
  const [verifying, setVerifying] = useState(true)
  const [finalStatus, setFinalStatus] = useState<PageStatus | null>(null)
  /** Cek status manual sedang berjalan (spinner di tombol, bukan full-screen). */
  const [checking, setChecking] = useState(false)
  /** Polling otomatis berhenti (status final / cap tercapai). */
  const [pollStopped, setPollStopped] = useState(false)
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null)
  const pollCount = useRef(0)
  const [pollIntervalMs, setPollIntervalMs] = useState(POLL_BASE_MS)

  /**
   * Satu kali baca status terverifikasi dari backend — HANYA baca, tidak
   * mengubah alur pembayaran. Dipakai verifikasi awal, polling, dan cek
   * manual. Fail-closed: tanpa konfirmasi backend → "unverified".
   */
  const verify = useCallback(async () => {
    try {
      const target = verifyTarget
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
      setLastCheckedAt(new Date())
    }
  }, [verifyTarget, provisional])

  useEffect(() => {
    let alive = true
    setVerifying(true)
    void verify().finally(() => {
      if (alive) setVerifying(false)
    })
    return () => {
      alive = false
    }
  }, [verify])

  // UX-FDB-002(a): polling hanya saat status pending; berhenti otomatis saat
  // status final (success/failed/unverified — enabled=false) atau cap
  // tercapai. usePolling menangani jitter, backpressure 429, dan
  // pause saat app background/offline.
  usePolling(
    async () => {
      if (pollCount.current >= MAX_POLLS) {
        setPollStopped(true)
        return
      }
      pollCount.current += 1
      // Backoff linear ala use-dana-intent (BFI-085).
      setPollIntervalMs(POLL_BASE_MS * (pollCount.current + 1))
      await verify()
    },
    pollIntervalMs,
    finalStatus === "pending" && !pollStopped,
  )

  /** UX-FDB-002(b): cek status manual — me-reset siklus polling otomatis. */
  const handleManualCheck = useCallback(() => {
    if (checking) return
    setChecking(true)
    pollCount.current = 0
    setPollIntervalMs(POLL_BASE_MS)
    setPollStopped(false)
    void verify().finally(() => setChecking(false))
  }, [checking, verify])

  /** UX-FDB-002(c): retry yang jelas saat failed — kembali ke detail order
   *  (di sana pengguna bisa memulai pembayaran ulang); tanpa orderId yang
   *  bisa diverifikasi → daftar transaksi. */
  const handleRetryPay = useCallback(() => {
    if (verifyTarget?.kind === "order") {
      router.replace(ROUTES.orderDetail(verifyTarget.id))
    } else {
      router.replace(ROUTES.transactions)
    }
  }, [verifyTarget])

  const status = finalStatus ?? provisional
  const copy = COPY[status]

  const icon =
    status === "success" ? CheckCircle : status === "failed" ? XCircle : Clock
  const tone =
    status === "success" ? "success" : status === "failed" ? "danger" : "warning"

  const lastCheckedLabel = lastCheckedAt
    ? lastCheckedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : null

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
            <Text variant="h2" accessibilityRole="header" style={{ textAlign: "center" }}>
              Memverifikasi pembayaran…
            </Text>
            <Text variant="body" tone="secondary" style={{ textAlign: "center" }}>
              Memastikan status ke server Kahade.
            </Text>
          </>
        ) : (
          <>
            <Icon icon={icon} tone={tone} size={64} />
            <Text variant="h2" accessibilityRole="header" style={{ textAlign: "center" }}>
              {copy.title}
            </Text>
            <Text variant="body" tone="secondary" style={{ textAlign: "center" }}>
              {copy.subtitle}
            </Text>
            {/* UX-FDB-002(a): status pending tidak lagi statis — indikator
                pengecekan otomatis + waktu cek terakhir. */}
            {status === "pending" ? (
              <View style={{ alignItems: "center", gap: 6 }}>
                {!pollStopped ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator size="small" />
                    <Text variant="caption" tone="secondary">
                      Memeriksa status otomatis…
                    </Text>
                  </View>
                ) : (
                  <Text variant="caption" tone="secondary" style={{ textAlign: "center" }}>
                    Pengecekan otomatis berhenti — tekan tombol di bawah untuk
                    memeriksa lagi.
                  </Text>
                )}
                {lastCheckedLabel ? (
                  <Text variant="caption" tone="secondary">
                    Terakhir dicek pukul {lastCheckedLabel}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <View style={{ marginTop: 8, width: "100%", maxWidth: 320, gap: 12 }}>
              {/* UX-FDB-002(b): cek status manual saat pending. */}
              {status === "pending" ? (
                <Button
                  variant="secondary"
                  leftIcon={ArrowClockwise}
                  loading={checking}
                  disabled={checking}
                  onPress={handleManualCheck}
                >
                  Cek status sekarang
                </Button>
              ) : null}
              {/* UX-FDB-002(c): aksi retry yang jelas saat failed. */}
              {status === "failed" ? (
                <Button variant="secondary" onPress={handleRetryPay}>
                  Coba bayar lagi
                </Button>
              ) : null}
              {status === "unverified" ? (
                <Button
                  variant="secondary"
                  loading={checking}
                  disabled={checking}
                  onPress={handleManualCheck}
                >
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
