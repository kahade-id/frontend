/**
 * Kahade — <PendingActionsBanner> (J-04 audit).
 *
 * Aksi uang yang menggantung (QRIS belum dibayar, top-up unpaid, withdraw
 * menunggu OTP) dicatat `lib/pending-actions` saat dibuat dan di-resolve saat
 * selesai. Sebelumnya catatan itu hanya dipakai layar asalnya — bila app
 * ditutup di tengah, pengguna tidak pernah ditawari jalur kembali ("uang
 * hilang rasa"). Banner ini dirender sekali di AppShell sehingga muncul di
 * tab APA pun saat boot:
 *
 *   - Hanya untuk sesi bertoken (tamu tidak pernah punya aksi menggantung;
 *     storage juga dibersihkan saat logout).
 *   - Menampilkan aksi paling mendesak (expiresAt terlama-dulu); sisanya
 *     dirangkum "+N lainnya" — satu baris, bukan tumpukan.
 *   - Ketuk = buka layar tempat aksi bisa diselesaikan/diperiksa statusnya
 *     (order detail untuk QRIS, Top-up untuk unpaid, Withdraw untuk OTP).
 *   - "×" menyembunyikan untuk proses app ini (state lokal) — TIDAK menghapus
 *     catatan: aksinya benar-benar masih menggantung di server.
 *   - Catatan kedaluwarsa (expiresAt lewat) disaring di sini juga, bukan
 *     hanya saat load, karena app bisa hidup lintas hari.
 */
import { useMemo, useState } from "react"
import { View } from "react-native"
import { router } from "expo-router"

import { X } from "phosphor-react-native"

import { formatDateTime, formatRupiah } from "@/lib/format"
import {
  usePendingActions,
  type PendingAction,
} from "@/lib/pending-actions"
import { ROUTES } from "@/lib/routes"
import { useAuthSession } from "@/lib/use-auth-session"
import { cn } from "@/lib/cn"

import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"

function actionKey(action: PendingAction): string {
  return action.kind === "withdraw-otp"
    ? `${action.kind}:${action.txId}`
    : action.kind === "qris-payment"
      ? `${action.kind}:${action.orderId}`
      : `${action.kind}:${action.paymentTxId}`
}

function describe(action: PendingAction): { title: string; meta?: string } {
  switch (action.kind) {
    case "qris-payment":
      return {
        title: `Pembayaran pesanan menunggu — ${formatRupiah(action.amount)}`,
        meta: action.expiresAt
          ? `QRIS berlaku sampai ${formatDateTime(action.expiresAt)}`
          : "Periksa status pembayaran pesanan Anda",
      }
    case "topup-unpaid":
      return {
        title: `Top-up belum dibayar — ${formatRupiah(action.amount)}`,
        meta: action.expiresAt
          ? `Tagihan berlaku sampai ${formatDateTime(action.expiresAt)}`
          : "Selesaikan pembayaran di layar Top-up",
      }
    case "withdraw-otp":
      return {
        title: `Penarikan menunggu OTP — ${formatRupiah(action.amount)}`,
        meta: action.expiresAt
          ? `Kode OTP berlaku sampai ${formatDateTime(action.expiresAt)}`
          : "Periksa status penarikan di layar Tarik Dana",
      }
  }
}

function targetOf(action: PendingAction) {
  switch (action.kind) {
    case "qris-payment":
      return ROUTES.orderDetail(action.orderId)
    case "topup-unpaid":
      return ROUTES.topup
    case "withdraw-otp":
      return ROUTES.withdraw
  }
}

export function PendingActionsBanner() {
  const { token } = useAuthSession()
  const actions = usePendingActions()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const visible = useMemo(() => {
    const now = Date.now()
    return actions
      .filter((a) => !a.expiresAt || a.expiresAt > now)
      .filter((a) => !dismissed.has(actionKey(a)))
      .sort((a, b) => (a.expiresAt ?? Infinity) - (b.expiresAt ?? Infinity))
  }, [actions, dismissed])

  if (!token || visible.length === 0) return null
  const primary = visible[0]
  const extra = visible.length - 1
  const info = describe(primary)

  return (
    <View className="border-b border-border bg-surface px-4 py-2.5">
      <View className="flex-row items-center gap-2">
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Buka aksi menggantung: ${info.title}`}
          accessibilityHint={info.meta}
          onPress={() => router.push(targetOf(primary))}
          containerClassName="flex-1"
          className="flex-1 gap-0.5"
        >
          <Text variant="body" weight={600} numberOfLines={1}>
            {info.title}
            {extra > 0 ? ` (+${extra} lainnya)` : ""}
          </Text>
          {info.meta ? (
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {info.meta}
            </Text>
          ) : null}
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Sembunyikan pengingat aksi menggantung"
          onPress={() =>
            setDismissed((prev) => new Set(prev).add(actionKey(primary)))
          }
          containerClassName={cn("rounded-md p-1.5")}
          className="items-center justify-center"
        >
          <Icon icon={X} size="sm" />
        </PressableScale>
      </View>
    </View>
  )
}
