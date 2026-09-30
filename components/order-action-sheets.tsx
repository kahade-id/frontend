/**
 * Kahade — sheet aksi & dialog detail order (bayar/batal/tolak/sengketa/
 * resi + dialog konfirmasi + overlay progres pembayaran).
 *
 * R2 (audit ronde-2, butir #94): diekstrak dari `app/order/[id].tsx` (1.407
 * baris, pelanggar ratchet S9). Seluruh JSX & komentar audit dipindah apa
 * adanya; state & mutasi tetap di layar, komponen ini murni presentasi +
 * meneruskan callback. `OrderPaymentSheet` juga dipakai tes komponen.
 */
import { useEffect, useRef, useState } from "react"
import { TextInput, View } from "react-native"
import { router } from "expo-router"
import { ArrowUDownLeft, ChatCircleDots, Receipt, ShieldWarning, Timer } from "phosphor-react-native"

import {
  cancelOrder,
  confirmOrder,
  submitDispute,
  updateShipping,
  type CancelReason,
  type Order,
  type OrderPaymentMethod,
} from "@/lib/api/orders"
import { CANCEL_REASONS, DISPUTE_CATEGORIES, type DisputeCategoryValue } from "@/lib/labels/dispute"
import { formatRupiah } from "@/lib/format"
import { translate } from "@/lib/i18n"
import { useOrderPayment } from "@/lib/use-order-payment"
import { isWalletCheckoutMethod } from "@/lib/dana-payment"
import { hasSeenCoachMark, markCoachMarkSeen } from "@/lib/coach-mark"
import { ROUTES } from "@/lib/routes"
import { validateTrackingInput } from "@/lib/wallet-batch139"
import { useWalletEnabled } from "@/lib/use-wallet-enabled"
import type { SubmitDisputeDto } from "@/lib/api/types"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Dialog } from "@/components/ui/modal"
import { PinInput } from "@/components/ui/pin-input"
import { DanaCheckoutSheet } from "@/components/dana-checkout-sheet"
import { Radio, RadioGroup } from "@/components/ui/radio"
import { ReasonPicker, type ReasonValue } from "@/components/ui/reason-picker"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { TransactionProgressOverlay } from "@/components/ui/transaction-progress-overlay"

type PaymentBundle = ReturnType<typeof useOrderPayment>

