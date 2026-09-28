/**
 * Kahade — <SensitiveConfirmDialog> (batch 139 A11).
 *
 * Pola UI konfirmasi SERAGAM untuk aksi sensitif: ubah nomor HP, ubah email,
 * ubah PIN, matikan 2FA, hapus passkey. UI-only — tidak mengubah logika
 * server/auth; slot `children` dipakai untuk field re-auth yang memang
 * disyaratkan server (password/TOTP), bukan auth baru.
 *
 * Struktur baku:
 *   1. Ikon peringatan + tone danger (destructive default true).
 *   2. `description` opsional sebagai kalimat pembuka.
 *   3. `consequences` — daftar konsekuensi eksplisit (bullet), bukan sekadar
 *      "Yakin?". Pengguna harus membaca APA yang berubah sebelum setuju.
 *   4. Label konfirmasi eksplisit per aksi ("Ya, ganti nomor"), bukan "OK".
 */
import type { ReactNode } from "react"
import { View } from "react-native"
import { Warning } from "phosphor-react-native"

import { Dialog } from "@/components/ui/modal"
import { Text } from "@/components/ui/text"

export type SensitiveConfirmDialogProps = {
  visible: boolean
  title: string
  /** Kalimat pembuka opsional di atas daftar konsekuensi. */
  description?: string
  /** Konsekuensi aksi — dirender sebagai bullet agar terbaca satu per satu. */
  consequences: string[]
  /** Label tombol konfirmasi, eksplisit per aksi. Mis. "Ya, ganti nomor". */
  confirmLabel: string
  cancelLabel?: string
  /** Default true: tombol konfirmasi destructive + backdrop tidak menutup. */
  destructive?: boolean
  loading?: boolean
  /** Nonaktifkan tombol konfirmasi (mis. field re-auth belum lengkap). */
  confirmDisabled?: boolean
  /** Slot field re-auth yang disyaratkan server (password/TOTP). */
  children?: ReactNode
  onConfirm: () => void
  onCancel: () => void
}

export function SensitiveConfirmDialog({
  visible,
  title,
  description,
  consequences,
  confirmLabel,
  cancelLabel = "Batal",
  destructive = true,
  loading = false,
  confirmDisabled = false,
  children,
  onConfirm,
  onCancel,
}: SensitiveConfirmDialogProps) {
  return (
    <Dialog
      visible={visible}
      title={title}
      description={description}
      icon={Warning}
      tone="danger"
      destructive={destructive}
      loading={loading}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      confirmButtonProps={{ disabled: confirmDisabled }}
      onConfirm={onConfirm}
      onCancel={onCancel}
      onRequestClose={onCancel}
    >
      <View className="gap-2">
        {consequences.map((c) => (
          <View key={c} className="flex-row items-start gap-2">
            <Text variant="body" tone="secondary" aria-hidden>
              •
            </Text>
            <Text variant="body" tone="secondary" className="flex-1 text-pretty">
              {c}
            </Text>
          </View>
        ))}
        {children}
      </View>
    </Dialog>
  )
}
