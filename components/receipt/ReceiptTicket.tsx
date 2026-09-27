/**
 * Kahade — <ReceiptTicket> struk model tiket untuk "momen uang".
 *
 * Dipakai: detail mutasi wallet, sukses transfer, sukses top-up, sukses
 * penarikan, bukti pembayaran order.
 *
 * Anatomi: notch perforasi kiri/kanan -> header status -> garis putus-putus
 * -> nominal besar -> kartu penerima (bila ada) -> baris label-nilai -> garis
 * putus-putus -> ID transaksi (mono) -> QR verifikasi -> tombol bagikan &
 * chat CS -> info perusahaan.
 *
 * Keputusan non-obvious:
 *   - Notch = View lingkaran penuh dengan background WARNA PAGE (bukan
 *     transparan), menutupi border kartu — meniru lubang perforasi tiket.
 *     Warna page diambil dari token `background` per mode; bila tiket
 *     ditaruh di atas surface lain, kirim `notchColor` eksplisit.
 *   - `DashedLine` dirender sebagai deretan View kecil (bukan
 *     `borderStyle: "dashed"` yang tidak konsisten di Android) dengan
 *     `overflow-hidden` supaya sisa dash terpotong rapi.
 *   - QR selalu di atas putih murni (`brand.white`) walau dark mode — alasan
 *     sama seperti <QRCodeDisplay>: kontras scanner, bukan estetika.
 *   - Shadow TIDAK pakai class shadow-* (tidak ada di design system) —
 *     `elevationStyle("low", mode)`.
 *   - Font weight lewat class `font-sans-700` (bukan `font-bold`) — RN tidak
 *     me-resolve fontWeight ke file font yang di-load expo-font.
 */
import { Image, View, type ViewProps } from "react-native"
import type { RefObject } from "react"
import { router } from "expo-router"
import {
  ArrowUDownLeft,
  CheckCircle,
  Clock,
  Headset,
  ShareNetwork,
  XCircle,
} from "phosphor-react-native"

import { useTheme } from "@/components/theme-provider"
import { Amount } from "@/components/ui/amount"
import { Button } from "@/components/ui/button"
import { Icon, type IconTone } from "@/components/ui/icon"
import { KeyValue } from "@/components/ui/key-value"
import { LogoMark } from "@/components/ui/logo"
import { Text } from "@/components/ui/text"
import { elevationStyle } from "@/lib/elevation"
import { cn } from "@/lib/cn"
import { RECEIPT_STATUS_LABEL, type ReceiptStatus } from "@/lib/receipt"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

export type ReceiptRow = {
  label: string
  value: string
  /** Nilai dirender mono (ID, nomor referensi) */
  mono?: boolean
}

/**
 * Penerima transfer — dirender sebagai kartu menonjol di bawah nominal,
 * bukan sekadar baris label-nilai. Hanya presentasi: nilai tetap persis
 * dari pemanggil.
 */
export type ReceiptRecipient = {
  /** Nama penerima — ditampilkan menonjol */
  name: string
  /** Info tujuan tambahan, mis. "@budi" / "BCA · ••••1234" */
  detail?: string | null
}

export type ReceiptTicketProps = Omit<ViewProps, "children"> & {
  status: ReceiptStatus
  /** Judul struk, mis. "Transfer Dana" / "Top-up Saldo" */
  title: string
  amount: number
  /** Warna nominal — default "primary" (netral struk). */
  amountTone?: "primary" | "success" | "danger"
  /** Baris label-nilai di bawah nominal */
  rows?: ReceiptRow[]
  /** Penerima transfer — dirender sebagai kartu menonjol di bawah nominal */
  recipient?: ReceiptRecipient | null
  /** Label kartu penerima — default "Penerima" */
  recipientLabel?: string
  /** ID transaksi unik — dirender mono font */
  receiptId: string
  /** Data URL PNG QR verifikasi; kosong = QR tidak dirender (tanpa crash) */
  qrDataUrl?: string | null
  /** Ref untuk capture (shareReceipt) — ditempel ke kartu tiket */
  ticketRef?: RefObject<View | null>
  onShare?: () => void
  /** Override tombol "Chat dengan CS" — default membuka /live-support */
  onChatSupport?: () => void
  onCopyReceiptId?: (id: string) => void
  className?: string
}

