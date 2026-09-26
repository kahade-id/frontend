/**
 * Kahade — <FollowButton> (§9.1 Button, §12 Voice & Tone).
 *
 * Tombol ikuti/berhenti mengikuti untuk profil publik penjual/pembeli dan
 * hasil pencarian pengguna. Dibangun DI ATAS <Button> — bukan Pressable
 * sendiri — supaya tinggi, radius `sm`, pressed-scale, dan loading spinner
 * identik dengan tombol lain di layar yang sama.
 *
 * Pemetaan state -> varian (non-obvious):
 *   - Belum mengikuti : `primary` (solid) — ini aksi utama di kartu profil.
 *   - Sudah mengikuti : `secondary` (outline) + ikon Check — state "sudah",
 *     bukan aksi; visualnya sengaja lebih tenang agar tombol tidak terus
 *     "meminta" ditekan. Berhenti mengikuti dilakukan dengan tap ulang.
 *   Tidak ada varian destructive untuk unfollow: berhenti mengikuti bukan
 *   aksi merusak (tidak ada data hilang), dan warna danger eksklusif untuk
 *   status transaksi (§2.3).
 *
 * Label mengikuti §12 ("Anda", formal): "Ikuti" / "Mengikuti". Pemanggil
 * boleh mengganti lewat `labels` untuk i18n (key-based, bukan hardcode).
 *
 * Optimistic UI: komponen TIDAK menyimpan state sendiri — `following` datang
 * dari parent, `onToggle(next)` memberi nilai berikutnya. Parent yang
 * memutuskan optimistic update + rollback saat request gagal; komponen hanya
 * menampilkan `loading` selama itu. Ini menjaga sumber kebenaran tunggal
 * (SWR cache / store), sama seperti pola Switch dan Checkbox.
 *
 * `fullWidth` default false: di header profil tombol berdiri di samping
 * statistik, bukan CTA selebar layar. Aksesibilitas: `accessibilityState.
 * selected` = following supaya screen reader membaca "Mengikuti, dipilih".
 */
import { Check, Plus } from "phosphor-react-native"

import { Button, type ButtonProps } from "@/components/ui/button"
import { translate, useLanguage } from "@/lib/i18n"

export type FollowButtonLabels = {
  follow: string
  following: string
}

export type FollowButtonProps = Omit<
  ButtonProps,
  "children" | "variant" | "leftIcon" | "rightIcon" | "onPress"
> & {
  following: boolean
  /** Dipanggil dengan nilai berikutnya (true = mulai mengikuti) */
  onToggle: (next: boolean) => void
  /** Sembunyikan ikon Plus/Check (mis. di ruang sangat sempit) */
  showIcon?: boolean
  labels?: FollowButtonLabels
}

/**
 * Label bawaan mengikuti bahasa aktif (dulu konstanta modul "Ikuti"/
 * "Mengikuti" yang tidak reaktif). Pemanggil tetap boleh mengganti lewat
 * `labels` untuk kasus khusus.
 */
function useDefaultLabels(): FollowButtonLabels {
  // Berlangganan bahasa aktif; translate() membaca bahasa saat dipanggil.
  useLanguage()
  return {
    follow: translate("Ikuti"),
    following: translate("Mengikuti"),
  }
}

export function FollowButton({
  following,
  onToggle,
  showIcon = true,
  labels,
  size = "sm",
  fullWidth = false,
  loading,
  disabled,
  accessibilityLabel,
  accessibilityState,
  ...rest
}: FollowButtonProps) {
  const defaultLabels = useDefaultLabels()
  const resolved = labels ?? defaultLabels
  return (
    <Button
      variant={following ? "secondary" : "primary"}
      size={size}
      fullWidth={fullWidth}
      loading={loading}
      disabled={disabled}
      leftIcon={showIcon ? (following ? Check : Plus) : undefined}
      onPress={() => onToggle(!following)}
      accessibilityLabel={accessibilityLabel ?? (following ? resolved.following : resolved.follow)}
      accessibilityState={{ selected: following, ...accessibilityState }}
      {...rest}
    >
      {following ? resolved.following : resolved.follow}
    </Button>
  )
}