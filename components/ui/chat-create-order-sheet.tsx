/**
 * Kahade — sheet "Buat transaksi" dari chat (batch 43 FE-CHAT, 2026-09-28).
 *
 * POST /v1/chat/rooms/{id}/order — order ESCROW 1-by-1 dari ruang negosiasi.
 *
 * BATAS KERAS (keputusan user): uang HANYA lewat escrow. Sheet ini tidak
 * punya — dan tidak boleh punya — jalur kirim uang langsung. Backend
 * mendelegasikan seluruh logika finansial (fee, KYC, escrow) ke
 * OrdersService; frontend hanya mengumpulkan parameter order.
 *
 * Dua mode:
 *   - Dengan etalase (`showcaseId` terisi — dari tombol "Beli" kartu produk):
 *     harga default = harga etalase, `hargaSepakat` opsional untuk nego.
 *   - Tanpa etalase: title (3–100) + description (10–500) + hargaSepakat
 *     WAJIB, role pemanggil (default BUYER).
 */
import { useEffect, useState } from "react"
import { Pressable, View } from "react-native"

import {
  createOrderFromChat,
  type ChatProductCardPayload,
  type CreatedOrderFromChat,
  type CreateOrderFromChatDto,
} from "@/lib/api/chat"
import { calculateFee } from "@/lib/api/orders-endpoints"
import type { FeeBreakdown } from "@/lib/api/orders-shared"
import { isApiError, userMessage } from "@/lib/api"
import { formatRupiah } from "@/lib/format"
import { logWarn } from "@/lib/telemetry"

import { AmountInput } from "@/components/ui/amount-input"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"
import { CheckCircle, ShieldCheck } from "phosphor-react-native"

export type ChatCreateOrderSheetProps = {
  visible: boolean
  roomId: string | null
  /** Terisi bila dibuka dari tombol "Beli" kartu produk. */
  productCard?: ChatProductCardPayload | null
  onRequestClose: () => void
  /** Order berhasil dibuat — parent navigasi ke detail order. */
  onCreated: (created: CreatedOrderFromChat) => void
}

const ORDER_TYPES = [
  { value: "PHYSICAL_GOODS", label: "Barang fisik" },
  { value: "DIGITAL_GOODS", label: "Barang digital" },
  { value: "SERVICE", label: "Jasa" },
  { value: "OTHER", label: "Lainnya" },
] as const

const FEE_OPTIONS = [
  { value: "BUYER", label: "Pembeli" },
  { value: "SELLER", label: "Penjual" },
  { value: "SPLIT", label: "Bagi dua" },
] as const