const STATUS_ICON: Record<ReceiptStatus, typeof CheckCircle> = {
  SUCCESS: CheckCircle,
  PENDING: Clock,
  FAILED: XCircle,
  REFUND: ArrowUDownLeft,
}

const STATUS_LABEL_CLASS: Record<ReceiptStatus, string> = {
  SUCCESS: "text-success-text",
  PENDING: "text-warning-text",
  FAILED: "text-danger-text",
  REFUND: "text-tertiary",
}

const STATUS_ICON_TONE: Record<ReceiptStatus, IconTone> = {
  SUCCESS: "success",
  PENDING: "warning",
  FAILED: "danger",
  REFUND: "default",
}

/** Garis putus-putus — deretan dash kecil (aman di Android). */
export function DashedLine({ className }: { className?: string }) {
  const { mode } = useTheme()
  return (
    <View
      accessible={false}
      className={cn("flex-row items-center gap-[7px] overflow-hidden", className)}
    >
      {Array.from({ length: 64 }, (_, i) => (
        <View
          key={i}
          className="h-[2px] w-[7px] shrink-0 rounded-full"
          style={{ backgroundColor: tokens.colors[mode].borderDefault }}
        />
      ))}
    </View>
  )
}

/**
 * Watermark logo Kahade diagonal berulang, opacity 0.05.
 *
 * Diekspor untuk dipakai ulang chrome tiket lain (mis. voucher) — jangan
 * diduplikasi; satu sumber kebenaran watermark tiket.
 */
export function Watermark() {
  const { mode } = useTheme()
  const fill = tokens.colors[mode].primary
  return (
    <View
      accessible={false}
      className="absolute inset-0 items-center justify-center overflow-hidden"
      style={{ opacity: 0.05, pointerEvents: "none" }}
    >
      <View style={{ transform: [{ rotate: "-18deg" }] }} className="items-center gap-12">
        {[0, 1, 2].map((row) => (
          <View key={row} className="flex-row gap-12">
            {[0, 1, 2].map((col) => (
              <LogoMark key={col} size={88} fill={fill} />
            ))}
          </View>
        ))}
      </View>
    </View>
  )
}

/**
 * Notch setengah lingkaran di tepi kartu (efek perforasi tiket).
 *
 * Diekspor untuk dipakai ulang chrome tiket lain (mis. voucher) — jangan
 * diduplikasi. `color` = warna permukaan di belakang kartu (bukan
 * transparan): lingkaran penuh menutupi border kartu meniru lubang
 * perforasi.
 */
export function Notch({ side, color }: { side: "left" | "right"; color: string }) {
  return (
    <View
      accessible={false}
      className={side === "left" ? "absolute -left-3" : "absolute -right-3"}
      style={{
        top: "50%",
        marginTop: -13,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: color,
      }}
    />
  )
}

