/**
 * Screen — Status & Pemulihan Penghapusan Akun (GAP-A G052/G053/G064).
 *
 * PRA-LOGIN: user dalam masa tenggang sudah kehilangan sesi. Alur:
 *  1. Masukkan nomor HP / email → POST /v1/auth/deletion/status
 *     → OTP dikirim via WhatsApp ke nomor terdaftar.
 *  2. Verifikasi OTP → POST /v1/auth/deletion/status/verify
 *     → status lengkap + deletionToken (15 menit). TIDAK membuat sesi login.
 *  3. Lihat jadwal purge → "Batalkan penghapusan" (opsional, butuh konfirmasi)
 *     → POST /v1/auth/deletion/cancel → akun aktif kembali; login ulang normal.
 */

import { useState } from "react"
import { ScrollView } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api, isApiError, userMessage } from "@/lib/api"
import type { DeletionStatus } from "@/lib/api/account-deletion"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { formatDate } from "@/lib/format"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { Input } from "@/components/ui/input"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { VStack } from "@/components/ui/stack"
import { useToast } from "@/components/ui/toast"

type Step = "lookup" | "otp" | "status"

/** Panjang kode OTP penghapusan akun — harus sama dengan copy UI ("kode 6 digit", UI-M016). */
const DELETION_OTP_LENGTH = 6

