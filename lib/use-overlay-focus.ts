/**
 * Kahade — useOverlayFocus() + focusAccessibility() (audit #3, WCAG 2.4.3
 * "Focus Order" & 2.4.11 untuk overlay modal).
 *
 * Saat overlay pemblokir (Modal, BottomSheet, SearchOverlay, LoadingOverlay)
 * terbuka, fokus screen reader / keyboard harus:
 *   (a) PINDAH ke overlay (judul atau konten pertama) — kalau tidak, pengguna
 *       VoiceOver/TalkBack tetap "berdiri" di tombol pemicu yang kini
 *       tertutup scrim dan tidak tahu ada yang terjadi;
 *   (b) KEMBALI ke pemicu saat overlay tutup — kalau tidak, fokus jatuh ke
 *       awal layar dan pengguna kehilangan posisi.
 * Bagian "konten latar tidak bisa dijangkau" ditangani terpisah oleh
 * `useBlockingOverlay` + `<PortalScene>` di components/ui/portal.tsx.
 *
 * Keputusan non-obvious:
 *   - Fokus masuk dijadwalkan lewat `InteractionManager.runAfterInteractions`,
 *     bukan `requestAnimationFrame`. `Animated.timing(...).start()` (dipakai
 *     `useOverlayPresence`) mendaftarkan interaction handle, jadi callback
 *     baru jalan SETELAH animasi masuk selesai: VoiceOver membaca elemen di
 *     posisi akhirnya, bukan di tengah translate/scale. Saat Reduce Motion
 *     (durasi 0) callback praktis langsung.
 *   - Native: `AccessibilityInfo.setAccessibilityFocus(findNodeHandle(node))`.
 *     Di iOS ini mengirim LayoutChanged notification dengan node sebagai
 *     argumen; bila node bukan elemen a11y (container tanpa `accessible`),
 *     VoiceOver memilih elemen pertama di dalamnya — jadi ref ke container
 *     konten adalah fallback yang aman. Di Android TalkBack butuh node yang
 *     benar-benar important, karena itu Dialog/BottomSheet memberi ref ke
 *     <Text> judul (RN Text selalu accessible) bukan ke container.
 *   - Web: `HTMLElement.focus()`. Container overlay biasanya bukan elemen
 *     fokusable, jadi kita set `tabindex="-1"` (fokus programatik tanpa masuk
 *     urutan Tab). Elemen aktif sebelum buka disimpan otomatis dari
 *     `document.activeElement` — `returnFocusRef` tetap dihormati bila ada.
 *   - Native tidak punya "elemen yang sedang difokus" yang bisa dibaca, maka
 *     pengembalian fokus HANYA terjadi bila pemanggil memberi `returnFocusRef`
 *     (ref ke tombol pemicu). Tanpa itu kita tidak menebak.
 *   - Fokus dikembalikan saat `active` -> false, yaitu SEBELUM animasi keluar
 *     selesai (overlay masih mounted). Disengaja: pemicu sudah terlihat lagi
 *     di bawah scrim yang memudar, dan menunggu `onHidden` membuat jeda
 *     terasa "mati" bagi pengguna keyboard.
 */
import { useEffect, useRef, type Component, type RefObject } from "react"
import { AccessibilityInfo, InteractionManager, Platform, findNodeHandle } from "react-native"

/** Ref ke host component RN apa pun (View, Text, TextInput, Pressable). */
export type A11yNodeRef = RefObject<Component | null>

export type OverlayFocusOptions = {
  /**
   * Elemen pemicu yang menerima fokus kembali saat overlay tutup.
   * Wajib untuk pengembalian fokus di native; opsional di web (fallback ke
   * `document.activeElement` sebelum buka).
   */
  returnFocusRef?: A11yNodeRef
}

/** Pindahkan fokus screen reader / keyboard ke `node`. Aman dipanggil dengan null. */
export function focusAccessibility(node: Component | null | undefined): void {
  if (!node) return

  if (Platform.OS === "web") {
    // RN-Web: ref host component adalah HTMLElement.
    const el = node as unknown as Partial<HTMLElement>
    if (typeof el.focus !== "function") return
    if (el.hasAttribute && !el.hasAttribute("tabindex")) el.setAttribute?.("tabindex", "-1")
    el.focus({ preventScroll: true })
    return
  }

  const tag = findNodeHandle(node)
  if (tag != null) AccessibilityInfo.setAccessibilityFocus(tag)
}

export function useOverlayFocus(
  active: boolean,
  contentRef: A11yNodeRef,
  { returnFocusRef }: OverlayFocusOptions = {},
): void {
  const previousWebElement = useRef<HTMLElement | null>(null)
  const wasActive = useRef(false)

  useEffect(() => {
    if (active) {
      wasActive.current = true
      if (Platform.OS === "web" && typeof document !== "undefined") {
        previousWebElement.current = document.activeElement as HTMLElement | null
      }
      const task = InteractionManager.runAfterInteractions(() => {
        focusAccessibility(contentRef.current)
      })
      return () => task.cancel()
    }

    // Transisi buka -> tutup saja; mount awal dengan active=false tidak
    // boleh "mengembalikan" fokus ke mana pun.
    if (!wasActive.current) return
    wasActive.current = false

    if (returnFocusRef?.current) {
      focusAccessibility(returnFocusRef.current)
      return
    }
    if (Platform.OS === "web") {
      const prev = previousWebElement.current
      previousWebElement.current = null
      if (prev && typeof document !== "undefined" && document.contains(prev)) {
        prev.focus({ preventScroll: true })
      }
    }
  }, [active, contentRef, returnFocusRef])
}
