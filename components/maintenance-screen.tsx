/**
 * Kahade — layar mode pemeliharaan (item #29, kontrak Tim B).
 *
 * Ditampilkan <MaintenanceGate> (app/_layout.tsx) sebagai pengganti seluruh
 * konten aplikasi saat server dalam maintenance — bukan crash, bukan layar
 * kosong: pesan dari server + tombol "Coba lagi".
 *
 * Dibangun di atas <EmptyState> agar konsisten dengan layar informatif lain.
 */
import { useEffect, type ReactNode } from "react"
import { View } from "react-native"
import { Wrench } from "phosphor-react-native"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { checkMaintenance, useMaintenance } from "@/lib/api/maintenance"
import { useLanguage } from "@/lib/i18n"
import { translate } from "@/lib/i18n/translate"

/**
 * Gerbang mode pemeliharaan: membungkus konten aplikasi di AppShell.
 * Cek sekali saat start (splash check — kontrak item #29); saat server dalam
 * maintenance, seluruh konten diganti <MaintenanceScreen> (bukan crash).
 * Fail-open: sebelum hasil cek pertama tiba ("unknown") atau saat offline,
 * aplikasi tetap dirender normal.
 */
export function MaintenanceGate({ children }: { children: ReactNode }) {
  const { phase, message, checking, retry } = useMaintenance()

  useEffect(() => {
    void checkMaintenance()
  }, [])

  if (phase === "maintenance") {
    return <MaintenanceScreen message={message} checking={checking} onRetry={retry} />
  }
  return <>{children}</>
}

export function MaintenanceScreen({
  message,
  checking,
  onRetry,
}: {
  /** Pesan dari server (GET /v1/public/maintenance atau body 503). */
  message: string | null
  /** true saat pengecekan ulang sedang berjalan. */
  checking: boolean
  /** Dipanggil tombol "Coba lagi". */
  onRetry: () => void
}) {
  // Berlangganan bahasa: translate() di bawah ikut ter-render ulang.
  useLanguage()
  return (
    <Screen padded={false}>
      <View className="flex-1 items-center justify-center px-6">
        <EmptyState
          icon={Wrench}
          title={translate("Sedang dalam pemeliharaan")}
          description={
            message ??
            translate(
              "Server Kahade sedang menjalani pemeliharaan terjadwal. Coba lagi dalam beberapa menit.",
            )
          }
          action={
            <Button onPress={onRetry} loading={checking} fullWidth={false}>
              {translate("Coba lagi")}
            </Button>
          }
        />
        <Text variant="caption" tone="secondary" className="mt-6 text-center">
          {translate(
            "Anda tidak perlu melakukan apa pun — cukup coba lagi nanti.",
          )}
        </Text>
      </View>
    </Screen>
  )
}