export default function DeletionStatusScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [step, setStep] = useState<Step>("lookup")
  const [identifier, setIdentifier] = useState("")
  const [otp, setOtp] = useState("")
  const [maskedPhone, setMaskedPhone] = useState<string | undefined>()
  const [status, setStatus] = useState<DeletionStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelled, setCancelled] = useState(false)

  const lookupDto = () =>
    identifier.includes("@")
      ? { email: identifier.trim() }
      : { phoneNumber: identifier.trim() }

  const handleLookup = async () => {
    if (busy || !identifier.trim()) return
    setBusy(true)
    setErrorText(null)
    try {
      const res = await api.accountDeletion.requestDeletionStatus(lookupDto())
      if (!res.requiresOtp) {
        setErrorText("Tidak ada permintaan penghapusan aktif untuk identitas ini.")
        return
      }
      setMaskedPhone(res.maskedPhone)
      setStep("otp")
      toast.show({
        title: "Kode dikirim via WhatsApp",
        description: res.maskedPhone ? `Ke nomor ${res.maskedPhone}.` : undefined,
        tone: "info",
      })
    } catch (err) {
      setErrorText(userMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleVerify = async () => {
    if (busy || otp.trim().length < DELETION_OTP_LENGTH) return
    setBusy(true)
    setErrorText(null)
    try {
      const res = await api.accountDeletion.verifyDeletionStatus({ ...lookupDto(), otp: otp.trim() })
      setStatus(res)
      setStep("status")
    } catch (err) {
      if (isApiError(err) && err.code === "UNAUTHORIZED") {
        setErrorText("Kode salah atau kedaluwarsa. Minta kode baru bila perlu.")
        return
      }
      setErrorText(userMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleCancel = async () => {
    if (busy || !status) return
    setBusy(true)
    setErrorText(null)
    try {
      await api.accountDeletion.cancelAccountDeletion({ deletionToken: status.deletionToken })
      setConfirmCancel(false)
      setCancelled(true)
      toast.show({ title: "Penghapusan dibatalkan", description: "Akun Anda aktif kembali. Silakan masuk.", tone: "success" })
    } catch (err) {
      setConfirmCancel(false)
      setErrorText(userMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen keyboardAvoiding edges={["top"]} padded={false}>
      <Header title="Pulihkan Akun" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-4 px-5"
        contentContainerStyle={{ paddingTop: tokens.space[3], paddingBottom: insets.bottom + tokens.space[8] }}
      >
        {errorText ? (
          <Alert tone="danger" onDismiss={() => setErrorText(null)}>{errorText}</Alert>
        ) : null}

        {cancelled ? (
          <VStack gap={3}>
            <Heading level={1}>Akun dipulihkan</Heading>
            <Text variant="body" tone="secondary" className="text-pretty">
              Permintaan penghapusan dibatalkan. Akun Anda aktif kembali seperti semula —
              silakan masuk dengan nomor HP / kata sandi Anda.
            </Text>
            <Button onPress={() => router.replace(ROUTES.login)}>Ke Layar Masuk</Button>
          </VStack>
        ) : step === "status" && status ? (
          <VStack gap={3}>
            <Heading level={1}>Status penghapusan</Heading>
            <VStack gap={1}>
              <Text variant="body" tone="secondary">Kode referensi</Text>
              <Text variant="body" weight={600}>{status.referenceCode}</Text>
            </VStack>
            <VStack gap={1}>
              <Text variant="body" tone="secondary">Diajukan</Text>
              <Text variant="body">{formatDate(status.requestedAt)}</Text>
            </VStack>
            <VStack gap={1}>
              <Text variant="body" tone="secondary">Dihapus permanen pada</Text>
              <Text variant="body" weight={600}>{formatDate(status.purgeAt)}</Text>
            </VStack>
            <Text variant="body" tone="secondary" className="text-pretty">
              Sisa waktu {status.daysRemaining} hari. Setelah tanggal itu data dihapus
              permanen dan tidak bisa dipulihkan.
            </Text>
            <Button variant="secondary" onPress={() => setConfirmCancel(true)} disabled={busy}>
              Batalkan Penghapusan
            </Button>
            <Button variant="ghost" onPress={() => router.replace(ROUTES.login)}>
              Kembali ke Masuk
            </Button>
          </VStack>
        ) : step === "otp" ? (
          <VStack gap={3}>
            <Heading level={1}>Verifikasi kepemilikan</Heading>
            <Text variant="body" tone="secondary" className="text-pretty">
              Masukkan kode 6 digit yang dikirim via WhatsApp{maskedPhone ? ` ke ${maskedPhone}` : ""}.
              Ini membuktikan akun tersebut milik Anda — tanpa membuat sesi login.
            </Text>
            <Input
              label="Kode WhatsApp"
              value={otp}
              onChangeText={(t) => {
                setOtp(t.replace(/\D/g, "").slice(0, 6))
                setErrorText(null)
              }}
              keyboardType="number-pad"
              required
              returnKeyType="done"
              onSubmitEditing={() => void handleVerify()}
              disabled={busy}
              autoFocus
            />
            <Button onPress={() => void handleVerify()} loading={busy} disabled={otp.trim().length < DELETION_OTP_LENGTH}>
              Verifikasi
            </Button>
            <Button variant="ghost" onPress={() => void handleLookup()} disabled={busy}>
              Kirim ulang kode
            </Button>
          </VStack>
        ) : (
          <VStack gap={3}>
            <Heading level={1}>Akun dihapus? Pulihkan di sini</Heading>
            <Text variant="body" tone="secondary" className="text-pretty">
              Bila Anda pernah meminta penghapusan akun dan masih dalam masa tenggang
              30 hari, Anda bisa melihat statusnya dan membatalkannya di sini —
              tanpa perlu login.
            </Text>
            <Input
              label="Nomor HP / email terdaftar"
              value={identifier}
              onChangeText={(t) => {
                setIdentifier(t)
                setErrorText(null)
              }}
              keyboardType="default"
              autoCapitalize="none"
              required
              returnKeyType="done"
              onSubmitEditing={() => void handleLookup()}
              disabled={busy}
              autoFocus
            />
            <Button onPress={() => void handleLookup()} loading={busy} disabled={!identifier.trim()}>
              Lanjut
            </Button>
            <Button variant="ghost" onPress={() => router.replace(ROUTES.login)}>
              Kembali ke Masuk
            </Button>
          </VStack>
        )}

        <Dialog
          visible={confirmCancel}
          onRequestClose={() => setConfirmCancel(false)}
          title="Batalkan penghapusan?"
          description="Akun Anda akan diaktifkan kembali seperti semula. Tindakan ini tidak bisa dibatalkan setelah masa tenggang berakhir."
          confirmLabel="Ya, batalkan"
          onConfirm={() => void handleCancel()}
          loading={busy}
        />
      </ScrollView>
    </Screen>
  )
}
