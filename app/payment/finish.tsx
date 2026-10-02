/**
 * Kahade — Payment Finish.
 *
 * Halaman redirect tujuan DANA "Finish Redirect URL" (wajib diisi di
 * Production Endpoint Setup DANA). Setelah user menyelesaikan pembayaran
 * di halaman kasir DANA (IPG Cashier Pay), browser diarahkan ke sini.
 *
 * BFI-062/MFE-010 + SEC-401 (fail-closed): status dari query param DANA TIDAK
 * dipercaya untuk klaim sukses (siapa pun bisa membuka URL ini dengan
 * status=success). Saat mount, halaman memverifikasi status ke backend
 * lebih dulu ("Memverifikasi pembayaran…"); layar SUKSES ("Dana sudah masuk
 * escrow") hanya tampil bila backend mengonfirmasi pembayaran sudah masuk
 * (GET /v1/orders/:orderId/payment-status → PAID). Tanpa identifier yang
 * bisa diverifikasi / backend tak terjangkau → layar "belum terkonfirmasi"
 * (bukan sukses palsu). Status final sumber kebenaran tetap webhook
 * finish-notify di server.
 */
import { useCallback, useEffect, useRef, useState } from "react"
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
import { translate } from "@/lib/i18n/translate"
import { resolveStatus, resolveVerifyTarget, type PaymentFinishStatus } from "@/lib/payment-finish"
import { usePolling } from "@/lib/use-polling"

/**
 * UX-FDB-002 (audit UI/UX 2026-10-01): layar pending mem-poll status ke
 * backend — pola yang sama dengan use-dana-intent (BFI-085): backoff linear
 * + cap jumlah poll. Berhenti otomatis saat status final (success/failed/
 * unknown) atau cap tercapai; pengguna tetap bisa cek manual.
 */
const POLL_BASE_MS = 10_000
const MAX_POLLS = 10

/**
 * Copy per status — klaim definitif "Dana sudah diterima Kahade" HANYA untuk
 * status `success` yang SUDAH diverifikasi backend (lihat verify()).
 */
const COPY: Record<PaymentFinishStatus, { title: string; subtitle: string }> = {
  success: {
    title: translate("Pembayaran berhasil"),
    subtitle: translate("Dana sudah diterima Kahade."),
  },
  pending: {
    title: translate("Menunggu konfirmasi"),
    subtitle: translate(
      "Pembayaran belum terkonfirmasi. Status diperbarui otomatis dari server.",
    ),
  },
  failed: {
    title: translate("Pembayaran gagal"),
    subtitle: translate("Silakan coba lagi."),
  },
  unknown: {
    title: translate("Status pembayaran belum diketahui"),
    subtitle: translate(
      "Kami belum bisa memastikan status pembayaran. Jangan bayar ulang dulu — cek status atau buka Transaksi.",
    ),
  },
}

