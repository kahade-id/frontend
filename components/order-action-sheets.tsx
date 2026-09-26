/**
 * Kahade — sheet aksi & dialog detail order (bayar/batal/tolak/sengketa/
 * resi + dialog konfirmasi + overlay progres pembayaran).
 *
 * R2 (audit ronde-2, butir #94): diekstrak dari `app/order/[id].tsx` (1.407
 * baris, pelanggar ratchet S9). Seluruh JSX & komentar audit dipindah apa
 * adanya; state & mutasi tetap di layar, komponen ini murni presentasi +
 * meneruskan callback. `OrderPaymentSheet` juga dipakai tes komponen.
 */
import { useState } from "react"
import { View } from "react-native"
import { router } from "expo-router"
import { ChatCircleDots, Receipt, ShieldWarning, Timer } from "phosphor-react-native"

import {
  cancelOrder,
  confirmOrder,
  submitDispute,
  updateShipping,
  type CancelReason,
  type Order,
  type QrisPayment,
} from "@/lib/api/orders"
import { CANCEL_REASONS, DISPUTE_CATEGORIES, type DisputeCategoryValue } from "@/lib/labels/dispute"
import { formatRupiah } from "@/lib/format"
import { translate } from "@/lib/i18n"
import { useQrisPayment } from "@/lib/use-qris-payment"
import { ROUTES } from "@/lib/routes"
import { useToast } from "@/components/ui/toast"
import type { SubmitDisputeDto } from "@/lib/api/types"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Dialog } from "@/components/ui/modal"
import { PinInput } from "@/components/ui/pin-input"
import { QrisPaymentPanel } from "@/components/qris-payment-panel"
import { Radio, RadioGroup } from "@/components/ui/radio"
import { ReasonPicker, type ReasonValue } from "@/components/ui/reason-picker"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { TransactionProgressOverlay } from "@/components/ui/transaction-progress-overlay"

type PayMethod = "balance" | "qris"
const PAY_METHODS: { value: PayMethod; label: string }[] = [
  { value: "balance", label: "Saldo Kahade" },
  { value: "qris", label: "QRIS" },
]

type QrisBundle = ReturnType<typeof useQrisPayment>