function RadioRow<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <View className="gap-1.5">
      <Text variant="caption" weight={600} tone="secondary">
        {label}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((o) => {
          const active = o.value === value
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              className={`rounded-full border px-3 py-1.5 ${
                active ? "border-primary bg-primary/10" : "border-border"
              }`}
            >
              <Text
                variant="caption"
                weight={600}
                tone={active ? "primary" : "secondary"}
              >
                {o.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

export function ChatCreateOrderSheet({
  visible,
  roomId,
  productCard,
  onRequestClose,
  onCreated,
}: ChatCreateOrderSheetProps) {
  const toast = useToast()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState(0)
  const [qty, setQty] = useState(1)
  const [role, setRole] = useState<"BUYER" | "SELLER">("BUYER")
  const [orderType, setOrderType] =
    useState<CreateOrderFromChatDto["orderType"]>("PHYSICAL_GOODS")
  const [feeBy, setFeeBy] =
    useState<NonNullable<CreateOrderFromChatDto["feeResponsibility"]>>("BUYER")
  const [sending, setSending] = useState(false)
  // TRX-019: langkah review — ringkasan + kalkulasi biaya dari SERVER sebelum
  // submit. Sheet ini tidak boleh mengirim order tanpa pengguna melihat
  // nominal final.
  const [step, setStep] = useState<"form" | "review">("form")
  const [fee, setFee] = useState<FeeBreakdown | null>(null)
  const [feeLoading, setFeeLoading] = useState(false)
  const [feeError, setFeeError] = useState<string | null>(null)

  useEffect(() => {
    if (visible) {
      setTitle(productCard?.title ?? "")
      setDescription("")
      const fallback = productCard?.priceMin != null ? Number(productCard.priceMin) : 0
      setPrice(Number.isFinite(fallback) ? fallback : 0)
      setQty(1)
      setRole("BUYER")
      setOrderType("PHYSICAL_GOODS")
      setFeeBy("BUYER")
      setSending(false)
      setStep("form")
      setFee(null)
      setFeeLoading(false)
      setFeeError(null)
    }
  }, [visible, productCard])

  const withShowcase = !!productCard?.showcaseId
  const titleLen = title.trim().length
  const descLen = description.trim().length
  const canSubmit =
    !!roomId &&
    !sending &&
    price > 0 &&
    qty >= 1 &&
    (withShowcase || (titleLen >= 3 && titleLen <= 100 && descLen >= 10 && descLen <= 500))

  const orderValue = price * qty

  /** TRX-019: ambil kalkulasi biaya dari server untuk langkah review. */
  const loadFee = async () => {
    setFeeLoading(true)
    setFeeError(null)
    try {
      const res = await calculateFee({ orderValue, feeResponsibility: feeBy })
      setFee(res)
    } catch (err) {
      logWarn("chat:create-order-fee", err)
      setFee(null)
      setFeeError(isApiError(err) ? userMessage(err) : "Gagal menghitung biaya.")
    } finally {
      setFeeLoading(false)
    }
  }

  const goToReview = () => {
    if (!canSubmit) return
    setStep("review")
    void loadFee()
  }

  const submit = async () => {
    if (!canSubmit || !roomId) return
    // TRX-019: submit hanya dari langkah review dengan fee server yang valid —
    // jangan biarkan pengguna mengonfirmasi nominal yang belum dihitung.
    if (step !== "review" || feeLoading || !fee) return
    setSending(true)
    try {
      const dto: CreateOrderFromChatDto = {
        ...(withShowcase ? { showcaseId: productCard!.showcaseId } : {}),
        ...(!withShowcase
          ? { title: title.trim(), description: description.trim(), role }
          : {}),
        hargaSepakat: price,
        qty,
        orderType,
        feeResponsibility: feeBy,
      }
      const created = await createOrderFromChat(roomId, dto)
      toast.show({
        title: "Transaksi dibuat",
        description: `Order ${created.order.orderId} menunggu pembayaran via escrow.`,
        tone: "success",
      })
      onCreated(created)
      onRequestClose()
    } catch (err) {
      logWarn("chat:create-order", err)
      toast.show({
        title: "Gagal membuat transaksi",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onRequestClose={onRequestClose}
      title="Buat transaksi"
      description={
        withShowcase
          ? `Dari etalase "${productCard?.title}" — dana dikunci di escrow.`
          : "Buat order escrow 1-by-1 dari percakapan ini."
      }
      avoidKeyboard
    >
      <View className="gap-3">
        {step === "form" ? (
          <>
            <View className="flex-row items-center gap-2 rounded-md bg-success-soft p-3">
              <Icon icon={ShieldCheck} size={20} tone="success" />
              <Text variant="caption" tone="primary" className="flex-1">
                Dana pembeli dikunci di escrow Kahade dan baru cair setelah barang
                diterima. Bukan transfer langsung.
              </Text>
            </View>

            {!withShowcase ? (
          <>
            <Input
              label="Judul order"
              value={title}
              onChangeText={setTitle}
              placeholder="Mis. PS5 bekas + 2 stik"
              maxLength={100}
              required
            />
            <TextArea
              label={`Deskripsi (${descLen}/500)`}
              value={description}
              onChangeText={setDescription}
              placeholder="Kondisi barang, kelengkapan, kesepakatan… (min 10 karakter)"
              maxLength={500}
              numberOfLines={3}
              required
            />
            <RadioRow
              label="Saya sebagai"
              options={[
                { value: "BUYER", label: "Pembeli" },
                { value: "SELLER", label: "Penjual" },
              ]}
              value={role}
              onChange={setRole}
            />
          </>
        ) : null}

        <AmountInput
          label="Harga sepakat (Rp)"
          value={price}
          onChange={setPrice}
          min={1}
          required
          helperText={
            withShowcase ? "Kosongkan/kembalikan ke harga etalase bila tidak nego." : undefined
          }
        />

        <View className="flex-row items-center gap-2">
          <Text variant="caption" weight={600} tone="secondary" className="flex-1">
            Jumlah
          </Text>
          {[-1, 1].map((d) => (
            <Pressable
              key={d}
              onPress={() => setQty((q) => Math.max(1, q + d))}
              accessibilityRole="button"
              accessibilityLabel={d < 0 ? "Kurangi jumlah" : "Tambah jumlah"}
              className="h-9 w-9 items-center justify-center rounded-full border border-border"
            >
              <Text variant="body" weight={700} tone="primary">
                {d < 0 ? "−" : "+"}
              </Text>
            </Pressable>
          ))}
          <Text variant="body" weight={700} tone="primary" className="w-8 text-center tabular-nums">
            {qty}
          </Text>
        </View>

        <RadioRow
          label="Jenis order"
          options={ORDER_TYPES}
          value={orderType ?? "PHYSICAL_GOODS"}
          onChange={setOrderType}
        />
        <RadioRow
          label="Biaya layanan ditanggung"
          options={FEE_OPTIONS}
          value={feeBy}
          onChange={setFeeBy}
        />

        <Button onPress={goToReview} disabled={!canSubmit}>
          Lanjut: review & biaya
        </Button>
        {!withShowcase && (titleLen > 0 && titleLen < 3 || descLen > 0 && descLen < 10) ? (
          <View className="flex-row items-center gap-1.5">
            <Icon icon={CheckCircle} size={14} tone="warning" />
            <Text variant="caption" tone="secondary">
              Judul min 3 karakter, deskripsi min 10 karakter.
            </Text>
          </View>
        ) : null}
      </>
        ) : (
          <ReviewStep
            title={withShowcase ? (productCard?.title ?? "") : title.trim()}
            description={withShowcase ? undefined : description.trim()}
            role={role}
            orderType={orderType ?? "PHYSICAL_GOODS"}
            price={price}
            qty={qty}
            feeBy={feeBy}
            fee={fee}
            feeLoading={feeLoading}
            feeError={feeError}
            onRetryFee={() => void loadFee()}
            onBack={() => setStep("form")}
            onSubmit={() => void submit()}
            sending={sending}
            canSubmit={canSubmit && !feeLoading && fee != null}
          />
        )}
      </View>
    </BottomSheet>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-3 py-1.5">
      <Text variant="caption" tone="secondary" className="flex-1">
        {label}
      </Text>
      <Text variant="body" weight={600} tone="primary" className="flex-1 text-right">
        {value}
      </Text>
    </View>
  )
}

/**
 * TRX-019: langkah review — ringkasan order + rincian biaya dari SERVER.
 * Submit diblokir sampai kalkulasi server berhasil dimuat.
 */
function ReviewStep({
  title,
  description,
  role,
  orderType,
  price,
  qty,
  feeBy,
  fee,
  feeLoading,
  feeError,
  onRetryFee,
  onBack,
  onSubmit,
  sending,
  canSubmit,
}: {
  title: string
  description?: string
  role: "BUYER" | "SELLER"
  orderType: string
  price: number
  qty: number
  feeBy: "BUYER" | "SELLER" | "SPLIT"
  fee: FeeBreakdown | null
  feeLoading: boolean
  feeError: string | null
  onRetryFee: () => void
  onBack: () => void
  onSubmit: () => void
  sending: boolean
  canSubmit: boolean
}) {
  const orderTypeLabel =
    ORDER_TYPES.find((o) => o.value === orderType)?.label ?? orderType
  const feeByLabel = FEE_OPTIONS.find((o) => o.value === feeBy)?.label ?? feeBy

  return (
    <View className="gap-4">
      <View>
        <Text variant="caption" weight={600} tone="secondary" className="mb-1">
          Ringkasan order
        </Text>
        <View className="rounded-md border border-border bg-surface px-3 py-1">
          {title ? <SummaryRow label="Judul" value={title} /> : null}
          {description ? (
            <SummaryRow
              label="Deskripsi"
              value={description.length > 80 ? `${description.slice(0, 80)}…` : description}
            />
          ) : null}
          <SummaryRow label="Saya sebagai" value={role === "BUYER" ? "Pembeli" : "Penjual"} />
          <SummaryRow label="Jenis order" value={orderTypeLabel} />
          <SummaryRow label="Harga × jumlah" value={`${formatRupiah(price)} × ${qty}`} />
          <SummaryRow label="Biaya layanan ditanggung" value={feeByLabel} />
        </View>
      </View>

      <View>
        <Text variant="caption" weight={600} tone="secondary" className="mb-1">
          Rincian biaya (dihitung server)
        </Text>
        {feeLoading ? (
          <View className="rounded-md border border-border bg-surface p-4">
            <Text variant="caption" tone="secondary">
              Menghitung biaya layanan…
            </Text>
          </View>
        ) : feeError ? (
          <View className="gap-2 rounded-md border border-danger/40 bg-danger/5 p-4">
            <Text variant="caption" tone="danger">
              {feeError}
            </Text>
            <Button variant="secondary" onPress={onRetryFee}>
              Coba hitung ulang
            </Button>
          </View>
        ) : fee ? (
          <View className="rounded-md border border-border bg-surface px-3 py-1">
            <SummaryRow label="Nilai order" value={formatRupiah(fee.orderValue)} />
            <SummaryRow label="Biaya layanan" value={formatRupiah(fee.platformFee)} />
            <SummaryRow label="Pembeli membayar" value={formatRupiah(fee.buyerPays)} />
            <SummaryRow label="Penjual menerima" value={formatRupiah(fee.sellerReceives)} />
          </View>
        ) : null}
        <Text variant="caption" tone="secondary" className="mt-1.5">
          Dana pembeli dikunci di escrow Kahade dan baru cair setelah barang diterima.
        </Text>
      </View>

      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button variant="secondary" onPress={onBack} disabled={sending}>
            Kembali
          </Button>
        </View>
        <View className="flex-1">
          <Button onPress={onSubmit} disabled={!canSubmit} loading={sending}>
            Buat transaksi via escrow
          </Button>
        </View>
      </View>
    </View>
  )
}
