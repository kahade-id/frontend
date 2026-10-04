/**
 * Kahade — modal pemulihan sesi lembut (P0-1, audit perf/UX 2026-10-03).
 *
 * Muncul DI ATAS layar yang sedang dipakai saat sesi kedaluwarsa (native),
 * tanpa navigasi apa pun: navigation stack tetap utuh, isian yang belum
 * dikirim tetap hidup, dan setelah masuk berhasil pengguna kembali ke layar
 * semula. Ini menggantikan `router.replace("/login")` yang dulu menghancurkan
 * stack [A → B → C].
 *
 * Keputusan non-obvious:
 *   - Formulir di sini SENGAJA minimal (identifier + kata sandi). Jalur auth
 *     selebihnya — 2FA, migrasi nomor HP, captcha, passkey, OTP WhatsApp —
 *     dialihkan ke ALUR LAMA (layar /login lengkap) lewat
 *     `requestSoftReauthFallback()`. Menyalin seluruh alur login ke modal
 *     berarti dua permukaan auth yang bisa menyimpang; yang tidak ditangani
 *     di sini selalu jatuh ke jalur yang sudah teruji, bukan ke jalur baru.
 *   - Login memakai `api.auth.login` yang SAMA dengan layar login: token
 *     disimpan lewat `startSession` (revisi sesi naik, cache akun lama
 *     dibersihkan) — bukan jalur penyimpanan kedua.
 *   - Tutup modal = fallback (sesuai temuan audit), bukan sekadar menyembunyikan
 *     sheet: layar di belakangnya sudah tidak punya sesi, jadi menutup tanpa
 *     mengalihkan hanya menampilkan layar yang setiap request-nya 401.
 *   - Fail-closed: apa pun yang tidak pasti (perlu verifikasi tambahan,
 *     captcha diminta, kegagalan jaringan berulang) berakhir di alur lama.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { View, type TextInputInstance } from "react-native"

import { api, isApiError, userMessage } from "@/lib/api"
import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { useHasSession } from "@/lib/guest-gate"
import { translate } from "@/lib/i18n/translate"
import { getAuthLocation } from "@/lib/location"
import { clearLoginIdentifier, getLoginIdentifier } from "@/lib/login-identifier"
import { setPendingNext } from "@/lib/login-redirect"
import {
  closeSoftReauth,
  isSoftReauthActive,
  noteSoftReauthFailure,
  requestSoftReauthFallback,
  useSoftReauthActive,
} from "@/lib/soft-reauth"

import { Alert } from "@/components/ui/alert"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PasswordField } from "@/components/ui/password-field"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

const IDENTIFIER_MAX = 254 // email/nomor HP terpanjang; dijaga backend juga
const PASSWORD_MAX = API_CONSTRAINTS.LoginDto.password.maxLength

export function SoftReauthGate() {
  const active = useSoftReauthActive()
  const hasSession = useHasSession()
  const toast = useToast()

  const [identifier, setIdentifier] = useState(() => getLoginIdentifier())
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  /** Sukses di modal ini → toast setelah sheet tertutup. */
  const succeeded = useRef(false)
  const passwordRef = useRef<TextInputInstance>(null)

  // Sesi kembali terbit (login dari modal ini, atau refresh di tempat lain):
  // tutup sheet, jangan sentuh stack.
  useEffect(() => {
    if (!active || !hasSession) return
    closeSoftReauth()
    if (succeeded.current) {
      succeeded.current = false
      toast.show({
        title: translate("Berhasil masuk kembali"),
        description: translate("Anda kembali ke layar sebelumnya."),
        tone: "success",
        duration: 3000,
      })
    }
  }, [active, hasSession, toast])

  // Bila latch aktif tapi layar sudah tidak butuh (mis. token ternyata ada),
  // `hasSession` di atas yang menutup. Tidak ada auto-tutup lain: menutup
  // tanpa login harus lewat fallback (lihat docblock).

  const fallback = useCallback(
    (message?: string) => {
      if (message) {
        toast.show({ title: translate("Perlu langkah tambahan"), description: message, tone: "info", duration: 5000 })
      }
      requestSoftReauthFallback()
    },
    [toast],
  )

  const handleSubmit = useCallback(async () => {
    if (submitting) return
    const trimmed = identifier.trim()
    if (!trimmed || !password) {
      setError(translate("Isi username/email/nomor HP dan kata sandi."))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const result = await api.auth.login({
        identifier: trimmed,
        password,
        location: (await getAuthLocation()) ?? undefined,
      })

      if ("requiresPhoneMigration" in result && result.requiresPhoneMigration) {
        fallback(translate("Akun ini perlu memindahkan nomor HP. Lanjutkan di layar masuk."))
        return
      }
      if (
        ("requires2FA" in result && result.requires2FA) ||
        ("requiresTwoFactor" in result && result.requiresTwoFactor)
      ) {
        fallback(translate("Akun ini memakai verifikasi 2 langkah. Lanjutkan di layar masuk."))
        return
      }

      succeeded.current = true
      // Sama seperti layar login: sesi formulir selesai → identifier di memori
      // modul dibersihkan (tidak ada kata sandi yang pernah disimpan).
      clearLoginIdentifier()
      setPassword("")
      // Jangan tinggalkan tujuan tertunda dari episode kedaluwarsa: setelah
      // login di modal, pengguna TETAP di layar yang sama.
      setPendingNext(null)
      closeSoftReauth()
    } catch (err) {
      const code = isApiError(err) ? (err.backendCode ?? err.code) : ""
      // Captcha hanya hidup di layar login lengkap — alihkan, jangan tampilkan
      // tantangan yang tidak bisa dijawab di sini.
      if (code === "CAPTCHA_REQUIRED" || code === "CAPTCHA_FAILED" || code === "CAPTCHA_EXPIRED") {
        fallback(translate("Demi keamanan, masukkan kembali lewat layar masuk."))
        return
      }
      if (isApiError(err) && err.code === "ACCOUNT_LOCKED") {
        // Bentuk galat backend tidak diketik di ApiError; layar login membaca
        // field yang sama dengan cast yang sama.
        const remainingSeconds = (err as { lockoutRemainingSeconds?: number }).lockoutRemainingSeconds
        const minutes = remainingSeconds ? Math.ceil(remainingSeconds / 60) : null
        setError(
          minutes
            ? translate("Akun terkunci sementara. Coba lagi dalam {x} menit.", { x: minutes })
            : translate(
                "Akun terkunci sementara karena terlalu banyak percobaan gagal. Coba beberapa saat lagi.",
              ),
        )
      } else if (isApiError(err) && err.code === "RATE_LIMITED") {
        setError(translate("Terlalu banyak percobaan. Tunggu sebentar sebelum mencoba lagi."))
      } else if (isApiError(err) && err.code === "UNAUTHORIZED") {
        setError(translate("Username, email, atau kata sandi salah. Periksa kembali dan coba lagi."))
      } else {
        setError(userMessage(err))
      }
      // Kegagalan ke-3 → alur lama (redirect penuh), bukan percobaan tanpa batas.
      if (noteSoftReauthFailure()) return
    } finally {
      setSubmitting(false)
    }
  }, [identifier, password, submitting, fallback])

  if (!active) return null

  return (
    <BottomSheet
      visible={isSoftReauthActive()}
      title={translate("Sesi Anda berakhir")}
      description={translate(
        "Masuk kembali untuk melanjutkan. Layar dan isian Anda tetap utuh di belakang.",
      )}
      avoidKeyboard
      accessibilityLabel={translate("Masuk kembali")}
      onRequestClose={() => fallback()}
      footer={
        <View className="gap-2">
          <Button fullWidth loading={submitting} onPress={() => void handleSubmit()}>
            {translate("Masuk")}
          </Button>
          <Button variant="ghost" fullWidth disabled={submitting} onPress={() => fallback()}>
            {translate("Buka layar masuk")}
          </Button>
        </View>
      }
    >
      <View className="gap-4">
        {error ? (
          <Alert tone="danger" title={translate("Gagal masuk")}>
            {error}
          </Alert>
        ) : null}
        <Field label={translate("Username, email, atau nomor HP")} required>
          <Input
            value={identifier}
            onChangeText={(text) => {
              setIdentifier(text)
              setError(null)
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            maxLength={IDENTIFIER_MAX}
            disabled={submitting}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
        </Field>
        <Field label={translate("Kata sandi")} required>
          <PasswordField
            ref={passwordRef}
            value={password}
            onChangeText={(text) => {
              setPassword(text)
              setError(null)
            }}
            maxLength={PASSWORD_MAX}
            disabled={submitting}
            returnKeyType="done"
            onSubmitEditing={() => void handleSubmit()}
          />
        </Field>
        <Text variant="caption" tone="secondary">
          {translate("Setelah masuk, Anda kembali ke layar terakhir — tanpa kehilangan langkah.")}
        </Text>
      </View>
    </BottomSheet>
  )
}
