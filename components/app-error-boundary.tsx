import type { ErrorBoundaryProps } from "expo-router"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { ThemeProvider } from "@/components/theme-provider"
import { ErrorState } from "@/components/ui/error-state"
import { Screen } from "@/components/ui/screen"

/** Runtime rendering failures get a recovery screen, never a blank page or raw financial data in an error dump. */
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const msg = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : ""
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Screen>
            <ErrorState
              title="Halaman tidak dapat ditampilkan"
              description="Coba muat ulang halaman. Periksa riwayat transaksi sebelum mengirim ulang tindakan yang belum terkonfirmasi."
              onRetry={() => void retry()}
            />
            {/* DEBUG SEMENTARA: tampilkan error asli */}
            <div style={{ marginTop: 24, padding: 12, background: "#fff", maxWidth: 520 }}>
              <p data-testid="debug-error" style={{ color: "#b00", fontSize: 13, whiteSpace: "pre-wrap" }}>{msg}</p>
              <p style={{ color: "#666", fontSize: 10, whiteSpace: "pre-wrap" }}>{stack}</p>
            </div>
          </Screen>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
