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

import { api, isApiError } from "@/lib/api"
import type { DeletionRequestResult } from "@/lib/api/account-deletion"
import { clearSession } from "@/lib/api/session"
import { copyToClipboard } from "@/lib/clipboard"
import { formatDate } from "@/lib/format"
import { unregisterPushDevice } from "@/lib/push-notifications"
import { unregisterWebPushDevice } from "@/lib/web-push"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { logWarn } from "@/lib/telemetry"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { DeleteAccountForm, type DeleteAccountPayload } from "@/components/ui/delete-account-form"
import { Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { VStack } from "@/components/ui/stack"
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
  const [result, setResult] = useState<DeletionRequestResult | null>(null)
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
        const res = await api.accountDeletion.requestAccountDeletion({
          password: payload.password,
          reason: payload.reason.trim() || undefined,
          mfaCode: payload.mfaCode || undefined,
          idempotencyKey,
        })
        setResult(res)
        toast.show({
          title: "Permintaan penghapusan terkirim",
          description: `Kode referensi: ${res.referenceCode}`,
          tone: "success",
        })
        const deviceApi = {
          registerDevice: (dto: Parameters<typeof api.notifications.registerDevice>[0]) =>
            api.notifications.registerDevice(dto),
          unregisterDevice: () => api.notifications.unregisterDevice(),
        }
        if (Platform.OS === "web")
          await unregisterWebPushDevice(deviceApi).catch((err) => logWarn("account-delete:unregister-push", err))
        else await unregisterPushDevice(deviceApi).catch((err) => logWarn("account-delete:unregister-push", err))
        await clearSession()
      } catch (err) {
        if (isApiError(err) && err.backendCode === "DELETION_BLOCKED") {
          setErrorText("Penghapusan belum bisa diproses: masih ada saldo, pesanan aktif, atau sengketa terbuka. Selesaikan dulu, lalu coba lagi.")
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

  // ── Layar hasil: kode referensi + jadwal purge + cara batalkan ─────────
  // FE-IMP-3 #96 — tombol "Salin kode" untuk kode referensi (dibutuhkan untuk
  // pembatalan pra-login dari layar Masuk).
  const handleCopyCode = useCallback(async () => {
    if (!result) return
    const ok = await copyToClipboard(result.referenceCode)
    toast.show(
      ok
        ? { title: "Kode referensi disalin", tone: "success", duration: 2500 }
        : { title: "Gagal menyalin kode", description: "Salin manual dari layar ini.", tone: "danger" },
    )
  }, [result, toast])

  if (result) {
    return (
      <Screen edges={["top"]}>
        <Header title="Permintaan Terkirim" />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="gap-4 px-5"
          contentContainerStyle={{
            paddingTop: tokens.space[3],
            paddingBottom: insets.bottom + tokens.space[8],
          }}
        >
          <VStack gap={2}>
            <Heading level={1}>Akun dijadwalkan dihapus</Heading>
            <Text variant="body" tone="secondary" className="text-pretty">
              Akun Anda dinonaktifkan dan akan dihapus permanen pada{" "}
              <Text variant="body" weight={600}>{formatDate(result.purgeAt)}</Text>.
              Anda masih bisa membatalkannya sampai tanggal itu.
            </Text>
          </VStack>
          <Alert tone="warning" title="Simpan kode referensi ini">
            {result.referenceCode}
          </Alert>
          <Button variant="secondary" size="sm" onPress={() => void handleCopyCode()}>
            Salin kode
          </Button>
          <VStack gap={2}>
            <Heading level={2}>Cara membatalkan</Heading>
            <Text variant="body" tone="secondary" className="text-pretty">
              1. Keluar / buka layar Masuk.{"\n"}
              2. Ketuk “Akun dihapus? Pulihkan di sini”.{"\n"}
              3. Masukkan nomor HP, verifikasi kode WhatsApp, lalu batalkan penghapusan.
            </Text>
          </VStack>
          <Button onPress={() => router.replace(ROUTES.login)}>
            Ke Layar Masuk
          </Button>
        </ScrollView>
      </Screen>
    )
  }

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
                Penghapusan bersifat dua tahap: akun dinonaktifkan dulu, lalu dihapus
                permanen 30 hari kemudian. Selama masa tenggang Anda bisa membatalkannya
                dari layar Masuk tanpa perlu login.
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
