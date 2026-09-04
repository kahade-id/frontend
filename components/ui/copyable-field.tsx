/**
 * Kahade — <CopyableField> (§3.1 Mono untuk data presisi, §9.2 kotak input
 * read-only, §9.11 feedback "Disalin" lewat Banner).
 *
 * Kotak nilai read-only dengan tombol salin: nomor rekening/VA, ID transaksi,
 * kode referral, link. Menyatukan pola yang sebelumnya diulang manual di
 * <OrderLinkShareCard>, <DeliveryProofViewer> (resi) dan <BackupCodesDisplay>
 * — satu tempat untuk aturan tampilan nilai yang "harus disalin persis".
 *
 * Keputusan non-obvious:
 *   - Nilai default `monoBody` (JetBrains Mono): 0/O, 1/l/I harus bisa
 *     dibedakan saat pengguna mencocokkan dengan aplikasi bank lain (§3.1).
 *     `mono={false}` untuk teks biasa (mis. alamat, link panjang) yang
 *     memakai body tabular.
 *   - Kotak memakai anatomi Input resting (§9.2): `bg-surface border-border
 *     rounded-sm`, tinggi min 48 — supaya sejajar rapi dengan Input di form
 *     yang sama, tapi TIDAK bisa difokus/diketik (`accessibilityRole="text"`).
 *   - Clipboard TIDAK ditangani di sini: `onCopy(value)` menerima nilai
 *     mentah (`copyValue` bila tampilan diformat, mis. rekening dengan spasi
 *     tiap 4 digit tetapi yang disalin tanpa spasi). Pemanggil menampilkan
 *     Banner "Disalin" (§9.11) — konsisten dengan komponen lain yang bebas
 *     dependensi expo-clipboard.
 *   - `copied` (controlled) mengganti ikon Copy -> Check + label a11y
 *     "Tersalin" selama pemanggil menyetelnya. Tidak ada timer internal:
 *     durasi feedback mengikuti Banner pemanggil, bukan dua timer terpisah.
 *   - `masked` menampilkan "••••" + tombol Eye untuk nilai sensitif (VA,
 *     nomor kartu). Saat masked tombol salin tetap AKTIF: menyalin tanpa
 *     melihat justru kasus umum (paste ke m-banking), berbeda dari
 *     BackupCodesDisplay yang menonaktifkan karena kode adalah rahasia.
 *   - `selectable` di Text: long-press native select tetap tersedia sebagai
 *     jalur cadangan bila tombol salin gagal/belum di-wire.
 */
import { Check, Copy, Eye, EyeSlash } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { IconButton } from "@/components/ui/icon-button"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type CopyableFieldProps = Omit<ViewProps, "children"> & {
  /** Nilai yang ditampilkan (boleh sudah diformat, mis. "1234 5678 9012") */
  value: string
  /** Nilai yang disalin bila berbeda dari tampilan (default = value) */
  copyValue?: string
  /** Label kecil di atas kotak */
  label?: string
  /** Teks bantu di bawah kotak */
  hint?: string
  /** Tampil JetBrains Mono (default true) */
  mono?: boolean
  /** Menerima nilai siap salin; clipboard urusan pemanggil */
  onCopy?: (value: string) => void
  /** State "tersalin" controlled — ikon Check + label a11y berubah */
  copied?: boolean
  /** Sembunyikan nilai di balik bullet; tombol Eye muncul */
  masked?: boolean
  onToggleMask?: () => void
  disabled?: boolean
  /** Nilai panjang (link) boleh membungkus ke beberapa baris */
  wrap?: boolean
  labels?: Partial<CopyableFieldLabels>
  className?: string
}

export type CopyableFieldLabels = {
  copy: string
  copied: string
  show: string
  hide: string
}

const defaultLabels: CopyableFieldLabels = {
  copy: "Salin",
  copied: "Tersalin",
  show: "Tampilkan",
  hide: "Sembunyikan",
}

const MASK = "••••••••••••"

export function CopyableField({
  value,
  copyValue,
  label,
  hint,
  mono = true,
  onCopy,
  copied = false,
  masked = false,
  onToggleMask,
  disabled = false,
  wrap = false,
  labels: labelsProp,
  className,
  ...rest
}: CopyableFieldProps) {
  const labels = { ...defaultLabels, ...labelsProp }
  const shown = masked ? MASK : value

  return (
    <View className={cn("w-full gap-1", className)} {...rest}>
      {label ? (
        <Text variant="label" tone="secondary">
          {label}
        </Text>
      ) : null}

      <View
        className={cn(
          "min-h-12 w-full flex-row items-center gap-2 rounded-sm border border-border bg-surface pl-4 pr-1",
          disabled && "opacity-disabled",
        )}
      >
        <Text
          variant={mono ? "monoBody" : "body"}
          tone="primary"
          numberOfLines={wrap ? undefined : 1}
          selectable={!masked}
          accessibilityRole="text"
          accessibilityLabel={masked ? undefined : `${label ? `${label}: ` : ""}${value}`}
          className="flex-1 py-3"
        >
          {shown}
        </Text>

        {onToggleMask ? (
          <IconButton
            icon={masked ? Eye : EyeSlash}
            size="sm"
            accessibilityLabel={masked ? labels.show : labels.hide}
            onPress={onToggleMask}
            disabled={disabled}
          />
        ) : null}

        {onCopy ? (
          <IconButton
            icon={copied ? Check : Copy}
            size="sm"
            active={copied}
            accessibilityLabel={copied ? labels.copied : labels.copy}
            accessibilityState={{ disabled, checked: copied }}
            onPress={() => onCopy(copyValue ?? value)}
            disabled={disabled}
          />
        ) : null}
      </View>

      {hint ? (
        <Text variant="caption" tone="secondary">
          {hint}
        </Text>
      ) : null}
    </View>
  )
}
