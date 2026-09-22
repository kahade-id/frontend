/**
 * Kahade — <Field> / <FieldLabel> / <FieldHelper> (§9.2 pendukung form).
 *
 * Kerangka bersama untuk SEMUA kontrol form (Input, Select, OTP, grup
 * Checkbox/Radio, Switch row): label di atas (opsional), kontrol di tengah,
 * helper/error di bawah. Dipisah dari Input supaya aturan teks form hanya
 * ditulis sekali:
 *   - Label  : variant `label` (13/600, §3.2) tone secondary — TIDAK all-caps.
 *   - Helper : variant `caption` tone secondary.
 *   - Error  : variant `caption` tone danger, MENGGANTIKAN helper (bukan
 *     ditumpuk) agar tinggi field tidak melompat saat validasi berubah.
 *   - Required ditandai " *" tone danger di label, bukan teks "(wajib)".
 *
 * Kenapa slot helper selalu dirender saat `reserveHelperSpace` (non-obvious):
 * di form panjang, error yang muncul/hilang menggeser field di bawahnya —
 * terasa "loncat". Slot kosong setinggi satu baris caption (18px) menjaga
 * layout stabil. Default false karena tidak semua field butuh helper.
 */
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react"
import { AccessibilityInfo, Platform, View, type ViewProps } from "react-native"

import { cn } from "@/lib/cn"
import { Text } from "@/components/ui/text"

/**
 * F-10 (audit 2026-09-22): konteks label untuk kontrol DI DALAM <Field>.
 *
 * Temuan uji axe di atas pohon render: `<Field label="Nomor rekening">` +
 * `<Input>` menghasilkan `<input>` TANPA nama yang bisa dibaca (di web: tidak
 * ada `<label for>`, tidak ada `aria-label`) — pelanggaran `label` tingkat
 * critical; di native pun VoiceOver membacakan isi field tanpa nama
 * kontrolnya, karena label selama ini murni visual (`<FieldLabel>` adalah
 * `<Text>` di sebelah input).
 *
 * Kontrol yang membaca konteks ini (Input, PasswordField, TagInput, …) memakai
 * label Field sebagai `accessibilityLabel` BILA pemanggil tidak mengirim label
 * sendiri — jadi tidak ada call site yang perlu diubah, dan label eksplisit
 * tetap menang.
 */
export type FieldContextValue = {
  /** Teks label (string saja — label berupa node kaya tidak bisa jadi nama) */
  label?: string
  /** Galat field saat ini, untuk kontrol yang ingin menautkannya */
  errorText?: string
}

export const FieldContext = createContext<FieldContextValue | null>(null)

/** Label Field yang membungkus kontrol ini (null bila tidak berada di Field). */
export function useFieldContext(): FieldContextValue | null {
  return useContext(FieldContext)
}

/** Nama aksesibilitas kontrol: label eksplisit menang, lalu label Field. */
export function useFieldAccessibilityLabel(explicit?: string): string | undefined {
  const ctx = useFieldContext()
  return explicit ?? ctx?.label
}

/**
 * H-07: jeda pengumuman galat di iOS. Validasi yang berubah cepat (mengetik)
 * menghasilkan beberapa pesan berbeda dalam hitungan milidetik; VoiceOver
 * mengantre semuanya dan pengguna baru mendengar pesan terakhir belasan detik
 * kemudian. 300 ms = satu ketikan wajar, jauh di bawah ambang "terlalu lambat".
 */
export const ERROR_ANNOUNCE_DELAY_MS = 300

export type FieldProps = ViewProps & {
  label?: string
  required?: boolean
  helperText?: string
  errorText?: string
  /** Sisakan ruang satu baris caption meski helper/error kosong */
  reserveHelperSpace?: boolean
  disabled?: boolean
  children: ReactNode
  className?: string
}

export function FieldLabel({
  children,
  required,
  disabled,
  className,
}: {
  children: string
  required?: boolean
  disabled?: boolean
  className?: string
}) {
  return (
    <Text variant="label" tone={disabled ? "disabled" : "secondary"} className={className}>
      {children}
      {required ? (
        <Text variant="label" tone="danger">
          {" *"}
        </Text>
      ) : null}
    </Text>
  )
}

export function FieldHelper({
  helperText,
  errorText,
  reserveSpace = false,
  className,
}: {
  helperText?: string
  errorText?: string
  reserveSpace?: boolean
  className?: string
}) {
  const message = errorText || helperText

  // iOS VoiceOver TIDAK mendukung live region (lihat live-region.tsx) —
  // tanpa ini error validasi di iOS tidak pernah diumumkan. Android/web
  // sudah tercakup oleh `accessibilityLiveRegion` di bawah. Pesan yang sama
  // berturut-turut hanya diumumkan sekali agar tidak spam saat re-render.
  const lastAnnounced = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!errorText || errorText === lastAnnounced.current) {
      if (!errorText) lastAnnounced.current = undefined
      return
    }
    lastAnnounced.current = errorText
    if (Platform.OS !== "ios") return
    /*
     * H-07 (audit 2026-09-22): komentar di sini dulu MENJANJIKAN debounce 300 ms
     * padahal pengumumannya sinkron — saat validasi berubah cepat ("minimal 8
     * karakter" → "huruf besar dan kecil") VoiceOver mengantre setiap pesan.
     * Sekarang penundaannya benar-benar ada DAN dibatalkan saat pesan berubah
     * ataupun komponen unmount; tanpa cleanup, timer yang masih hidup
     * mengumumkan pesan field yang sudah tidak ada di layar.
     */
    const timer = setTimeout(
      () => AccessibilityInfo.announceForAccessibility(errorText),
      ERROR_ANNOUNCE_DELAY_MS,
    )
    return () => clearTimeout(timer)
  }, [errorText])

  if (!message && !reserveSpace) return null
  return (
    <Text
      variant="caption"
      tone={errorText ? "danger" : "secondary"}
      // Error text harus diumumkan screen reader saat muncul
      accessibilityLiveRegion={errorText ? "polite" : "none"}
      className={cn("min-h-[18px]", className)}
    >
      {message ?? ""}
    </Text>
  )
}

export function Field({
  label,
  required = false,
  helperText,
  errorText,
  reserveHelperSpace = false,
  disabled = false,
  children,
  className,
  ...rest
}: FieldProps) {
  // F-10: label diteruskan sebagai nama kontrol lewat konteks (lihat dok di atas).
  const contextValue = useMemo<FieldContextValue>(
    () => ({ label: typeof label === "string" ? label : undefined, errorText }),
    [label, errorText],
  )

  return (
    <FieldContext.Provider value={contextValue}>
      <View className={cn("w-full gap-2", className)} {...rest}>
        {label ? (
          <FieldLabel required={required} disabled={disabled}>
            {label}
          </FieldLabel>
        ) : null}
        {children}
        <FieldHelper
          helperText={helperText}
          errorText={errorText}
          reserveSpace={reserveHelperSpace}
        />
      </View>
    </FieldContext.Provider>
  )
}