export function OrderPaymentSheet({
  open,
  onClose,
  feeBuyerPays,
  payMethod,
  onChangePayMethod,
  submitting,
  pinError,
  onPayPin,
  qrisPayment,
  qrisStatus,
  pollError,
  copied,
  onCopy,
  onRequestRecreate,
  onUseOtherMethod,
  onShowQris,
}: {
  open: boolean
  onClose: () => void
  feeBuyerPays: number | null | undefined
  payMethod: PayMethod
  onChangePayMethod: (method: PayMethod) => void
  submitting: boolean
  pinError: string | undefined
  onPayPin: (pin: string) => void
  qrisPayment: QrisBundle
  qrisStatus: QrisBundle["status"]
  pollError: QrisBundle["pollError"]
  copied: boolean
  onCopy: (value: string) => void
  onRequestRecreate: () => void
  onUseOtherMethod: () => void
  onShowQris: () => void
}) {
  const qris: QrisPayment | null = qrisPayment.qris
  const toast = useToast()
  const handleCheckStatus = () => {
    // N-07 (audit escrow 2026-09-24): "Cek status sekarang" memberi umpan
    // balik hasil — dulu hanya diam (atau `pollError` bila gagal), pengguna
    // tidak tahu status sudah dicek.
    void qrisPayment.syncStatus().then((s) => {
      if (s == null) return
      toast.show({
        title:
          s === "PAID"
            ? "Pembayaran diterima"
            : s === "PENDING"
              ? "Status diperbarui — belum terbayar"
              : // M-32 (audit end-to-end, issue #78): enum mentah ("EXPIRED",
                // "UNKNOWN", …) tidak dipaparkan ke user.
                s === "EXPIRED"
                ? "QRIS sudah kedaluwarsa"
                : s === "FAILED"
                  ? "Pembayaran gagal"
                  : s === "CANCELLED"
                    ? "Pembayaran dibatalkan"
                    : s === "UNKNOWN"
                      ? "Status belum pasti — cek lagi sebentar lagi"
                      : "Status diperbarui",
        tone: s === "PAID" ? "success" : "info",
        duration: 2500,
      })
    })
  }
  return (
    <BottomSheet
      avoidKeyboard
      visible={open}
      onRequestClose={onClose}
      title="Pembayaran"
      description={
        feeBuyerPays != null
          ? translate("Total {x} masuk ke escrow Kahade.", { x: formatRupiah(feeBuyerPays) })
          : "Total pembayaran belum terkonfirmasi. Muat ulang rincian biaya sebelum membayar."
      }
    >
      <View className="gap-4">
        <SegmentedControl<PayMethod>
          items={PAY_METHODS}
          accessibilityLabel="Metode pembayaran"
          value={payMethod}
          onChange={onChangePayMethod}
          disabled={submitting || qris != null}
        />
        {payMethod === "balance" ? (
          <>
            <Text variant="body" tone="secondary">
              Masukkan PIN dompet untuk membayar dari saldo Kahade.
            </Text>
            <PinInput
              mode="enter"
              onComplete={onPayPin}
              errorText={pinError}
              // R2 (audit ronde-2, butir #32): TANPA rincian biaya terverifikasi
              // (`fee.buyerPays`) PIN HARUS mati — pembayaran buta (otorisasi
              // nominal yang tak pernah dilihat) dilarang, bukan cuma diperingatkan.
              disabled={submitting || feeBuyerPays == null}
            />
          </>
        ) : qris ? (
          /* Panel QRIS diekstrak ke components/qris-payment-panel.tsx (S9):
             state & mutasi tetap di layar ini, panel hanya presentasi. */
          <QrisPaymentPanel
            qrString={qris.qrString}
            amount={qris.amount}
            expiresAt={qris.expiresAt}
            status={qrisStatus}
            pollError={pollError}
            pollStopped={qrisPayment.stopped}
            submitting={submitting || qrisPayment.creating}
            copied={copied}
            onCopy={onCopy}
            onExpire={qrisPayment.expireLocally}
            onRecreate={onRequestRecreate}
            onUseOtherMethod={onUseOtherMethod}
            onCheckStatus={handleCheckStatus}
          />
        ) : (
          <Button loading={submitting || qrisPayment.creating} onPress={onShowQris}>
            Tampilkan kode QRIS
          </Button>
        )}
      </View>
    </BottomSheet>
  )
}

