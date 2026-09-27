import type { ErrorBoundaryProps } from "expo-router"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { ThemeProvider } from "@/components/theme-provider"
import { ErrorState } from "@/components/ui/error-state"
import { Screen } from "@/components/ui/screen"

/** Runtime rendering failures get a recovery screen, never a blank page or raw financial data in an error dump. */
export function AppErrorBoundary({ retry }: ErrorBoundaryProps) {
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
          </Screen>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