export default function PaymentFinishScreen() {
  const params = useLocalSearchParams<Record<string, string | string[]>>()
  const target = resolveVerifyTarget(params)
  // useLocalSearchParams membuat objek baru tiap render. Dependensi verifikasi
  // harus primitif, agar setState tidak memicu loop request tanpa henti.
  const verifyKind = target?.kind
  const verifyId = target?.id
  const targetKey = target ? `${target.kind}:${target.id}` : null
  /**
   * SEC-401: param paymentTxId di URL (bila dibawa) harus cocok dengan
   * paymentTxId server sebelum klaim sukses — mencegah klaim untuk
   * pembayaran yang salah. Param ini TIDAK diwajibkan: redirect resmi DANA
   * tidak membawa paymentTxId internal kami (hanya data merchant order);
   * yang diwajibkan adalah verifikasi server per orderId. Absennya param
   * bukan alasan menolak verifikasi — otoritasnya tetap respons server.
   */
  const rawTxIdParam = params.paymentTxId ?? params.payment_tx_id ?? params.txId
  const expectedPaymentTxId =
    typeof rawTxIdParam === "string" && /^[a-zA-Z0-9_-]+$/.test(rawTxIdParam.trim())
      ? rawTxIdParam.trim()
      : null
  const [verifying, setVerifying] = useState(true)
  const [verification, setVerification] = useState<{
    targetKey: string | null
    status: PaymentFinishStatus
    checkedAt: Date | null
  } | null>(null)
  const verificationRequest = useRef(0)
  const finalStatus = verification?.targetKey === targetKey ? verification.status : "unknown"
  /** Cek status manual sedang berjalan (spinner di tombol, bukan full-screen). */
  const [checking, setChecking] = useState(false)
  /** Polling otomatis berhenti (status final / cap tercapai). */
  const [pollStopped, setPollStopped] = useState(false)
  const pollCount = useRef(0)
  const [pollIntervalMs, setPollIntervalMs] = useState(POLL_BASE_MS)

  /**
   * Satu kali baca status terverifikasi dari backend — HANYA baca, tidak
   * mengubah alur pembayaran. Dipakai verifikasi awal, polling, dan cek
   * manual. Fail-closed: tanpa konfirmasi backend → "unknown".
   */
  const verify = useCallback(async () => {
    const request = ++verificationRequest.current
    let status: PaymentFinishStatus = "unknown"
    let checkedAt: Date | null = null
    if (verifyKind && verifyId) {
      try {
        if (verifyKind === "order") {
          // SEC-401: endpoint kanonis GET /v1/orders/:orderId/payment-status
          // (DANA-direct dulu, fallback QRIS lawas). 404/unreachable → catch
          // → "unknown" (netral, bukan sukses).
          const { payment, paymentTxId } = await api.orders.getCanonicalPaymentStatus(verifyId)
          status =
            expectedPaymentTxId != null && paymentTxId != null && expectedPaymentTxId !== paymentTxId
              ? "unknown"
              : resolveStatus(verifyKind, payment)
        } else {
          const response = await getSubscriptionPaymentStatus(verifyId)
          status = resolveStatus(verifyKind, response)
        }
      } catch {
        // Redirect, error jaringan, dan respons asing bukan bukti status apa pun.
      }
      checkedAt = new Date()
    }
    if (request === verificationRequest.current) {
      setVerification({ targetKey, status, checkedAt })
    }
  }, [verifyKind, verifyId, targetKey, expectedPaymentTxId])

  useEffect(() => {
    let alive = true
    setVerifying(true)
    pollCount.current = 0
    setPollIntervalMs(POLL_BASE_MS)
    setPollStopped(false)
    void verify().finally(() => {
      if (alive) setVerifying(false)
    })
    return () => {
      alive = false
      verificationRequest.current += 1
    }
  }, [verify])

  // UX-FDB-002(a): polling hanya saat status pending; berhenti otomatis saat
  // status final (success/failed/unknown — enabled=false) atau cap
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
    if (verifyKind === "order" && verifyId) {
      router.replace(ROUTES.orderDetail(verifyId))
    } else {
      router.replace(ROUTES.transactions)
    }
  }, [verifyKind, verifyId])

  const status = finalStatus
  const copy = COPY[status]

  const icon =
    status === "success" ? CheckCircle : status === "failed" ? XCircle : status === "unknown" ? ArrowClockwise : Clock
  const tone =
    status === "success" ? "success" : status === "failed" ? "danger" : status === "unknown" ? "default" : "warning"

  const lastCheckedAt = verification?.targetKey === targetKey ? verification.checkedAt : null
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
        {verifying || verification?.targetKey !== targetKey ? (
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
              {/* Status unknown juga bisa dicek via API jika identifier tersedia. */}
              {(status === "pending" || status === "unknown") && target ? (
                <Button
                  variant="secondary"
                  leftIcon={ArrowClockwise}
                  loading={checking}
                  disabled={checking}
                  onPress={handleManualCheck}
                >
                  Cek status pembayaran
                </Button>
              ) : null}
              {/* UX-FDB-002(c): aksi retry yang jelas saat failed. */}
              {status === "failed" ? (
                <Button variant="secondary" onPress={handleRetryPay}>
                  Coba bayar lagi
                </Button>
              ) : null}
              <Button onPress={() => router.replace(ROUTES.transactions)}>
                {status === "unknown" && !target ? "Cek status di Transaksi" : "Lihat Transaksi"}
              </Button>
            </View>
          </>
        )}
      </View>
    </Screen>
  )
}