export function ReceiptTicket({
  status,
  title,
  amount,
  amountTone = "primary",
  rows = [],
  recipient,
  recipientLabel = "Penerima",
  receiptId,
  qrDataUrl,
  ticketRef,
  onShare,
  onChatSupport,
  onCopyReceiptId,
  className,
  ...rest
}: ReceiptTicketProps) {
  const { mode } = useTheme()
  const palette = tokens.colors[mode]
  const recipientName = recipient?.name?.trim() ? recipient.name : "—"
  const recipientDetail = recipient?.detail?.trim() ? recipient.detail : null

  return (
    <View
      ref={ticketRef}
      className={cn("rounded-lg border border-border bg-surface-elevated", className)}
      style={elevationStyle("low", mode)}
      {...rest}
    >
      {/* Perforasi tepi — warna = background page */}
      <Notch side="left" color={palette.background} />
      <Notch side="right" color={palette.background} />

      <Watermark />

      {/* Header status */}
      <View className="items-center gap-2 px-5 pb-4 pt-6">
        <Icon icon={STATUS_ICON[status]} size={40} tone={STATUS_ICON_TONE[status]} />
        <Text
          variant="h2"
          className={cn("font-sans-700", STATUS_LABEL_CLASS[status])}
          accessibilityRole="header"
        >
          {RECEIPT_STATUS_LABEL[status]}
        </Text>
        <Text variant="body" tone="secondary" className="text-center">
          {title}
        </Text>
      </View>

      <View className="px-5">
        <DashedLine />
      </View>

      {/* Nominal besar */}
      <View className="items-center px-5 py-5">
        <Amount value={amount} size="large" tone={amountTone} sign="never" animated={false} />
      </View>

      {/* Kartu penerima — "transfer ke siapa", menonjol di bawah nominal */}
      {recipient ? (
        <View className="px-5 pb-1">
          <View className="gap-1 rounded-md border border-border bg-surface p-3">
            <Text variant="caption" tone="tertiary">
              {recipientLabel}
            </Text>
            <Text variant="body" className="font-sans-700">
              {recipientName}
            </Text>
            {recipientDetail ? (
              <Text variant="caption" tone="secondary">
                {recipientDetail}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Baris label-nilai */}
      {rows.length > 0 ? (
        <View className="gap-3 px-5 pb-1">
          {rows.map((row) => (
            <KeyValue key={row.label} label={row.label} value={row.value} mono={row.mono} />
          ))}
        </View>
      ) : null}

      <View className="px-5 pt-4">
        <DashedLine />
      </View>

      {/* ID transaksi */}
      <View className="items-center gap-1 px-5 py-4">
        <Text variant="caption" tone="tertiary">
          ID Transaksi
        </Text>
        <Text
          variant="monoBody"
          tone="secondary"
          selectable
          onPress={onCopyReceiptId ? () => onCopyReceiptId(receiptId) : undefined}
          accessibilityLabel={`ID transaksi ${receiptId.split("").join(" ")}`}
        >
          {receiptId}
        </Text>
      </View>

      {/* QR verifikasi — hanya bila ada */}
      {qrDataUrl ? (
        <View className="items-center gap-2 px-5 pb-5">
          <View
            className="items-center justify-center rounded-md border border-border p-2"
            style={{ backgroundColor: tokens.colors.brand.white }}
          >
            <Image
              source={{ uri: qrDataUrl }}
              style={{ width: 160, height: 160 }}
              accessible
              accessibilityRole="image"
              accessibilityLabel="Kode QR verifikasi keaslian struk"
            />
          </View>
          <Text variant="caption" tone="tertiary" className="text-center">
            Pindai untuk verifikasi keaslian struk
          </Text>
        </View>
      ) : null}

      {/* Aksi: bagikan & chat CS */}
      <View className="px-5 pb-5">
        <View className="flex-row gap-2">
          {onShare ? (
            <View className="flex-1">
              <Button variant="secondary" leftIcon={ShareNetwork} onPress={onShare}>
                Bagikan struk
              </Button>
            </View>
          ) : null}
          <View className="flex-1">
            <Button
              variant="secondary"
              leftIcon={Headset}
              onPress={onChatSupport ?? (() => router.push(ROUTES.liveSupport))}
              accessibilityLabel="Chat dengan CS"
            >
              Chat dengan CS
            </Button>
          </View>
        </View>
      </View>

      {/* Info perusahaan */}
      <View className="px-5 pb-5">
        <DashedLine className="mb-4" />
        <View className="items-center gap-0.5">
          <Text variant="caption" tone="secondary" className="text-center font-sans-700">
            PT Kawal Hak Dengan Aman
          </Text>
          <Text variant="caption" tone="tertiary" className="text-center">
            NPWP 1000 0000 0827 0425
          </Text>
          <Text variant="caption" tone="tertiary" className="text-center">
            Jl Cihideung Udik, Kec. Ciampea Kab. Bogor 16620
          </Text>
        </View>
      </View>
    </View>
  )
}
