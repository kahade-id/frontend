/** Secure two-step phone change: request a sensitive-action OTP, then confirm it. */
import { useCallback, useEffect, useMemo, useState } from "react"
import { ScrollView, View } from "react-native"
import { router } from "expo-router"

import { OtpMethodSelector } from "@/components/register/otp-method-selector"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { OtpInput } from "@/components/ui/otp-input"
import { PasswordField } from "@/components/ui/password-field"
import { PhoneInput, isValidPhoneId, normalizePhoneId, toE164Id } from "@/components/ui/phone-input"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { SensitiveText } from "@/components/ui/sensitive-text"
import { useToast } from "@/components/ui/toast"
import { api, clearSession, isApiError, type OtpMethod, type UserProfile, userMessage } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"

type Step = "request" | "confirm"

export default function ChangePhoneScreen() {
  const toast = useToast()
  const profile = useApiQuery<UserProfile>("change-phone-me", (signal) => api.users.getMe(signal))
  const methods = useApiQuery("change-phone-otp-methods", (signal) => api.auth.getOtpMethods(signal))
  const currentPhone = profile.data?.phoneNumber ?? ""

  const [step, setStep] = useState<Step>("request")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [method, setMethod] = useState<OtpMethod>()
  const [mfaCode, setMfaCode] = useState("")
  const [mfaRequired, setMfaRequired] = useState(false)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const offered = methods.data?.methods ?? []
    if (!method && offered.length) setMethod(offered[0])
  }, [method, methods.data])

  const newPhone = useMemo(() => (isValidPhoneId(phone) ? toE164Id(phone) : ""), [phone])
  const unchanged = !!newPhone && newPhone === currentPhone
  const mfaValid = !mfaRequired || /^(?:\d{6}|[A-Za-z0-9]{10,16})$/.test(mfaCode)
  const canRequest = !!newPhone && !unchanged && !!password && !!method && mfaValid && !submitting
  const canConfirm = code.length === 6 && !submitting

  const requestCode = useCallback(async () => {
    if (!canRequest || !method) return
    setSubmitting(true)
    setError(undefined)
    try {
      await api.auth.requestPhoneChange({
        newPhoneNumber: newPhone,
        currentPassword: password,
        method,
        mfaCode: mfaCode || undefined,
      })
      // Password/MFA are only needed for step one. Do not retain them longer than necessary.
      setPassword("")
      setMfaCode("")
      setStep("confirm")
    } catch (err: unknown) {
      if (isApiError(err) && err.backendCode === "TWO_FA_REQUIRED") setMfaRequired(true)
      setError(userMessage(err))
    } finally {
      setSubmitting(false)
    }
  }, [canRequest, method, newPhone, password, mfaCode])

  const confirmCode = useCallback(async () => {
    if (!canConfirm) return
    setSubmitting(true)
    setError(undefined)
    try {
      await api.auth.confirmPhoneChange({ newPhoneNumber: newPhone, code })
      setCode("")
      // Backend revokes every session after this mutation, including this one.
      // End the local session deterministically instead of racing a profile refresh.
      await clearSession()
      toast.show({
        title: "Nomor HP diperbarui",
        description: "Nomor baru telah diverifikasi. Silakan masuk kembali.",
        tone: "success",
        duration: 4000,
      })
      router.replace(ROUTES.login)
    } catch (err: unknown) {
      setError(userMessage(err))
    } finally {
      setSubmitting(false)
    }
  }, [canConfirm, code, newPhone, toast.show])

  return (
    <Screen keyboardAvoiding edges={["top"]} padded={false} footer={
      <View>
        <Button fullWidth loading={submitting} disabled={step === "request" ? !canRequest : !canConfirm}
          onPress={() => void (step === "request" ? requestCode() : confirmCode())}>
          {step === "request" ? "Kirim kode verifikasi" : "Verifikasi dan ganti nomor"}
        </Button>
      </View>
    }>
      <Header title="Ganti Nomor HP" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 px-6 py-4">
        {currentPhone ? <Alert tone="neutral" title="Nomor saat ini">
          <SensitiveText value={currentPhone} mask="phone" mono={false} variant="body" toggleable={false} />
        </Alert> : null}
        {error ? <Alert tone="danger" title="Perubahan belum dapat diproses">{error}</Alert> : null}

        {step === "request" ? <>
          <SectionHeader title="Nomor baru" />
          <PhoneInput label="Nomor HP baru" value={phone}
            onChangeText={(value) => { setPhone(normalizePhoneId(value)); setError(undefined) }} required
            helperText={unchanged ? "Nomor ini sama dengan nomor terdaftar." : "Format Indonesia, mis. 812-3456-7890."}
            errorText={phone.length > 0 && !isValidPhoneId(phone) ? "Nomor tidak valid" : undefined} />
          <PasswordField label="Password akun" value={password} onChangeText={setPassword} required
            helperText="Dibutuhkan untuk mengotorisasi perubahan nomor." />
          {mfaRequired ? <Input label="Kode autentikator atau backup" value={mfaCode}
            onChangeText={(value) => setMfaCode(value.replace(/[^A-Za-z0-9]/g, "").slice(0, 16))}
            autoCapitalize="characters" autoCorrect={false} maxLength={16} required
            helperText="Masukkan 6 digit autentikator atau kode backup Anda." /> : null}
          <SectionHeader title="Kirim kode melalui" />
          {methods.error ? <Alert tone="warning">Metode pengiriman OTP tidak dapat dimuat. Coba lagi.</Alert> : null}
          <OtpMethodSelector methods={methods.data?.methods ?? []} value={method} onChange={setMethod}
            loading={methods.loading} disabled={submitting} />
        </> : <>
          <SectionHeader title="Masukkan kode verifikasi" />
          <Alert tone="info">Kode 6 digit telah dikirim ke <SensitiveText value={newPhone} mask="phone" toggleable={false} />.</Alert>
          <OtpInput value={code} onChange={(value) => { setCode(value); setError(undefined) }}
            errorText={error} autoFocus disabled={submitting} />
          <Button variant="ghost" disabled={submitting} onPress={() => { setCode(""); setError(undefined); setStep("request") }}>
            Ubah nomor atau metode
          </Button>
        </>}
      </ScrollView>
    </Screen>
  )
}
