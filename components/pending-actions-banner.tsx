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
import { translate } from "@/lib/i18n/translate"

import { X } from "phosphor-react-native"

import { formatDateTimeWIB, formatRupiah } from "@/lib/format"
import {
  usePendingActions,
  type PendingAction,
} from "@/lib/pending-actions"
import { ROUTES } from "@/lib/routes"
import { serverNow } from "@/lib/server-time"
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
        // M-33 (audit end-to-end, issue #94): nominal 0 (fallback saat record
        // dibuat sebelum angka dikenal) tidak dicetak "Rp0" — banner bilang
        // nominal belum diketahui, bukan menakar uang dengan angka palsu.
        title: translate("Pembayaran pesanan menunggu — {x}", {
          x: action.amount > 0 ? formatRupiah(action.amount) : "nominal belum diketahui",
        }),
        meta: action.expiresAt
          ? translate("QRIS berlaku sampai {x}", { x: formatDateTimeWIB(action.expiresAt) })
          : "Periksa status pembayaran pesanan Anda",
      }
    case "topup-unpaid":
      return {
        // M-60: aturan cetak yang sama dengan qris (M-33) — nominal 0 (fallback
        // sebelum angka dikenal) tidak dicetak "Rp0" seolah uangnya nol.
        title: translate("Top-up belum dibayar — {x}", {
          x: action.amount > 0 ? formatRupiah(action.amount) : "nominal belum diketahui",
        }),
        meta: action.expiresAt
          ? translate("Tagihan berlaku sampai {x}", { x: formatDateTimeWIB(action.expiresAt) })
          : "Selesaikan pembayaran di layar Top-up",
      }
    case "withdraw-otp":
      return {
        // M-60: lihat aturan cetak qris/topup — "Rp0" tidak pernah dicetak.
        title: translate("Penarikan menunggu OTP — {x}", {
          x: action.amount > 0 ? formatRupiah(action.amount) : "nominal belum diketahui",
        }),
        meta: action.expiresAt
          ? translate("Kode OTP berlaku sampai {x}", { x: formatDateTimeWIB(action.expiresAt) })
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
    // E-03 (audit 2026-09-22): `expiresAt` datang dari respons server (domain
    // jam server, lihat lib/pending-actions.ts A-02). Membandingkannya dengan
    // `Date.now()` perangkat membuat banner hilang sendiri di perangkat yang
    // jamnya maju (padahal pembayaran masih hidup) atau bertahan setelah
    // kedaluwarsa di perangkat yang jamnya mundur.
    const now = serverNow()
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
          accessibilityLabel={translate("Buka aksi menggantung: {x}", { x: info.title })}
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
