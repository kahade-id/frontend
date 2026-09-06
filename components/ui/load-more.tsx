/**
 * Kahade — <LoadMore> footer pagination list (§8 "Loading inline / pagination").
 *
 * Dipasang sebagai `ListFooterComponent` FlatList riwayat transaksi. Empat
 * state dalam satu komponen supaya list tidak perlu tiga footer berbeda:
 *   - "loading" : Spinner kecil monokrom (BUKAN logo brand — §8) + caption.
 *   - "idle"    : tombol ghost "Muat lebih banyak" untuk list yang memakai
 *                 tap-to-load (bukan infinite scroll otomatis).
 *   - "end"     : caption text-secondary "Semua data ditampilkan" — memberi
 *                 kepastian bahwa tidak ada yang tertinggal (§1 presisi).
 *   - "error"   : pesan + tombol coba lagi, tanpa mengganti seluruh list
 *                 dengan ErrorState karena data yang sudah tampil tetap valid.
 *
 * Tinggi footer dibuat stabil (min-h-14) di semua state agar list tidak
 * melompat saat state berganti.
 */
import { View, type ViewProps } from "react-native"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type LoadMoreStatus = "idle" | "loading" | "end" | "error"

export type LoadMoreProps = Omit<ViewProps, "children"> & {
  status: LoadMoreStatus
  onLoadMore?: () => void
  loadingLabel?: string
  idleLabel?: string
  endLabel?: string
  errorLabel?: string
  /** Sembunyikan teks "end" (list pendek yang tidak perlu penegasan) */
  hideEnd?: boolean
  className?: string
}

export function LoadMore({
  status,
  onLoadMore,
  loadingLabel = "Memuat lebih banyak",
  idleLabel = "Muat lebih banyak",
  endLabel = "Semua data ditampilkan",
  errorLabel = "Gagal memuat data berikutnya",
  hideEnd = false,
  className,
  ...rest
}: LoadMoreProps) {
  if (status === "end" && hideEnd) return null

  return (
    <View accessible={false}
      accessibilityLiveRegion="polite"
      className={cn("min-h-14 w-full items-center justify-center gap-2 py-4", className)}
      {...rest}
    >
      {status === "loading" ? (
        <View className="flex-row items-center gap-2">
          <Spinner size="sm" />
          <Text variant="caption" tone="secondary">
            {loadingLabel}
          </Text>
        </View>
      ) : null}

      {status === "idle" ? (
        <Button variant="ghost" size="sm" fullWidth={false} onPress={onLoadMore}>
          {idleLabel}
        </Button>
      ) : null}

      {status === "end" ? (
        <Text variant="caption" tone="secondary">
          {endLabel}
        </Text>
      ) : null}

      {status === "error" ? (
        <>
          <Text variant="caption" tone="secondary">
            {errorLabel}
          </Text>
          <Button variant="secondary" size="sm" fullWidth={false} onPress={onLoadMore}>
            Coba lagi
          </Button>
        </>
      ) : null}
    </View>
  )
}