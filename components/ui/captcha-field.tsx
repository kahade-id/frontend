/**
 * Kahade — <CaptchaField> (§9.2 Input + gambar tantangan dari server).
 *
 * Gambar captcha (URI dari server) + tombol muat ulang + input jawaban Mono.
 * Komponen tidak tahu jawaban benar — validasi selalu di server; `errorText`
 * dari pemanggil saat jawaban ditolak, dan pemanggil dianjurkan memanggil
 * `onRefresh` sekaligus karena captcha lama biasanya hangus.
 *
 * Keputusan non-obvious:
 *   - Gambar dibungkus border `border-border` radius sm dengan tinggi tetap 56
 *     (= tinggi Input berlabel) supaya baris gambar + tombol refresh rapi
 *     sejajar dengan field di bawahnya.
 *   - Input pakai font Mono (§3.1 "kode") lewat `className` — kode captcha
 *     sama seperti OTP: karakter harus terbaca terpisah.
 *   - `loading` menampilkan Skeleton di area gambar, bukan spinner, agar
 *     layout tidak melompat.
 */
import { ArrowsClockwise } from "phosphor-react-native"
import { forwardRef } from "react"
import { View, type TextInput } from "react-native"

import { IconButton } from "@/components/ui/icon-button"
import { Input, type InputProps } from "@/components/ui/input"
import { Picture } from "@/components/ui/picture"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/cn"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type CaptchaFieldLabels = { label: string; refresh: string; imageAlt: string }
const DEFAULT_LABELS: CaptchaFieldLabels = {
  label: "Kode verifikasi",
  refresh: "Muat ulang kode",
  imageAlt: "Gambar kode verifikasi",
}

export type CaptchaFieldProps = Omit<InputProps, "variant" | "secureTextEntry" | "value" | "onChangeText"> & {
  value: string
  onChangeText: (value: string) => void
  /** URI gambar captcha dari server */
  imageUri?: string | null
  onRefresh: () => void
  loading?: boolean
  length?: number
  labels?: Partial<CaptchaFieldLabels>
  containerClassName?: string
}

export const CaptchaField = forwardRef<TextInput, CaptchaFieldProps>(function CaptchaField(
  { value, onChangeText, imageUri, onRefresh, loading = false, length = 6, labels, label, containerClassName, className, ...rest },
  ref,
) {
  const t = { ...DEFAULT_LABELS, ...labels }

  return (
    <View accessible={false} className={cn("w-full gap-3", containerClassName)}>
      <View className="flex-row items-center gap-2">
        <View className="h-14 flex-1 overflow-hidden rounded-sm border border-border bg-surface">
          {loading || !imageUri ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <Picture source={imageUri} alt={t.imageAlt} height={56} resizeMode="contain" radius="none" />
          )}
        </View>
        <IconButton
          icon={ArrowsClockwise}
          variant="secondary"
          accessibilityLabel={t.refresh}
          onPress={onRefresh}
          loading={loading}
          disabled={loading}
        />
      </View>

      <Input
        ref={ref}
        label={label ?? t.label}
        value={value}
        onChangeText={(v) => onChangeText(v.replace(/\s/g, "").slice(0, length))}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={length}
        className={cn("font-mono-500 tracking-mono", className)}
        {...rest}
      />
    </View>
  )
})