/**
 * Kahade — SectionErrorBoundary (fallback untuk ErrorBoundary per-grup rute).
 *
 * Masalah: satu-satunya error boundary ada di root (_layout.tsx). Error
 * render APAPUN — termasuk chunk rute yang gagal dimuat saat offline di web
 * (React.lazy melempar saat dynamic import gagal) — meruntuhkan SELURUH
 * aplikasi ke layar "Halaman tidak dapat ditampilkan" satu halaman penuh.
 *
 * Komponen ini dipakai sebagai `export function ErrorBoundary` di layout
 * grup (mis. app/(tabs)/_layout.tsx) sehingga error di dalam grup hanya
 * menutupi area grup tersebut, dengan UI yang sadar-offline:
 *   - offline / chunk gagal dimuat / network error → pesan offline yang
 *     jelas + tombol coba lagi (bukan layar crash yang menakutkan);
 *   - error lain → ErrorState standar.
 *
 * Bukan class boundary sendiri — expo-router yang menyediakan boundary-nya
 * dan meneruskan `error` + `retry` sebagai props.
 */
import { useEffect } from "react"
import { WifiSlash } from "phosphor-react-native"

import { ErrorState } from "@/components/ui/error-state"
import { Screen } from "@/components/ui/screen"
import { isOfflineKnown, useIsOnline } from "@/lib/connectivity"
import { isConnectivityError } from "@/lib/connectivity-error"
import { captureError } from "@/lib/telemetry"

export type SectionErrorBoundaryProps = {
  error: unknown
  retry: () => void
}

export function SectionErrorBoundary({ error, retry }: SectionErrorBoundaryProps) {
  const online = useIsOnline()
  // offline = NetInfo pasti offline ATAU error-nya berbau jaringan/chunk.
  // Chunk yang gagal dimuat saat status "belum diketahui" tetap diperlakukan
  // sebagai masalah koneksi — retry akan berhasil setelah online.
  const offline = !online || isOfflineKnown() || isConnectivityError(error)

  // Bug 1 (2026-10-08): dulu hanya dicatat di __DEV__ — crash render di produksi
  // tidak pernah tercatat. Kini dicatat di semua build, sekali per error.
  useEffect(() => {
    captureError("section-boundary:caught", error)
  }, [error])

  if (offline) {
    return (
      <Screen>
        <ErrorState
          icon={WifiSlash}
          title="Tidak ada koneksi internet"
          description="Konten tidak dapat dimuat saat offline. Periksa koneksi Anda lalu coba lagi."
          onRetry={() => retry()}
        />
      </Screen>
    )
  }
  return (
    <Screen>
      <ErrorState
        title="Halaman tidak dapat ditampilkan"
        description="Coba muat ulang halaman. Periksa riwayat transaksi sebelum mengirim ulang tindakan yang belum terkonfirmasi."
        onRetry={() => retry()}
      />
    </Screen>
  )
}
