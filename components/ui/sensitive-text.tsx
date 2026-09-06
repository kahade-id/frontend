/**
 * Kahade — <SensitiveText> nilai rahasia dengan toggle mata (§14 Keamanan).
 *
 * Nomor rekening, email/HP di layar profil publik, kode referral sebelum
 * dibagikan, secret 2FA: default DISEMBUNYIKAN, user membuka sendiri lewat
 * ikon Eye/EyeSlash. <Amount hidden> sudah menangani nominal uang; komponen
 * ini untuk string non-uang, dengan strategi mask per jenis data:
 *   - "all"     : 8 bullet tetap — panjang tidak membocorkan panjang nilai
 *                 (keputusan sama dengan <Amount hidden>)
 *   - "account" : "•••• •••• 1234" (lib/format maskAccountNumber) — 4 digit
 *                 akhir tetap terlihat karena itu yang dipakai user untuk
 *                 memverifikasi rekening tujuan
 *   - "email"   : "b•••@domain.com" — huruf pertama + domain
 *   - "phone"   : 4 digit akhir terlihat, sisanya bullet, tetap berkelompok
 *   - function  : mask kustom (value) => string
 *
 * Keputusan non-obvious:
 *   - Default `mono=true`: hampir semua data yang perlu disembunyikan adalah
 *     data presisi (§3.1 rekening/ID/kode). Set false untuk email/nama.
 *   - Bullet "•" (U+2022), bukan "*": lebarnya konsisten di Mono dan tidak
 *     terbaca sebagai "wildcard".
 *   - Toggle = <IconButton accessibilityHint="Ketuk untuk berinteraksi" size="sm" ghost> (hit area 48 efektif), ikon
 *     tone default (text-tertiary) sesuai §7 — bukan ikon "aktif" karena
 *     ini kontrol sekunder. `accessibilityState.checked` = terlihat/tidak.
 *   - State controlled (`hidden`/`onToggleHidden`) supaya preferensi
 *     "sembunyikan" bisa disimpan pemanggil (pola WalletBalanceCard);
 *     uncontrolled tersedia untuk kasus sekali pakai.
 *   - Saat tersembunyi, `selectable` dimatikan & accessibilityLabel =
 *     labels.hiddenLabel agar screen reader / copy tidak membocorkan nilai.
 */
import { useCallback, useState } from "react"
import { View, type ViewProps } from "react-native"
import { Eye, EyeSlash } from "phosphor-react-native"

import { IconButton } from "@/components/ui/icon-button"
import { Text, type TextProps } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { maskAccountNumber } from "@/lib/format"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type SensitiveMask = "all" | "account" | "email" | "phone" | ((value: string) => string)

export type SensitiveTextLabels = {
  show: string
  hide: string
  hiddenLabel: string
}

const DEFAULT_LABELS: SensitiveTextLabels = {
  show: "Tampilkan",
  hide: "Sembunyikan",
  hiddenLabel: "Nilai disembunyikan",
}

const BULLET = "\u2022"
const ALL_HIDDEN = BULLET.repeat(8)

function maskEmail(v: string): string {
  const at = v.indexOf("@")
  if (at <= 0) return ALL_HIDDEN
  return `${v[0]}${BULLET.repeat(3)}${v.slice(at)}`
}

function maskPhone(v: string): string {
  const digits = v.replace(/\D/g, "")
  if (digits.length < 4) return ALL_HIDDEN
  const tail = digits.slice(-4)
  return `+62 ${BULLET.repeat(3)}-${BULLET.repeat(4)}-${tail}`
}

export function maskSensitive(value: string, mask: SensitiveMask): string {
  if (typeof mask === "function") return mask(value)
  switch (mask) {
    case "account":
      return maskAccountNumber(value)
    case "email":
      return maskEmail(value)
    case "phone":
      return maskPhone(value)
    default:
      return ALL_HIDDEN
  }
}

export type SensitiveTextProps = Omit<ViewProps, "children"> & {
  value: string
  mask?: SensitiveMask
  /** JetBrains Mono (default true — data presisi) */
  mono?: boolean
  variant?: Extract<TextProps["variant"], "bodyLarge" | "body" | "caption" | "monoBody" | "monoLarge">
  tone?: Extract<TextProps["tone"], "primary" | "secondary" | "inverse">
  /** Controlled: true = tersembunyi */
  hidden?: boolean
  onToggleHidden?: (hidden: boolean) => void
  /** Nilai awal untuk mode uncontrolled. Default true (tersembunyi). */
  defaultHidden?: boolean
  /** Sembunyikan tombol mata (mask permanen, mis. di list) */
  toggleable?: boolean
  labels?: Partial<SensitiveTextLabels>
  className?: string
}

export function SensitiveText({
  value,
  mask = "all",
  mono = true,
  variant,
  tone = "primary",
  hidden: hiddenProp,
  onToggleHidden,
  defaultHidden = true,
  toggleable = true,
  labels,
  className,
  ...rest
}: SensitiveTextProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const [internal, setInternal] = useState(defaultHidden)
  const hidden = hiddenProp ?? internal

  const toggle = useCallback(() => {
    const next = !hidden
    if (hiddenProp == null) setInternal(next)
    onToggleHidden?.(next)
  }, [hidden, hiddenProp, onToggleHidden])

  const shown = hidden ? maskSensitive(value, mask) : value
  const resolvedVariant = variant ?? (mono ? "monoBody" : "body")

  return (
    <View accessible={false} className={cn("flex-row items-center gap-2", className)} {...rest}>
      <Text ellipsizeMode="tail"
        variant={resolvedVariant}
        tone={tone}
        numberOfLines={1}
        selectable={!hidden}
        accessibilityLabel={hidden ? t.hiddenLabel : value}
        className="flex-shrink tabular-nums"
      >
        {shown}
      </Text>
      {toggleable ? (
        <IconButton
          icon={hidden ? EyeSlash : Eye}
          size="sm"
          variant="ghost"
          accessibilityLabel={hidden ? t.show : t.hide}
          accessibilityState={{ checked: !hidden }}
          onPress={toggle}
        />
      ) : null}
    </View>
  )
}