export function OrderActionSheets({
  sheet,
  onClose,
  order,
  submitting,
  cancelValid,
  cancelReason,
  onChangeCancelReason,
  rejectReason,
  onChangeRejectReason,
  disputeClaim,
  onChangeDisputeClaim,
  disputeCategory,
  onChangeDisputeCategory,
  tracking,
  onChangeTracking,
  courier,
  onChangeCourier,
  shippingRequired,
  runAction,
  noteMax,
  disputeClaimMin,
  disputeClaimMax,
}: {
  sheet: "cancel" | "reject" | "dispute" | "shipping" | null
  onClose: () => void
  order: Order
  submitting: boolean
  cancelValid: boolean
  cancelReason: ReasonValue
  onChangeCancelReason: (value: ReasonValue) => void
  rejectReason: string
  onChangeRejectReason: (value: string) => void
  disputeClaim: string
  onChangeDisputeClaim: (value: string) => void
  disputeCategory: DisputeCategoryValue | undefined
  onChangeDisputeCategory: (value: DisputeCategoryValue | undefined) => void
  tracking: string
  onChangeTracking: (value: string) => void
  courier: string
  onChangeCourier: (value: string) => void
  shippingRequired: boolean
  runAction: (fn: () => Promise<unknown>, success: string, failure: string) => Promise<unknown>
  noteMax: number
  disputeClaimMin: number
  disputeClaimMax: number
}) {
  // SEC-DSP-FE-02: konfirmasi akhir sebelum sengketa dibuka (dana dibekukan, tak bisa batal sepihak).
  const [disputeConfirmOpen, setDisputeConfirmOpen] = useState(false)
  return (
    <>
      {/* ── Batalkan ──────────────────────────────────────────── */}
      <BottomSheet
        avoidKeyboard
        visible={sheet === "cancel"}
        onRequestClose={onClose}
        title="Batalkan order?"
        // EO-001 (audit 2026-09-26): janji refund dihapus. Gate `isCancellable`
        // kini hanya membuka WAITING_CONFIRMATION/WAITING_PAYMENT (selaras
        // backend `cancelOrder`) — status pra-bayar tidak punya dana di escrow,
        // jadi copy yang jujur adalah TIDAK ADA pengembalian dana. Cabang lama
        // ("dana di escrow dikembalikan") adalah janji yang tak bisa ditepati
        // karena backend menolak pembatalan PROCESSING/PAID.
        description={
          "Order akan dibatalkan. Belum ada dana di escrow untuk status ini — tidak ada pengembalian dana."
        }
        footer={
          <Button
            variant="destructive"
            fullWidth
            loading={submitting}
            disabled={!cancelValid}
            onPress={() =>
              void runAction(
                () =>
                  cancelOrder(order.id, {
                    reason: cancelReason.code as CancelReason,
                    note: cancelReason.note.trim() || undefined,
                  }),
                "Order dibatalkan",
                "Gagal membatalkan order",
              )
            }
          >
            Batalkan pesanan
          </Button>
        }
      >
        <ReasonPicker
          options={CANCEL_REASONS}
          value={cancelReason}
          onChange={onChangeCancelReason}
          noteMaxLength={noteMax}
          disabled={submitting}
        />
      </BottomSheet>

      {/* ── Tolak (penjual) ───────────────────────────────────── */}
      <BottomSheet
        avoidKeyboard
        visible={sheet === "reject"}
        onRequestClose={onClose}
        title="Tolak order?"
        description="Pembeli akan diberi tahu beserta alasan Anda."
        footer={
          <Button
            variant="destructive"
            fullWidth
            loading={submitting}
            onPress={() =>
              void runAction(
                () =>
                  confirmOrder(order.id, {
                    action: "REJECT",
                    reason: rejectReason.trim() || undefined,
                  }),
                "Order ditolak",
                "Gagal menolak order",
              )
            }
          >
            Tolak pesanan
          </Button>
        }
      >
        <TextArea
          value={rejectReason}
          onChangeText={onChangeRejectReason}
          placeholder="Alasan penolakan (opsional)"
          maxLength={noteMax}
          multiline
          numberOfLines={3}
        />
      </BottomSheet>

      {/* ── Sengketa ──────────────────────────────────────────── */}
      <BottomSheet
        avoidKeyboard
        visible={sheet === "dispute"}
        onRequestClose={onClose}
        title="Ajukan sengketa"
        description="Dana escrow dibekukan sampai mediator Kahade memutuskan. Bukti foto bisa ditambahkan setelah sengketa dibuat — siapkan foto unboxing/kerusakan, resi, atau screenshot chat yang relevan."
        footer={
          <Button
            variant="destructive"
            fullWidth
            loading={submitting}
            disabled={disputeClaim.trim().length < disputeClaimMin || !disputeCategory}
            onPress={() => setDisputeConfirmOpen(true)}
          >
            Buka sengketa
          </Button>
        }
      >
        <Field label="Kategori" required>
          <RadioGroup
            accessibilityLabel="Kategori sengketa"
            value={disputeCategory}
            onChange={(v) => onChangeDisputeCategory(v as DisputeCategoryValue)}
            variant="plain"
          >
            {DISPUTE_CATEGORIES.map((c) => (
              <Radio key={c.value} value={c.value} label={c.label} />
            ))}
          </RadioGroup>
        </Field>
        <Field
          label="Klaim Anda"
          required
          helperText={translate("Minimal {x} karakter — jelaskan apa yang tidak sesuai.", {
            x: disputeClaimMin,
          })}
        >
          <TextArea
            value={disputeClaim}
            onChangeText={onChangeDisputeClaim}
            placeholder="Barang tidak sesuai deskripsi karena…"
            maxLength={disputeClaimMax}
            multiline
            numberOfLines={5}
          />
        </Field>
      </BottomSheet>

      {/* SEC-DSP-FE-02: dialog konfirmasi akhir — dana dibekukan, tak bisa batal sepihak. */}
      <Dialog
        title="Buka sengketa?"
        description={`Dana escrow akan DIBEKUKAN sampai mediator Kahade memutuskan. Sengketa yang sudah dibuka tidak bisa dibatalkan sepihak.\n\nPastikan klaim sudah jelas — bukti foto/video bisa ditambahkan setelah sengketa dibuat.`}
        visible={disputeConfirmOpen}
        destructive
        loading={submitting}
        confirmLabel="Ya, buka sengketa"
        cancelLabel="Periksa lagi"
        onConfirm={() => {
          setDisputeConfirmOpen(false)
          // R2 (audit ronde-2, butir #53): respons submitDispute membawa
          // id sengketa baru — navigasi langsung ke sana, jangan buang.
          void runAction(
            () =>
              submitDispute(order.id, {
                claim: disputeClaim.trim(),
                category: disputeCategory as SubmitDisputeDto["category"],
              }),
            "Sengketa dibuka",
            "Gagal membuka sengketa",
          ).then((result) => {
            const disputeId =
              result && typeof result === "object"
                ? (result as { id?: unknown }).id
                : undefined
            if (typeof disputeId === "string" && disputeId)
              router.push(ROUTES.disputeDetail(disputeId))
          })
        }}
        onCancel={() => setDisputeConfirmOpen(false)}
        onRequestClose={() => setDisputeConfirmOpen(false)}
      />

      {/* ── Resi / kirim (penjual) ────────────────────────────── */}
      <BottomSheet
        avoidKeyboard
        visible={sheet === "shipping"}
        onRequestClose={onClose}
        title={shippingRequired ? "Info pengiriman" : "Tandai dikirim"}
        description={
          shippingRequired
            ? "Nomor resi & kurir wajib untuk barang fisik."
            : "Untuk jasa/digital, resi opsional — pembeli akan diminta memeriksa hasil."
        }
        footer={
          <Button
            fullWidth
            loading={submitting}
            disabled={shippingRequired && (tracking.trim().length < 3 || courier.trim().length < 2)}
            onPress={() =>
              void runAction(
                () =>
                  updateShipping(order.id, {
                    trackingNumber: tracking.trim() || undefined,
                    courierName: courier.trim() || undefined,
                  }),
                "Info pengiriman disimpan",
                "Gagal menyimpan info pengiriman",
              )
            }
          >
            Simpan
          </Button>
        }
      >
        <View className="gap-4">
          <Field label="Kurir" required={shippingRequired}>
            <Input
              value={courier}
              onChangeText={onChangeCourier}
              placeholder="JNE, SiCepat, …"
              autoCapitalize="words"
              returnKeyType="next"
              maxLength={100}
            />
          </Field>
          <Field label="Nomor resi" required={shippingRequired}>
            <Input
              value={tracking}
              onChangeText={onChangeTracking}
              placeholder="Nomor resi"
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              returnKeyType="done"
              maxLength={100}
            />
          </Field>
        </View>
      </BottomSheet>
    </>
  )
}

