/**
 * Screen — Hapus Akun (GAP-A G051–G075).
 *
 * Alur:
 *  1. Prasyarat dari SERVER (bukan rekonstruksi lokal):
 *     - GET /v1/users/me/deletion-eligibility → { eligible, blockers[] }
 *     - GET /v1/auth/2fa/status → requireMfa
 *  2. Form (kata sandi / OTP WhatsApp / kode 2FA) → POST /v1/users/me/delete-request
 *     dengan idempotency key. Response: referenceCode + purgeAt (30 hari).
 *  3. Sukses → layar menampilkan kode referensi, tanggal penghapusan
 *     permanen, dan cara membatalkan (pra-login, tanpa sesi).
 *  4. Sesi dibersihkan + push di-unregister, lalu ke Login.
 *
 * Backend tetap penjaga terakhir: blocker server bersifat final.
 */

import { useApiQuery } from "@/lib/use-api-query"
import { ErrorState } from "@/components/ui/error-state"
import { Crossfade } from "@/components/ui/fade-in"
import { DetailLoading } from "@/components/ui/paginated-list"
import { useCallback, useRef, useState } from "react"
import { Platform, ScrollView, View } from "react-native"
import { router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api, deletionBlockerMessage } from "@/lib/api"
import type { DeletionRequestResult } from "@/lib/api/account-deletion"
import { setPendingDeletionResult } from "@/lib/account-deletion-result"
import { clearSession } from "@/lib/api/session"
import { translate } from "@/lib/i18n/translate"
import { unregisterPushDevice } from "@/lib/push-notifications"
import { unregisterWebPushDevice } from "@/lib/web-push"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { logWarn } from "@/lib/telemetry"

import { Alert } from "@/components/ui/alert"
import { DeleteAccountForm, type DeleteAccountPayload } from "@/components/ui/delete-account-form"
import { Header } from "@/components/ui/header"
import { Screen } from "@/components/ui/screen"
import { useToast } from "@/components/ui/toast"

const CONFIRM_PHRASE = "HAPUS AKUN"

function newIdempotencyKey(): string {
  return `del_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const submitLock = useRef(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorText, setErrorText] = useState<string | undefined>()
  const [idempotencyKey] = useState(newIdempotencyKey)

  const prerequisites = useApiQuery("account-deletion-checks", async (signal) => {
    const [twoFa, eligibility] = await Promise.all([
      api.auth.get2faStatus(signal),
      api.accountDeletion.getDeletionEligibility(signal),
    ])
    if (typeof twoFa?.enabled !== "boolean") throw new Error("2FA status is unknown")
    return {
      requireMfa: twoFa.enabled,
      eligible: eligibility.eligible,
      blockers: eligibility.blockers.map((b) => b.message),
    }
  })
  const requireMfa = prerequisites.data?.requireMfa ?? false
  const eligible = prerequisites.data?.eligible ?? false
  const blockers = prerequisites.data?.blockers ?? ["Persyaratan penghapusan belum terkonfirmasi"]

  const handleSubmit = useCallback(
    async (payload: DeleteAccountPayload) => {
      if (submitLock.current || prerequisites.loading || prerequisites.error) return
      if (!eligible) return
      submitLock.current = true
      setSubmitting(true)
      setErrorText(undefined)
      try {
        const res: DeletionRequestResult = await api.accountDeletion.requestAccountDeletion({
          password: payload.password,
          reason: payload.reason.trim() || undefined,
          mfaCode: payload.mfaCode || undefined,
          idempotencyKey,
        })
        toast.show({
          title: translate("Permintaan penghapusan terkirim"),
          description: translate("Kode referensi: {x}", { x: res.referenceCode }),
          tone: "success",
        })
        const deviceApi = {
          registerDevice: (dto: Parameters<typeof api.notifications.registerDevice>[0]) =>
            api.notifications.registerDevice(dto),
          // BFI-111 (worker push): unregisterDevice kini wajib membawa deviceId;
          // diisi pemanggil (unregisterPushDevice) dari getOrCreateDeviceId().
          unregisterDevice: (deviceId: string) => api.notifications.unregisterDevice(deviceId),
        }
        if (Platform.OS === "web")
          await unregisterWebPushDevice(deviceApi).catch((err) => logWarn("account-delete:unregister-push", err))
        else await unregisterPushDevice(deviceApi).catch((err) => logWarn("account-delete:unregister-push", err))
        /*
         * Audit Auth 2026-10-10 (#FE-S16): server sudah mencabut semua sesi;
         * membersihkan sesi lokal di sini membuat `Stack.Protected` mencabut
         * layar INI sebelum kode referensi terbaca. Hasilnya dititipkan ke
         * memori modul dan ditampilkan layar publik /deletion-status.
         */
        setPendingDeletionResult(res)
        await clearSession()
        router.replace(ROUTES.deletionStatus)
      } catch (err) {
        // BFI-057: backend menolak dengan kode blocker SPESIFIK
        // (ACTIVE_ORDERS_PRESENT / ESCROW_BALANCE_PRESENT / WALLET_BALANCE_PRESENT
        // — diverifikasi di users.service.ts; string DELETION_BLOCKED tidak
        // pernah dikirim backend sehingga cabang lama mati total).
        // Tampilkan alasan spesifik + muat ulang eligibility agar daftar
        // blocker di form ikut segar. Fail-closed: penolakan tak dikenal
        // jatuh ke pesan generik — TIDAK pernah diartikan "boleh hapus".
        const blockerMessage = deletionBlockerMessage(err)
        if (blockerMessage) {
          setErrorText(blockerMessage)
          void prerequisites.reload()
          return
        }
        setErrorText(
          "Permintaan belum dapat diproses. Periksa persyaratan dan autentikasi, lalu coba kembali.",
        )
      } finally {
        submitLock.current = false
        setSubmitting(false)
      }
    },
    [prerequisites.loading, prerequisites.error, eligible, toast.show, idempotencyKey, prerequisites],
  )

  // Layar hasil (kode referensi + jadwal purge + cara batalkan) kini dirender
  // layar publik /deletion-status (#FE-S16) — sesi sudah dicabut server.

  return (
    <Screen keyboardAvoiding edges={["top"]} padded={false}>
      <Header title="Hapus Akun" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-4 px-5"
        contentContainerStyle={{
          paddingTop: tokens.space[3],
          paddingBottom: insets.bottom + tokens.space[8],
        }}
      >
        <Crossfade loading={prerequisites.loading} skeleton={<DetailLoading />}>
          {prerequisites.error ? (
            <ErrorState
              description={prerequisites.error}
              onRetry={() => void prerequisites.reload()}
            />
          ) : (
            <View className="gap-4">
              <Alert tone="info">
                Akun dinonaktifkan dulu, dihapus permanen 30 hari kemudian. Masih bisa dibatalkan
                dari layar Masuk.
              </Alert>
              <DeleteAccountForm
                gracePeriodDays={30}
                confirmPhrase={CONFIRM_PHRASE}
                blockers={blockers}
                requireMfa={requireMfa}
                errorText={errorText}
                onSubmit={(p) => void handleSubmit(p)}
                submitting={submitting}
              />
            </View>
          )}
        </Crossfade>
      </ScrollView>
    </Screen>
  )
}
