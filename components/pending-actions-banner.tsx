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
import { useWalletEnabled } from "@/lib/use-wallet-enabled"
import { serverNow } from "@/lib/server-time"
import { useAuthSession } from "@/lib/use-auth-session"
import { cn } from "@/lib/cn"

import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"

function actionKey(action: PendingAction): string {
  return action.kind === "withdraw-otp"
    ? `${action.kind}:${action.txId}`
    : action.kind === "qris-payment" || action.kind === "order-payment"
      ? `${action.kind}:${action.orderId}`
      : action.kind === "topup-unpaid"
        ? `${action.kind}:${action.paymentTxId}`
        : `${action.kind}:${action.idempotencyKey}`
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
    case "order-payment":
      return {
        title: translate("Pembayaran pesanan menunggu — {x}", {
          x: action.amount > 0 ? formatRupiah(action.amount) : "nominal belum diketahui",
        }),
        meta: action.expiresAt
          ? translate("{m} berlaku sampai {x}", {
              m: action.methodName ?? "Kode bayar",
              x: formatDateTimeWIB(action.expiresAt),
            })
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
    case "transfer-uncertain":
      // D07 (batch 139): jangan pernah mengklaim gagal/berhasil — status
      // tak pasti; arahkan ke riwayat (kebenaran server).
      return {
        title: translate("Transfer belum pasti — {x} ke {y}", {
          x: action.amount > 0 ? formatRupiah(action.amount) : "nominal belum diketahui",
          y: action.recipientName,
        }),
        meta: "Periksa riwayat sebelum mengirim ulang",
      }
  }
}

function targetOf(action: PendingAction) {
  switch (action.kind) {
    case "qris-payment":
    case "order-payment":
      // D11 (batch 139): pulihkan ke detail order BERDASAR ID server +
      // buka ulang sheet bayar (?sheet=pay) — quote/status selalu dibaca
      // ulang dari server saat layar dibuka, bukan state lokal basi.
      return {
        pathname: "/order/[id]" as "/order/[id]",
        params: { id: action.orderId, sheet: "pay" },
      }
    case "topup-unpaid":
      // D11 (batch 139): pulihkan BERDASAR ID server — layar /topup membaca
      // ?resumePayment=<paymentTxId> lalu GET status dari server (bukan state
      // lokal yang sudah hilang saat app mati).
      return {
        pathname: "/topup" as "/topup",
        params: { resumePayment: action.paymentTxId },
      }
    case "withdraw-otp":
      return ROUTES.withdraw
    case "transfer-uncertain":
      // D07 (batch 139): pulihkan dengan memeriksa kebenaran server —
      // riwayat transaksi, bukan mengulang kirim buta.
      return ROUTES.walletHistory
  }
}

export function PendingActionsBanner() {
  const { token } = useAuthSession()
  const actions = usePendingActions()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  // Mode Tanpa Wallet Internal (BI-safe): aksi dompet yang tidak lagi bisa
  // diselesaikan (top-up, transfer) disembunyikan — hanya penarikan (jalur
  // saldo lama) & pembayaran order yang tetap ditampilkan.
  const walletEnabled = useWalletEnabled()

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
      .filter(
        (a) =>
          walletEnabled ||
          (a.kind !== "topup-unpaid" && a.kind !== "transfer-uncertain"),
      )
      .sort((a, b) => (a.expiresAt ?? Infinity) - (b.expiresAt ?? Infinity))
  }, [actions, dismissed, walletEnabled])

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
          // UI-T018 (audit UI/UX 2026-09-27): target sentuh ≥ 44pt — sebelumnya
          // hanya ikon kecil dengan padding 6pt.
          containerClassName={cn("rounded-md p-1.5")}
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <Icon icon={X} size="sm" />
        </PressableScale>
      </View>
    </View>
  )
}