/**
 * Aksi sekunder ("Lainnya"): invoice, chat, jalur keluar REFUNDED/EXPIRED,
 * perpanjang tenggat, pintu sengketa, batal. (R2 #94 — ekstraksi layar.)
 */
export function OrderSecondaryActions({
  order,
  chatBusy,
  onOpenChat,
  canExtend,
  isDisputed,
  canDispute,
  canCancel,
  submitting,
  onOpenSheet,
}: {
  order: Order
  chatBusy: boolean
  onOpenChat: () => void
  canExtend: boolean
  isDisputed: boolean
  canDispute: boolean
  canCancel: boolean
  submitting: boolean
  onOpenSheet: (sheet: "dispute" | "cancel") => void
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {/* H-08 (audit escrow 2026-09-24): invoice "belum diterbitkan" untuk
          WAITING_CONFIRMATION dan CANCELLED — tombol disembunyikan, bukan
          membuka layar struk kosong. */}
      {order.status !== "WAITING_CONFIRMATION" && order.status !== "CANCELLED" ? (
        <Button
          variant="secondary"
          size="sm"
          leftIcon={Receipt}
          onPress={() => router.push(ROUTES.invoice(order.id))}
        >
          Invoice
        </Button>
      ) : null}
      <Button
        variant="secondary"
        size="sm"
        leftIcon={ChatCircleDots}
        onPress={onOpenChat}
        loading={chatBusy}
      >
        Chat
      </Button>
      {order.status === "REFUNDED" || order.status === "EXPIRED" ? (
        // A-11 (audit escrow 2026-09-24): order berstatus REFUNDED/EXPIRED
        // dulu hanya punya badge — pengguna tidak tahu harus berbuat apa
        // setelah dananya kembali. Dua jalur keluar eksplisit: buat
        // transaksi baru, atau periksa mutasi pengembalian dana.
        <>
          <Button variant="secondary" size="sm" onPress={() => router.push(ROUTES.createTransaction)}>
            Buat transaksi baru
          </Button>
          <Button variant="secondary" size="sm" onPress={() => router.push(ROUTES.walletHistory)}>
            Lihat mutasi dana
          </Button>
        </>
      ) : null}
      {canExtend ? (
        <Button
          variant="secondary"
          size="sm"
          leftIcon={Timer}
          onPress={() => router.push(ROUTES.extension(order.id))}
        >
          Perpanjang tenggat
        </Button>
      ) : null}
      {isDisputed ? (
        <Button
          variant="secondary"
          size="sm"
          leftIcon={ShieldWarning}
          onPress={() => router.push(ROUTES.disputes)}
        >
          Lihat sengketa
        </Button>
      ) : canDispute ? (
        <Button
          variant="ghost"
          size="sm"
          leftIcon={ShieldWarning}
          onPress={() => onOpenSheet("dispute")}
        >
          Ajukan sengketa
        </Button>
      ) : null}
      {canCancel ? (
        <Button variant="ghost" size="sm" onPress={() => onOpenSheet("cancel")} disabled={submitting}>
          Batalkan pesanan
        </Button>
      ) : null}
    </View>
  )
}

