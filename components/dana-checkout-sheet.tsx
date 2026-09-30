/**
 * Kahade — sheet checkout DANA generik (Mode Tanpa Wallet Internal, BI-safe).
 *
 * Diekstrak dari `OrderPaymentSheet` (components/order-action-sheets.tsx):
 * daftar metode dinamis dari backend (render dinamis, jangan hardcode),
 * panel intent per jenis (QRIS / Virtual Account / redirect), dan logika
 * "Cek status sekarang". Bagian yang spesifik-order (PIN saldo, copy escrow,
 * banner saldo kurang) TIDAK ada di sini — pemanggil menyuntiknya lewat slot
 * (`topExtra`, `methodAction`, `intentTopExtra`), sehingga sheet ini dipakai
 * ulang untuk checkout langganan Kahade+ maupun konteks DANA lain.
 */
import type { ReactNode } from "react"
import { memo, useCallback } from "react"
import { View } from "react-native"

import type { OrderPaymentMethod } from "@/lib/api/orders"
import { useDanaIntent } from "@/lib/use-dana-intent"
import { toCheckoutMethodItems, type CheckoutMethodItem, type DanaMethodKind } from "@/lib/dana-payment"
import { cn } from "@/lib/cn"
import { translate } from "@/lib/i18n"
import { useToast } from "@/components/ui/toast"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { QrisPaymentPanel } from "@/components/qris-payment-panel"
import { DanaRedirectPanel, VaPaymentPanel } from "@/components/dana-payment-panel"
import { Icon } from "@/components/ui/icon"
import { paymentMethodKindIcon } from "@/components/ui/payment-method-selector"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"

/** Bundle siklus intent — sama untuk order & langganan. */
export type DanaIntentBundle = ReturnType<typeof useDanaIntent>

/**
 * Petunjuk satu baris per jenis metode — membuat pilihan jelas tanpa
 * penjelasan panjang (standar desain minimalis). Hanya presentasi; tidak
 * memengaruhi metode apa pun.
 */
const METHOD_KIND_HINT: Record<DanaMethodKind, string | null> = {
  qris: "Pindai dengan aplikasi apa pun",
  bank: "Kode bayar sesuai bank pilihan",
  ewallet: "Otorisasi di aplikasi DANA",
  balance: null,
}

export type DanaCheckoutSheetProps = {
  open: boolean
  onClose: () => void
  title: string
  /** Deskripsi di bawah judul (nominal + tujuan dana) — diformat pemanggil. */
  description?: string
  /**
   * Daftar metode dari backend DANA (jangan hardcode). Metode saldo internal
   * hanya ada bila kill-switch dompet NYALA — pemanggil yang menyaring.
   */
  methods: OrderPaymentMethod[]
  selectedMethod: OrderPaymentMethod | null
  onSelectMethod: (code: string) => void
  methodsLoading: boolean
  methodsError: string | null
  onRetryMethods: () => void
  /** Siklus intent DANA untuk metode terpilih. */
  payment: DanaIntentBundle
  /**
   * Area aksi di bawah daftar metode saat intent==null: tombol "Bayar dengan
   * …" (pemanggil membaca `payment.creating` sendiri) atau cabang PIN saldo
   * khusus order. Kosong = tidak ada aksi (sheet hanya informatif).
   */
  methodAction?: ReactNode
  /** Konten di atas daftar metode (catatan escrow, peringatan, dsb.). */
  topExtra?: ReactNode
  /** Konten di atas panel intent (petunjuk khusus metode/pemanggil). */
  intentTopExtra?: ReactNode
  copied?: boolean
  onCopy?: (value: string) => void
  onRequestRecreate: () => void
  onUseOtherMethod: () => void
  /** Konten tambahan di dalam alert "tidak ada metode" (mis. saran hubungi penjual). */
  emptyMethodsExtra?: ReactNode
}

/** PERF-FIX (TIM1-P1): baris metode di-memo — onPress stabil per id,
 * tidak ada closure inline per baris per render sheet. */
const PaymentMethodRow = memo(function PaymentMethodRow({
  item,
  active,
  disabled,
  onSelect,
}: {
  item: CheckoutMethodItem
  active: boolean
  disabled: boolean
  onSelect: (id: string) => void
}) {
  const handlePress = useCallback(() => onSelect(item.id), [onSelect, item.id])
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      accessibilityLabel={item.name}
      disabled={disabled}
      onPress={handlePress}
      className={cn(
        "flex-row items-center gap-3 rounded-2xl border px-4 py-3",
        active ? "border-primary bg-primary/5" : "border-border",
      )}
    >
      <Icon
        icon={paymentMethodKindIcon[item.kind]}
        size="md"
        tone={active ? "active" : "default"}
      />
      <View className="flex-1 gap-0.5">
        <Text variant="body" tone="primary">
          {item.name}
          {item.recommended ? (
            <Text variant="caption" tone="primary">
              {" "}
              · Disarankan
            </Text>
          ) : null}
        </Text>
        {METHOD_KIND_HINT[item.kind] ? (
          <Text variant="caption" tone="secondary">
            {METHOD_KIND_HINT[item.kind]}
          </Text>
        ) : null}
      </View>
      <View
        className={cn(
          "h-5 w-5 items-center justify-center rounded-full border",
          active ? "border-primary" : "border-border",
        )}
      >
        {active ? <View className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
      </View>
    </PressableScale>
  )
})

