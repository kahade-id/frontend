/**
 * Kahade — kelas focus ring keyboard (§11 Web, WCAG 2.4.7 Focus Visible).
 *
 * Satu sumber kebenaran untuk indikator fokus keyboard di web, dipakai oleh
 * semua komponen interaktif (Checkbox, Radio, Switch, Chip, Select, Tabs,
 * SegmentedControl, ActionSheet, ListItem, …). Jangan tulis ulang string
 * `focus-visible:` di komponen — impor dari sini supaya lebar/warna ring tidak
 * saling beda antar komponen.
 *
 * Keputusan non-obvious:
 *   - Prefix `web:` (NativeWind v4): di web variant ini = `&` (lolos apa
 *     adanya), di native variant-nya tidak terdaftar sehingga class dibuang
 *     saat compile. Hasilnya: ring TIDAK PERNAH muncul di iOS/Android —
 *     di sana fokus ditangani OS (VoiceOver/TalkBack) dan tidak ada Tab.
 *   - `focus-visible:` (bukan `focus:`) supaya ring HANYA muncul saat
 *     navigasi keyboard. Klik mouse / tap pointer di web tidak memicunya —
 *     sejalan dengan §11 "tidak ada hover/treatment pointer terpisah".
 *   - Warna = `border-focus` (hitam di light, putih di dark) — token fokus
 *     yang sudah dipakai Input/OTP, bukan warna baru. `ring-offset-2` +
 *     `ring-offset-background` memberi celah 2px berwarna latar supaya ring
 *     tetap terlihat di atas fill `bg-primary` (Chip/segmen aktif) yang
 *     warnanya sama dengan ring.
 *   - `outline-none` mematikan outline default browser agar tidak dobel
 *     dengan ring. Ring Tailwind secara teknis box-shadow, tapi ini indikator
 *     fokus a11y — bukan elevasi — jadi tidak melanggar §6 "tanpa shadow".
 *
 * Penempatan (PENTING): `:focus-visible` berlaku pada elemen yang menerima
 * fokus, yaitu <Pressable> terluar (div tabIndex=0 di RN Web). Pada
 * <PressableScale> itu berarti class ini masuk ke `containerClassName`,
 * BUKAN `className` (View di dalam Animated.View tidak pernah fokus).
 * Karena ring mengikuti border-radius elemen fokus, sertakan juga radius
 * pada container (mis. "web:rounded-full") bila kotak visualnya bulat.
 */

/** Ring default: di luar tepi elemen, dengan celah 2px. Untuk kontrol berdiri sendiri. */
export const focusRing =
  "web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-border-focus web:focus-visible:ring-offset-2 web:focus-visible:ring-offset-background"

/**
 * Ring inset: digambar di dalam tepi elemen, tanpa offset. Untuk baris lebar
 * penuh di dalam list/sheet (ListItem, SelectOptionList, ActionSheet, Tabs)
 * yang ring luarnya akan terpotong `overflow-hidden` induk atau menabrak
 * baris tetangga.
 */
export const focusRingInset =
  "web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-inset web:focus-visible:ring-border-focus"
