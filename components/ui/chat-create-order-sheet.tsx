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
import { hitSlopToReach } from "@/lib/hit-slop"

import {
  createOrderFromChat,
  type ChatProductCardPayload,
  type CreatedOrderFromChat,
  type CreateOrderFromChatDto,
} from "@/lib/api/chat"
import { isApiError, userMessage } from "@/lib/api"
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

  const submit = async () => {
    if (!canSubmit || !roomId) return
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
              label="Judul pesanan"
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
              hitSlop={hitSlopToReach(36)}
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
          label="Jenis pesanan"
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

        <Button onPress={() => void submit()} disabled={!canSubmit} loading={sending}>
          Buat transaksi via escrow
        </Button>
        {!withShowcase && (titleLen > 0 && titleLen < 3 || descLen > 0 && descLen < 10) ? (
          <View className="flex-row items-center gap-1.5">
            <Icon icon={CheckCircle} size={14} tone="warning" />
            <Text variant="caption" tone="secondary">
              Judul min 3 karakter, deskripsi min 10 karakter.
            </Text>
          </View>
        ) : null}
      </View>
    </BottomSheet>
  )
}
