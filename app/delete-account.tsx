/**
 * Screen — Hapus Akun (POST /v1/users/me/delete-request).
 *
 * `RequestAccountDeletionDto` = { password, reason?, mfaCode? }. Password dan
 * kode 2FA dikumpulkan <DeleteAccountForm>; layar ini hanya:
 *   - mengecek apakah 2FA aktif (GET /v1/auth/2fa/status) → `requireMfa`;
 *   - menyusun `blockers` dari saldo dompet (GET /v1/wallet) dan pesanan
 *     aktif (GET /v1/orders?status=ACTIVE) supaya alasan penolakan terlihat
 *     SEBELUM pengguna mengisi form — backend tetap menolak, tapi pesannya
 *     generik;
 *   - setelah sukses: sesi dibersihkan dan kembali ke Login (akun sudah
 *     dinonaktifkan; token yang tersisa hanya akan menghasilkan 401).
 *
 * Blocker bersifat best-effort: kegagalan memuat saldo/pesanan TIDAK
 * memblokir form (array kosong) — backend tetap menjadi penjaga terakhir.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api } from "@/lib/api"
import { clearSession } from "@/lib/api/session"
import { formatRupiah } from "@/lib/format"
import { unregisterPushDevice } from "@/lib/push-notifications"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { DeleteAccountForm, type DeleteAccountPayload } from "@/components/ui/delete-account-form"
import { Header } from "@/components/ui/header"
import { Screen } from "@/components/ui/screen"
import { useToast } from "@/components/ui/toast"

/** Masa tenggang penghapusan permanen (kebijakan produk; belum ada di API). */
const GRACE_PERIOD_DAYS = 30
const CONFIRM_PHRASE = "HAPUS AKUN"

export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [submitting, setSubmitting] = useState(false)
  const [requireMfa, setRequireMfa] = useState(false)
  const [blockers, setBlockers] = useState<string[]>([])
  const [errorText, setErrorText] = useState<string | undefined>()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [twoFa, wallet, activeOrders] = await Promise.all([
        api.auth.get2faStatus().catch(() => null),
        api.wallet.getWallet().catch(() => null),
        api.orders.listOrders({ page: 1, limit: 1, status: "ACTIVE", role: "ALL" }).catch(() => null),
      ])
      if (cancelled) return
      setRequireMfa(!!twoFa?.enabled)

      const next: string[] = []
      const balance = wallet?.availableBalance ?? wallet?.balance ?? 0
      if (balance > 0) next.push(`Saldo ${formatRupiah(balance)} belum ditarik`)
      const activeCount = activeOrders?.meta?.total ?? activeOrders?.data?.length ?? 0
      if (activeCount > 0) next.push(`${activeCount} pesanan masih berjalan`)
      setBlockers(next)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = useCallback(
    async (payload: DeleteAccountPayload) => {
      setSubmitting(true)
      setErrorText(undefined)
      try {
        await api.users.requestAccountDeletion({
          password: payload.password,
          reason: payload.reason.trim() || undefined,
          mfaCode: payload.mfaCode || undefined,
        })
        toast.show({
          title: "Permintaan penghapusan terkirim",
          description: `Akun dinonaktifkan dan akan dihapus permanen setelah ${GRACE_PERIOD_DAYS} hari.`,
          tone: "success",
        })
        await unregisterPushDevice({
          registerDevice: (dto) => api.notifications.registerDevice(dto),
          unregisterDevice: () => api.notifications.unregisterDevice(),
        }).catch(() => undefined)
        await clearSession()
        router.replace(ROUTES.login)
      } catch {
        setErrorText(requireMfa ? "Password atau kode autentikator salah." : "Password salah.")
      } finally {
        setSubmitting(false)
      }
    },
    [requireMfa, toast.show],
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Hapus Akun" />
      <View
        className="gap-4 px-6"
        style={{ paddingTop: tokens.space[3], paddingBottom: insets.bottom + tokens.space[8] }}
      >
        <DeleteAccountForm
          gracePeriodDays={GRACE_PERIOD_DAYS}
          confirmPhrase={CONFIRM_PHRASE}
          blockers={blockers}
          requireMfa={requireMfa}
          errorText={errorText}
          onSubmit={(p) => void handleSubmit(p)}
          submitting={submitting}
        />
      </View>
    </Screen>
  )
}