export function OrderConfirmDialogs({
  acceptOpen,
  acceptLoading,
  onAcceptConfirm,
  onAcceptClose,
  recreateOpen,
  recreateLoading,
  onRecreateConfirm,
  onRecreateClose,
}: {
  acceptOpen: boolean
  acceptLoading: boolean
  onAcceptConfirm: () => void
  onAcceptClose: () => void
  recreateOpen: boolean
  recreateLoading: boolean
  onRecreateConfirm: () => void
  onRecreateClose: () => void
}) {
  return (
    <>
      <Dialog
        title="Terima order ini?"
        // N-02 (audit escrow 2026-09-24): `confirmOrder({action:"ACCEPT"})`
        // terjadi SEBELUM pembayaran — copy lama ("…setelah pembeli membayar")
        // membuat penjual menunggu pembayaran yang justru baru bisa dilakukan
        // setelah order diterima.
        description="Order diterima, dan pembeli dapat melanjutkan pembayaran ke escrow. Selesaikan pekerjaan sesuai kesepakatan setelah dana masuk."
        visible={acceptOpen}
        loading={acceptLoading}
        confirmLabel="Terima"
        cancelLabel="Tutup"
        onConfirm={onAcceptConfirm}
        onCancel={onAcceptClose}
        onRequestClose={onAcceptClose}
      />

      <Dialog
        title="Buat ulang QRIS?"
        description="Kode QR aktif akan dibuang dan diganti kode baru. Jika Anda sudah membayar kode lama, cek status dulu — pembayaran yang sudah masuk tetap tercatat."
        visible={recreateOpen}
        loading={recreateLoading}
        confirmLabel="Ya, buat ulang"
        cancelLabel="Tutup"
        onConfirm={onRecreateConfirm}
        onCancel={onRecreateClose}
        onRequestClose={onRecreateClose}
      />
    </>
  )
}

export function OrderPayProgressOverlay({
  visible,
  state,
  feeBuyerPays,
  error,
}: {
  visible: boolean
  state: "PROCESSING" | "SUCCESS" | "FAILURE"
  feeBuyerPays: number | null | undefined
  error?: string
}) {
  return (
    <TransactionProgressOverlay
      visible={visible}
      state={state}
      processingMessage={
        // C-12 (audit escrow 2026-09-24): fee null tidak mencetak "Membayar
        // Rp0 dari saldo…" — tanpa angka yang pasti, tanpa nominal palsu.
        feeBuyerPays != null
          ? translate("Membayar {x} dari saldo…", { x: formatRupiah(feeBuyerPays) })
          : "Membayar dari saldo…"
      }
      successMessage="Pembayaran berhasil"
      failureMessage={error ?? "Pembayaran gagal. Coba lagi."}
    />
  )
}
