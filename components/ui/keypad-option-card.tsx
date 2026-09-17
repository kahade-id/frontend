/**
 * Kahade — <KeypadOptionCard> baris pilihan ringkas yang diletakkan TEPAT DI
 * ATAS keypad nominal (top-up: metode pembayaran; transfer: catatan; tarik
 * dana: rekening tujuan).
 *
 * Ketuk kartu → buka BottomSheet pemilih/editor di layar yang sama, sehingga
 * konteks nominal tidak pernah hilang dan pengguna tidak masuk ke langkah
 * terpisah hanya untuk memilih opsi.
 *
 * Bentuk (2026-09-17): SATU baris <ListItem> di dalam <ListGroup> — sama
 * persis dengan kartu "Verifikasi dua langkah" di layar Biometrik
 * (app/biometric-settings.tsx): ikon di kiri, judul + ringkasan, chevron di
 * kanan. Versi lama (label caption di atas + nilai di dalam <Card>) tingginya
 * ±92px sehingga di layar pendek ia mendorong konten di atasnya (mis. judul
 * "Kirim ke @username") keluar dari area pandang. Baris list 56px tetap
 * ringkas di atas keypad, dan primitif yang sama = perilaku tekan, fokus,
 * dan a11y yang sama dengan baris pengaturan lain.
 *
 * Struktur informasi: `title` = NAMA pilihan (mis. "Metode pembayaran"),
 * `subtitle` = NILAI terpilih + keterangan opsional (biaya admin, nomor
 * rekening) — pola yang sama dengan baris pengaturan di Biometrik.
 */
import type { ReactNode } from "react"

import { IconComponent } from "@/components/ui/icon"
import { ListGroup, ListItem } from "@/components/ui/list-item"
import { cn } from "@/lib/cn"

export type KeypadOptionCardProps = {
  /** Nama pilihan, mis. "Metode pembayaran" */
  label: string
  /** Nilai terpilih, mis. "BCA Virtual Account" */
  value?: string
  /** Tampil saat belum ada pilihan, mis. "Pilih metode pembayaran" */
  placeholder?: string
  /** Keterangan kecil di belakang nilai (biaya, nomor rekening, ringkasan catatan) */
  description?: string
  /** Ikon kategori di kiri judul */
  icon?: IconComponent
  /** Slot leading kustom (menggantikan ikon), mis. inisial bank */
  leading?: ReactNode
  onPress: () => void
  disabled?: boolean
  accessibilityHint?: string
  className?: string
}

export function KeypadOptionCard({
  label,
  value,
  placeholder = "Pilih",
  description,
  icon,
  leading,
  onPress,
  disabled = false,
  accessibilityHint,
  className,
}: KeypadOptionCardProps) {
  const hasValue = Boolean(value)
  // Satu baris subtitle: nilai + keterangan dipisah "·" supaya anatomi tetap
  // sama dengan baris pengaturan (judul → ringkasan), bukan menumpuk 2 baris
  // teks yang membuat kartu kembali tinggi.
  const subtitle = hasValue ? [value, description].filter(Boolean).join(" · ") : placeholder

  return (
    <ListGroup className={cn("w-full", className)}>
      <ListItem
        title={label}
        subtitle={subtitle}
        leading={leading ?? icon}
        chevron
        onPress={onPress}
        disabled={disabled}
        accessibilityLabel={hasValue ? `${label}: ${value}` : `${label}. ${placeholder}`}
        accessibilityHint={accessibilityHint ?? "Ketuk untuk mengubah pilihan"}
      />
    </ListGroup>
  )
}
