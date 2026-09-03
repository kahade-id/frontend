/**
 * Kahade — <LiveRegion> pengumuman status untuk screen reader.
 *
 * Perubahan yang terjadi tanpa fokus (saldo ter-update, "Dana ditahan",
 * countdown habis, hasil pencarian "3 transaksi") harus diumumkan ke
 * VoiceOver/TalkBack/pembaca layar web. Komponen ini satu tempat untuk itu.
 *
 * Perilaku per platform (branch Platform.OS di sini adalah LOGIC, bukan
 * style, jadi diizinkan):
 *   - Android : `accessibilityLiveRegion="polite"` pada View — TalkBack
 *               membaca otomatis saat teks anak berubah.
 *   - Web     : react-native-web memetakan prop yang sama ke `aria-live`.
 *   - iOS     : VoiceOver TIDAK mendukung live region, jadi kita panggil
 *               `AccessibilityInfo.announceForAccessibility(message)` setiap
 *               `message` berubah (non-obvious tapi satu-satunya cara).
 *
 * `visible=false` (default): teks disembunyikan secara visual lewat
 * <VisuallyHidden> tapi tetap ada di tree aksesibilitas. Set `visible` bila
 * teksnya memang ingin ditampilkan (mis. caption "3 hasil ditemukan") —
 * maka cukup satu sumber, tidak perlu dua Text.
 *
 * Pesan kosong tidak diumumkan; pesan yang sama berturut-turut hanya
 * diumumkan sekali (dibandingkan lewat ref) agar tidak spam saat re-render.
 */
import { useEffect, useRef } from "react"
import { AccessibilityInfo, Platform, View, type ViewProps } from "react-native"

import { VisuallyHidden } from "@/components/ui/layout"
import { Text, type TextProps } from "@/components/ui/text"

export type LiveRegionProps = Omit<ViewProps, "children"> & {
  message: string
  /** "polite" (default) menunggu jeda; "assertive" untuk error kritikal */
  politeness?: "polite" | "assertive"
  /** Tampilkan teksnya secara visual (default false = hanya screen reader) */
  visible?: boolean
  textProps?: Omit<TextProps, "children">
  className?: string
}

export function LiveRegion({
  message,
  politeness = "polite",
  visible = false,
  textProps,
  className,
  ...rest
}: LiveRegionProps) {
  const last = useRef<string>("")

  useEffect(() => {
    if (!message || message === last.current) return
    last.current = message
    if (Platform.OS === "ios") {
      AccessibilityInfo.announceForAccessibility(message)
    }
  }, [message])

  const content = (
    <View accessibilityLiveRegion={politeness} className={className} {...rest}>
      <Text variant="caption" tone="secondary" {...textProps}>
        {message}
      </Text>
    </View>
  )

  return visible ? content : <VisuallyHidden>{content}</VisuallyHidden>
}