export function OrderPaymentSheet({
  open,
  onClose,
  feeBuyerPays,
  paymentMethods,
  selectedMethod,
  onSelectMethod,
  methodsLoading,
  methodsError,
  onRetryMethods,
  payment,
  submitting,
  pinError,
  onPayPin,
  copied,
  onCopy,
  onRequestRecreate,
  onUseOtherMethod,
  onCreateIntent,
  walletBalance,
  onTopup,
}: {
  open: boolean
  onClose: () => void
  feeBuyerPays: number | null | undefined
  /**
   * Mode Tanpa Wallet Internal (BI-safe): daftar metode dari backend DANA
   * (`GET /v1/orders/{id}/payment-methods`), bukan hardcode. Saldo Kahade
   * hanya ada di daftar bila kill-switch dompet NYALA.
   */
  paymentMethods: OrderPaymentMethod[]
  selectedMethod: OrderPaymentMethod | null
  onSelectMethod: (code: string) => void
  methodsLoading: boolean
  methodsError: string | null
  onRetryMethods: () => void
  /** Siklus intent DANA (lib/use-order-payment.ts) untuk metode terpilih. */
  payment: PaymentBundle
  /** Submitting PIN saldo (cabang dompet saja). */
  submitting: boolean
  pinError: string | undefined
  onPayPin: (pin: string) => void
  copied: boolean
  onCopy: (value: string) => void
  onRequestRecreate: () => void
  onUseOtherMethod: () => void
  onCreateIntent: () => void
  /**
   * U5-010/U5-011 (UX-deep 2026-09-29): saldo dompet saat sheet dibuka
   * (null = belum termuat / dompet mati) — untuk banner inline "saldo
   * kurang" + tombol "Isi Saldo". Murni tampilan; PIN tetap wajib untuk
   * bayar via saldo.
   */
  walletBalance?: number | null
  /** Deep link ke topup; kembali ke sheet setelah sukses (diurus pemanggil). */
  onTopup: () => void
}) {
  /**
   * FE-114: definisi escrow satu kalimat — tampil SEKALI di sheet bayar
   * order pertama user, lalu tidak pernah lagi (flag persisten per
   * perangkat; logout bukan alasan menampilkan ulang). JANGAN duplikasi
   * kalimat ini di tempat lain.
   */
  const [showEscrowDef, setShowEscrowDef] = useState(false)
  useEffect(() => {
    if (!open) return
    let alive = true
    void hasSeenCoachMark("escrow-definition").then((seen) => {
      if (!alive) return
      if (!seen) {
        setShowEscrowDef(true)
        void markCoachMarkSeen("escrow-definition")
      }
    })
    return () => {
      alive = true
    }
  }, [open ])
  // U5-010/U5-011 (UX-deep 2026-09-29): saldo < tagihan → banner inline +
  // CTA "Isi Saldo" (cabang saldo) dan hint metode DANA (cabang DANA).
  // Kondisinya persisten sehingga banner ikut tampil pasca-gagal bayar —
  // dead-end "saldo tidak cukup" selalu punya jalan keluar di titik bayar.
  const insufficientBalance =
    walletBalance != null && feeBuyerPays != null && walletBalance < feeBuyerPays
  const shortfall = insufficientBalance ? feeBuyerPays! - walletBalance! : 0
  const isBalance = selectedMethod != null && isWalletCheckoutMethod(selectedMethod.code)

  const methodAction = isBalance ? (
    <>
      {insufficientBalance ? (
        <Alert
          tone="warning"
          title={translate("Saldo belum cukup")}
          action={
            <Button size="sm" variant="secondary" onPress={onTopup}>
              {translate("Isi Saldo")}
            </Button>
          }
        >
          <Text variant="caption" tone="secondary">
            {translate("Saldo Anda {balance} — kurang {short}.", {
              balance: formatRupiah(walletBalance ?? 0),
              short: formatRupiah(shortfall),
            })}
          </Text>
        </Alert>
      ) : null}
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
  ) : selectedMethod ? (
    <>
      {insufficientBalance ? (
        <Text variant="caption" tone="secondary">
          {translate("Saldo belum cukup — bayar langsung lewat {m}.", {
            m: selectedMethod.name,
          })}
        </Text>
      ) : null}
      <Button loading={payment.creating} onPress={onCreateIntent}>
        {translate("Bayar dengan {m}", { m: selectedMethod.name })}
      </Button>
    </>
  ) : null

  return (
    <DanaCheckoutSheet
      open={open}
      onClose={onClose}
      title="Pembayaran"
      description={
        feeBuyerPays != null
          ? translate("Total {x} masuk ke escrow Kahade.", { x: formatRupiah(feeBuyerPays) })
          : "Total pembayaran belum terkonfirmasi. Muat ulang rincian biaya sebelum membayar."
      }
      topExtra={
        showEscrowDef ? (
          <Text variant="caption" tone="secondary">
            Escrow = dana ditahan Kahade, baru diteruskan ke penjual setelah Anda konfirmasi terima.
          </Text>
        ) : undefined
      }
      methods={paymentMethods}
      selectedMethod={selectedMethod}
      onSelectMethod={onSelectMethod}
      methodsLoading={methodsLoading}
      methodsError={methodsError}
      onRetryMethods={onRetryMethods}
      payment={payment}
      methodAction={methodAction}
      intentTopExtra={
        insufficientBalance && payment.intent?.qrString ? (
          <Text variant="caption" tone="secondary">
            {translate("Saldo belum cukup — QRIS bisa langsung dari m-banking.")}
          </Text>
        ) : undefined
      }
      copied={copied}
      onCopy={onCopy}
      onRequestRecreate={onRequestRecreate}
      onUseOtherMethod={onUseOtherMethod}
      emptyMethodsExtra=" atau hubungi penjual."
    />
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
  /**
   * D16 (batch 139): dialog konfirmasi resi — penjual melihat kembali
   * kurir + nomor resi persis seperti yang akan disimpan, sebelum data
   * dikirim. Resi salah = pembeli tidak bisa melacak.
   */
  // FE-112: state dialog konfirmasi resi dihapus — tidak ada dialog kedua.
  // FRM-008: rantai fokus Next Kurir -> Nomor resi.
  const trackingRef = useRef<TextInput>(null)
  const trackingValidation = validateTrackingInput(courier, tracking, shippingRequired)
  const trackingValid = !trackingValidation.courierError && !trackingValidation.trackingError
  return (
    <>
      {/* ── Batalkan ──────────────────────────────────────────── */}
      <BottomSheet
        avoidKeyboard
        visible={sheet === "cancel"}
        onRequestClose={onClose}
        title="Batalkan pesanan?"
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
        title="Tolak pesanan?"
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

      {/* SEC-DSP-FE-02: dialog konfirmasi akhir — dana dibekukan, tak bisa batal sepihak.
          FE-113: deskripsi dialog FOKUS konsekuensi; penjelasan bukti sudah
          ada di sheet ("Bukti foto bisa ditambahkan setelah sengketa
          dibuat") — tidak diulang di sini. */}
      <Dialog
        title="Buka sengketa?"
        description="Dana escrow akan dibekukan sampai mediator Kahade memutuskan. Sengketa yang sudah dibuka tidak bisa dibatalkan sepihak."
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
            // D16: validasi format resi/kurir — bukan sekadar panjang minimal.
            // FE-112: "Simpan" langsung menyimpan (validasi/submit existing) —
            // TANPA dialog konfirmasi kedua. Resi bisa diedit kapan saja, jadi
            // ringkasan "apa yang akan dikirim" tidak menambah keamanan.
            disabled={!trackingValid}
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
          <Field
            label="Kurir"
            required={shippingRequired}
            errorText={trackingValidation.courierError}
          >
            <Input
              value={courier}
              onChangeText={onChangeCourier}
              placeholder="JNE, SiCepat, …"
              autoCapitalize="words"
              returnKeyType="next"
              // FRM-008: Next memindahkan fokus ke Nomor resi.
              onSubmitEditing={() => trackingRef.current?.focus()}
              maxLength={100}
            />
          </Field>
          <Field
            label="Nomor resi"
            required={shippingRequired}
            errorText={trackingValidation.trackingError}
          >
            <Input
              ref={trackingRef}
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

      {/* FE-112: dialog konfirmasi kedua DIHAPUS — "Simpan" di sheet langsung menyimpan. */}

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
  canReturn,
  returnIsPrimary,
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
  /** Pembeli + order COMPLETED — layar /returns/new memverifikasi ulang syarat via server. */
  canReturn: boolean
  /**
   * Item 46: true bila "Ajukan retur" sudah naik jadi aksi PRIMER di
   * OrderDetailActions — tombol sekunder yang sama disembunyikan.
   */
  returnIsPrimary: boolean
  submitting: boolean
  onOpenSheet: (sheet: "dispute" | "cancel") => void
}) {
  // Mode Tanpa Wallet Internal (BI-safe): tombol "Lihat mutasi dana"
  // disembunyikan saat kill-switch dompet mati.
  const walletEnabled = useWalletEnabled()
  return (
    <>
      <View className="flex-row flex-wrap gap-2">
      {/* H-08 (audit escrow 2026-09-24): invoice "belum diterbitkan" untuk
          WAITING_CONFIRMATION dan CANCELLED — tombol disembunyikan, bukan
          membuka layar struk kosong. */}
      {order.status !== "WAITING_CONFIRMATION" && order.status !== "CANCELLED" ? (
        <Button
          fullWidth={false}
          variant="secondary"
          size="sm"
          leftIcon={Receipt}
          onPress={() => router.push(ROUTES.invoice(order.id))}
        >
          Invoice
        </Button>
      ) : null}
      <Button
        fullWidth={false}
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
        // Mode Tanpa Wallet Internal (BI-safe): tombol "Lihat mutasi dana"
        // disembunyikan saat kill-switch dompet mati.
        <>
          <Button fullWidth={false} variant="secondary" size="sm" onPress={() => router.push(ROUTES.createTransaction)}>
            Buat transaksi baru
          </Button>
          {walletEnabled ? (
            <Button fullWidth={false} variant="secondary" size="sm" onPress={() => router.push(ROUTES.walletHistory)}>
              Lihat mutasi dana
            </Button>
          ) : null}
        </>
      ) : null}
      {canExtend ? (
        <Button
          fullWidth={false}
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
          fullWidth={false}
          variant="secondary"
          size="sm"
          leftIcon={ShieldWarning}
          onPress={() => router.push(ROUTES.disputes)}
        >
          Lihat sengketa
        </Button>
      ) : canDispute ? (
        <Button
          fullWidth={false}
          variant="secondary"
          size="sm"
          leftIcon={ShieldWarning}
          onPress={() => onOpenSheet("dispute")}
        >
          {/* FE-046: label jujur — tombol ini langsung membuka ajuan sengketa
              (yang membekukan dana), bukan sekadar "laporan". */}
          Ajukan sengketa
        </Button>
      ) : null}
      {canReturn && !returnIsPrimary ? (
        <Button
          fullWidth={false}
          variant="secondary"
          size="sm"
          leftIcon={ArrowUDownLeft}
          onPress={() => router.push(ROUTES.newReturn(order.id))}
        >
          Ajukan retur
        </Button>
      ) : null}
      {canCancel ? (
        <Button fullWidth={false} variant="ghost" size="sm" onPress={() => onOpenSheet("cancel")} disabled={submitting}>
          Batalkan pesanan
        </Button>
      ) : null}
    </View>
    </>
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
  completeOpen,
  completeLoading,
  onCompleteConfirm,
  onCompleteClose,
  escrowAmount,
  acceptSellerAmount,
  acceptFeeNote,
}: {
  acceptOpen: boolean
  acceptLoading: boolean
  onAcceptConfirm: () => void
  onAcceptClose: () => void
  recreateOpen: boolean
  recreateLoading: boolean
  onRecreateConfirm: () => void
  onRecreateClose: () => void
  /** Item 32: dialog konfirmasi SEBELUM dana escrow dilepas. */
  completeOpen: boolean
  completeLoading: boolean
  onCompleteConfirm: () => void
  onCompleteClose: () => void
  /** TRX-020: nominal dana escrow yang akan dilepas ke penjual — wajib tampil. */
  escrowAmount?: number
  /**
   * T2-008: nominal bersih yang diterima penjual (dari `fee.sellerReceives`
   * di layar) — keputusan finansial menerima beban biaya tidak boleh
   * diambil tanpa melihat angkanya.
   */
  acceptSellerAmount?: number
  /** T2-008: catatan siapa menanggung biaya layanan. */
  acceptFeeNote?: string
}) {
  return (
    <>
      <Dialog
        title="Terima pesanan ini?"
        // N-02 (audit escrow 2026-09-24): `confirmOrder({action:"ACCEPT"})`
        // terjadi SEBELUM pembayaran — copy lama ("…setelah pembeli membayar")
        // membuat penjual menunggu pembayaran yang justru baru bisa dilakukan
        // setelah order diterima.
        description="Pesanan diterima, dan pembeli dapat melanjutkan pembayaran ke escrow. Selesaikan pekerjaan sesuai kesepakatan setelah dana masuk."
        visible={acceptOpen}
        loading={acceptLoading}
        confirmLabel="Terima"
        cancelLabel="Tutup"
        onConfirm={onAcceptConfirm}
        onCancel={onAcceptClose}
        onRequestClose={onAcceptClose}
      >
        {/* T2-008: blok nominal di dialog terima pesanan — pola sama seperti
            dialog konfirmasi terima (TRX-020). */}
        {typeof acceptSellerAmount === "number" && Number.isFinite(acceptSellerAmount) ? (
          <View
            className="mt-3 rounded-md border border-border bg-surface p-4"
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Anda akan menerima: ${formatRupiah(acceptSellerAmount)}${acceptFeeNote ? ` (${acceptFeeNote})` : ""}`}
          >
            <Text variant="caption" tone="secondary">
              Anda akan menerima
            </Text>
            <Text variant="h2" tone="primary" className="tabular-nums">
              {formatRupiah(acceptSellerAmount)}
            </Text>
            {acceptFeeNote ? (
              <Text variant="caption" tone="secondary">
                ({acceptFeeNote})
              </Text>
            ) : null}
          </View>
        ) : null}
      </Dialog>

      <Dialog
        title="Buat ulang pembayaran?"
        description="Kode bayar aktif akan dibuang dan diganti kode baru. Jika Anda sudah membayar kode lama, cek status dulu — pembayaran yang sudah masuk tetap tercatat."
        visible={recreateOpen}
        loading={recreateLoading}
        confirmLabel="Ya, buat ulang"
        cancelLabel="Tutup"
        onConfirm={onRecreateConfirm}
        onCancel={onRecreateClose}
        onRequestClose={onRecreateClose}
      />

      <Dialog
        title="Konfirmasi terima barang?"
        description="Dana akan diteruskan ke penjual dan tidak bisa dibatalkan. Pastikan barang/jasa sudah Anda terima dan sesuai kesepakatan."
        visible={completeOpen}
        loading={completeLoading}
        confirmLabel="Ya, konfirmasi terima"
        cancelLabel="Belum"
        onConfirm={onCompleteConfirm}
        onCancel={onCompleteClose}
        onRequestClose={onCompleteClose}
      >
        {/* TRX-020: nominal dana escrow yang dilepas — keputusan finansial
            tidak boleh diambil tanpa melihat angkanya. */}
        {typeof escrowAmount === "number" && Number.isFinite(escrowAmount) ? (
          <View
            className="mt-3 rounded-md border border-border bg-surface p-4"
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Dana escrow yang akan dilepas: ${formatRupiah(escrowAmount)}`}
          >
            <Text variant="caption" tone="secondary">
              Dana escrow yang dilepas ke penjual
            </Text>
            <Text variant="h2" tone="primary" className="tabular-nums">
              {formatRupiah(escrowAmount)}
            </Text>
          </View>
        ) : null}
      </Dialog>
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
