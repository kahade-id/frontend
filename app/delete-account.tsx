import { useApiQuery } from "@/lib/use-api-query"
import { ErrorState } from "@/components/ui/error-state"
import { DetailLoading } from "@/components/ui/paginated-list"
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
import { useCallback, useRef, useState } from "react"
import { ScrollView } from "react-native"
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
const CONFIRM_PHRASE = "HAPUS AKUN"

export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const submitLock = useRef(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorText, setErrorText] = useState<string | undefined>()
  const prerequisites = useApiQuery("account-deletion-checks", async () => {
    const [twoFa, wallet, orders] = await Promise.all([
      api.auth.get2faStatus(),
      api.wallet.getWallet(),
      api.orders.listOrders({ page: 1, limit: 1, status: "ACTIVE" }),
    ])
    if (typeof twoFa?.enabled !== "boolean") throw new Error("2FA status is unknown")
    const blockers: string[] = []
    if (wallet.balance !== 0)
      blockers.push(`Saldo ${formatRupiah(wallet.balance)} belum diselesaikan`)
    if (wallet.holdBalance == null) blockers.push("Status dana tertahan belum terkonfirmasi")
    else if (wallet.holdBalance !== 0) blockers.push("Masih ada dana tertahan di escrow")
    if (orders.data.length > 0) blockers.push("Masih ada pesanan aktif")
    return { requireMfa: twoFa.enabled, blockers }
  })
  const requireMfa = prerequisites.data?.requireMfa ?? false
  const blockers = prerequisites.data?.blockers ?? ["Persyaratan penghapusan belum terkonfirmasi"]

  const handleSubmit = useCallback(
    async (payload: DeleteAccountPayload) => {
      if (submitLock.current || prerequisites.loading || prerequisites.error || blockers.length)
        return
      submitLock.current = true
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
          description:
            "Permintaan diterima oleh layanan. Ikuti informasi resmi Kahade mengenai proses selanjutnya.",
          tone: "success",
        })
        await unregisterPushDevice({
          registerDevice: (dto) => api.notifications.registerDevice(dto),
          unregisterDevice: () => api.notifications.unregisterDevice(),
        }).catch(() => undefined)
        await clearSession()
        router.replace(ROUTES.login)
      } catch {
        setErrorText(
          "Permintaan belum dapat diproses. Periksa persyaratan dan autentikasi, lalu coba kembali.",
        )
      } finally {
        submitLock.current = false
        setSubmitting(false)
      }
    },
    [prerequisites.loading, prerequisites.error, blockers, toast.show],
  )

  return (
    <Screen keyboardAvoiding edges={["top"]} padded={false}>
      {/* Header di LUAR area scroll: form ini panjang (blocker + frasa
          konfirmasi + MFA), tombol kembali harus tetap terlihat. */}
      <Header title="Hapus Akun" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-4 px-6"
        contentContainerStyle={{
          paddingTop: tokens.space[3],
          paddingBottom: insets.bottom + tokens.space[8],
        }}
      >
        {prerequisites.loading ? (
          <DetailLoading />
        ) : prerequisites.error ? (
          <ErrorState
            description={prerequisites.error}
            onRetry={() => void prerequisites.reload()}
          />
        ) : (
          <DeleteAccountForm
            confirmPhrase={CONFIRM_PHRASE}
            blockers={blockers}
            requireMfa={requireMfa}
            errorText={errorText}
            onSubmit={(p) => void handleSubmit(p)}
            submitting={submitting}
          />
        )}
      </ScrollView>
    </Screen>
  )
}
