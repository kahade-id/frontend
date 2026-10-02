/**
 * Kahade — listener realtime GLOBAL (SYS-C-403).
 *
 * Di-mount SEKALI di dalam <RealtimeProvider> (app/_layout.tsx), di atas
 * seluruh tree, sehingga event per-user sampai kapan pun layar sedang
 * terbuka — tidak seperti hook per-layar (mis. useNotificationsRealtime
 * yang hanya hidup di tab Notifikasi).
 *
 *   - `new.device.login` → dialog peringatan keamanan minimalis.
 *   - `wallet.balance_updated` → invalidasi cache saldo dompet.
 */
import { router } from "expo-router"

import { Dialog } from "@/components/ui/modal"
import { ROUTES } from "@/lib/routes"
import { useNewDeviceLoginAlert } from "@/lib/realtime/use-security-alerts-realtime"
import { useWalletBalanceRealtime } from "@/lib/realtime/use-wallet-realtime"

export function RealtimeGlobalListeners() {
  // Saldo dompet refresh realtime (tanpa UI).
  useWalletBalanceRealtime()
  // Peringatan login perangkat baru → dialog keamanan.
  const { alert, dismiss } = useNewDeviceLoginAlert()

  const details = [alert?.deviceInfo, alert?.ipAddress ? `IP ${alert.ipAddress}` : null]
    .filter(Boolean)
    .join(" · ")

  return (
    <>
      {alert ? (
        <Dialog
          visible
          onRequestClose={dismiss}
          tone="warning"
          title="Login perangkat baru terdeteksi"
          description={
            details
              ? `Akun Anda baru saja diakses dari perangkat baru (${details}). Jika ini bukan Anda, segera periksa sesi keamanan Anda.`
              : "Akun Anda baru saja diakses dari perangkat baru. Jika ini bukan Anda, segera periksa sesi keamanan Anda."
          }
          cancelLabel="Tutup"
          confirmLabel="Periksa keamanan"
          actionsLayout="row"
          onConfirm={() => {
            dismiss()
            router.push(ROUTES.security)
          }}
        />
      ) : null}
    </>
  )
}