export function DanaCheckoutSheet({
  open,
  onClose,
  title,
  description,
  methods,
  selectedMethod,
  onSelectMethod,
  methodsLoading,
  methodsError,
  onRetryMethods,
  payment,
  methodAction,
  topExtra,
  intentTopExtra,
  copied,
  onCopy,
  onRequestRecreate,
  onUseOtherMethod,
  emptyMethodsExtra,
}: DanaCheckoutSheetProps) {
  const intent = payment.intent
  const toast = useToast()

  /**
   * BFI-074: kontrak BE `DanaDirectPayResult` — untuk QRIS, `paymentCode`
   * ADALAH string QR (bukan nomor VA); `qrString` boleh null. Normalizer
   * memetakan `paymentCode` → `intent.vaNumber`, sehingga tanpa pemetaan
   * ini string QR jatuh ke panel Virtual Account (tidak bisa dipindai).
   * Untuk intent QRIS, paymentCode BE ditampilkan sebagai QR.
   */
  const methodCode = intent?.method ?? selectedMethod?.code ?? ""
  const isQrisIntent = methodCode.trim().toUpperCase() === "QRIS"
  const qrString = intent?.qrString ?? (isQrisIntent ? intent?.vaNumber : undefined)
  // QRIS yang dirender dari paymentCode tidak ikut tampil sebagai VA.
  const vaNumber = isQrisIntent && intent?.qrString == null ? undefined : intent?.vaNumber

  const handleCheckStatus = () => {
    // N-07 (audit escrow 2026-09-24): "Cek status sekarang" memberi umpan
    // balik hasil — dulu hanya diam (atau `pollError` bila gagal), pengguna
    // tidak tahu status sudah dicek.
    void payment.syncStatus().then((s) => {
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
              ? "Kode bayar sudah kedaluwarsa"
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

  const checkoutItems = toCheckoutMethodItems(methods)

  const noopCopy = (_value: string) => {}

  return (
    <BottomSheet
      avoidKeyboard
      visible={open}
      onRequestClose={onClose}
      title={title}
      description={description}
    >
      <View className="gap-4">
        {topExtra}
        {methodsLoading ? (
          <Text variant="body" tone="secondary">
            Memuat metode pembayaran…
          </Text>
        ) : methodsError ? (
          <Alert
            tone="danger"
            title="Gagal memuat metode pembayaran"
            action={
              <Button size="sm" variant="secondary" onPress={onRetryMethods}>
                {translate("Coba lagi")}
              </Button>
            }
          >
            <Text variant="caption" tone="secondary">
              {methodsError}
            </Text>
          </Alert>
        ) : checkoutItems.length === 0 ? (
          <Alert tone="warning" title="Tidak ada metode pembayaran tersedia">
            <Text variant="caption" tone="secondary">
              Coba lagi nanti{emptyMethodsExtra ?? "."}
            </Text>
          </Alert>
        ) : intent == null ? (
          <>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Metode pembayaran"
              className="gap-2"
            >
              {checkoutItems.map((item) => (
                <PaymentMethodRow
                  key={item.id}
                  item={item}
                  active={selectedMethod?.code === item.id}
                  disabled={payment.creating}
                  onSelect={onSelectMethod}
                />
              ))}
            </View>
            {methodAction}
            <Text variant="caption" tone="secondary" className="text-center">
              Pembayaran diproses aman oleh DANA
            </Text>
          </>
        ) : selectedMethod && qrString ? (
          /* QRIS (DANA) — qrString BE, atau paymentCode BE untuk intent QRIS (BFI-074) */
          <>
            {intentTopExtra}
            <QrisPaymentPanel
              qrString={qrString}
              amount={intent.amount}
              expiresAt={intent.expiresAt}
              status={payment.status}
              pollError={payment.pollError}
              pollStopped={payment.stopped}
              submitting={payment.creating}
              copied={copied}
              onCopy={onCopy ?? noopCopy}
              onExpire={payment.expireLocally}
              onRecreate={onRequestRecreate}
              onUseOtherMethod={onUseOtherMethod}
              onCheckStatus={handleCheckStatus}
              checking={payment.syncing}
            />
          </>
        ) : selectedMethod && vaNumber ? (
          <>
            {intentTopExtra}
            <VaPaymentPanel
              vaNumber={vaNumber}
              vaBankName={intent.vaBankName}
              accountName={intent.accountName}
              amount={intent.amount}
              expiresAt={intent.expiresAt}
              copied={copied}
              onCopy={onCopy ?? noopCopy}
              instructions={intent.instructions}
              status={payment.status}
              pollError={payment.pollError}
              pollStopped={payment.stopped}
              submitting={payment.creating}
              checking={payment.syncing}
              onExpire={payment.expireLocally}
              onRecreate={onRequestRecreate}
              onCheckStatus={handleCheckStatus}
              onUseOtherMethod={onUseOtherMethod}
            />
          </>
        ) : selectedMethod ? (
          <>
            {intentTopExtra}
            <DanaRedirectPanel
              methodName={selectedMethod.name}
              amount={intent.amount}
              redirectUrl={intent.redirectUrl}
              expiresAt={intent.expiresAt}
              status={payment.status}
              pollError={payment.pollError}
              pollStopped={payment.stopped}
              submitting={payment.creating}
              checking={payment.syncing}
              onExpire={payment.expireLocally}
              onRecreate={onRequestRecreate}
              onCheckStatus={handleCheckStatus}
              onUseOtherMethod={onUseOtherMethod}
            />
          </>
        ) : null}
      </View>
    </BottomSheet>
  )
}
