/**
 * Kahade — WhatsApp OTP Trigger (customer-initiated conversation).
 *
 * Kenapa layar ini ada (non-obvious):
 *   Bot WhatsApp (Fonnte) adalah akun otomatis. Mem-push OTP tanpa diminta
 *   adalah pola yang paling sering dilaporkan user WhatsApp lain dan berujung
 *   pada pembekuan nomor. Maka OTP TIDAK dikirim duluan: user yang mengirim
 *   pesan pemicu (berisi kode referensi) ke bot akan DIBALAS OTP — percakapan
 *   diprakarsai user, tidak ada pesan yang tidak diminta.
 *
 * Alur layar:
 *   1. Register memanggil `requestOtpTrigger()` lalu ke sini; state alur
 *      { phoneNumber, refCode, whatsappUrl, triggerText, expiresAt } hidup
 *      di `lib/otp-flow.ts` (memori modul), BUKAN query param URL — B-07:
 *      nomor HP + refCode pernah bocor ke history browser/log hosting/
 *      Referer saat deeplink dibuka.
 *   2. User tap "Kirim lewat WhatsApp" → deeplink wa.me dengan teks terisi.
 *   3. Layar polling `GET /v1/auth/otp-trigger/status/:refCode` tiap 2.5 dtk.
 *      COMPLETED → verifikasi kode → /verify-otp (kode sudah dikirim bot).
 *   4. Gagal/kadaluarsa (atau user takut salah langkah) → "Kirim langsung"
 *      (jalur lama via /v1/auth/otp-trigger/send) → /verify-otp.
 *
 * Deeplink: `Linking.openURL` bekerja di web (wa.me) dan native (WhatsApp).
 * Bila WhatsApp tidak terpasang, wa.me tetap membuka fallback web chat.
 * B-08: rute ini deep-linkable, jadi `whatsappUrl` WAJIB lolos whitelist
 * `https://wa.me|api.whatsapp.com|chat.whatsapp.com` sebelum dibuka — tanpa
 * itu `/whatsapp-trigger?...` menjadi open-redirect / peluncur skema arbitrary.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { Linking, View } from "react-native"
import { useRouter } from "expo-router"
import { WhatsappLogo } from "phosphor-react-native"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { FooterBar } from "@/components/ui/footer-bar"
import { Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { api, isApiError, userMessage, type OtpMethod } from "@/lib/api"
import { safeWhatsAppLink } from "@/lib/external-url"
import { formatPhoneId } from "@/lib/format"
import { getOtpFlow } from "@/lib/otp-flow"
import { ROUTES } from "@/lib/routes"

/** Interval polling status trigger (ms) — cukup cepat terasa instan, hemat request. */
const POLL_INTERVAL_MS = 2500
/** Batas total polling (ms) — selaras TTL request di backend (5 menit). */
const POLL_TIMEOUT_MS = 5 * 60 * 1000
/** Cooldown tombol kirim langsung (detik) — hindari dobel kirim saat bingung. */
const DIRECT_SEND_COOLDOWN_SECONDS = 60

// D-01 (audit): whitelist deeplink WhatsApp pindah ke validator bersama
// `lib/external-url.ts` (skema https + host resmi WhatsApp) — aturan yang sama
// tidak lagi disalin ulang di sini, dan gate `check-external-urls.mjs`
// memastikan setiap pemanggil `openURL` melewati validator.

export default function WhatsappTriggerScreen() {
  const router = useRouter()
  /** State alur dari Register/verify-otp (memori modul — lihat lib/otp-flow). */
  const flowRef = useRef(getOtpFlow())
  const flow = flowRef.current
  const phoneNumber = flow?.phoneNumber
  const refCode = flow?.refCode

  // Tanpa data trigger di memori (deep-link/reload langsung ke rute ini),
  // kembali ke Register — layar tidak bisa dipakai standalone.
  useEffect(() => {
    if (!phoneNumber || !refCode) {
      if (router.canGoBack()) router.back()
      else router.replace(ROUTES.register)
    }
  }, [phoneNumber, refCode, router])

  const otpMethod: OtpMethod = flow?.method ?? "WHATSAPP"
  const displayPhone = phoneNumber ? formatPhoneId(phoneNumber) : ""
  const waUrl = safeWhatsAppLink(flow?.whatsappUrl)

  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Polling status — satu interval, dibersihkan saat unmount/selesai.
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAt = useRef<number>(Date.now())

  const goVerifyOtp = useCallback(() => {
    setDone(true)
    if (pollTimer.current) {
      clearInterval(pollTimer.current)
      pollTimer.current = null
    }
    router.replace(ROUTES.verifyOtp)
  }, [router])

  useEffect(() => {
    if (!refCode || done) return
    startedAt.current = Date.now()

    const tick = async () => {
      if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
        if (pollTimer.current) clearInterval(pollTimer.current)
        pollTimer.current = null
        return
      }
      try {
        const status = await api.auth.getOtpTriggerStatus(refCode)
        if (status === "COMPLETED") {
          goVerifyOtp()
        } else if (status === "FAILED" || status === "EXPIRED") {
          if (pollTimer.current) clearInterval(pollTimer.current)
          pollTimer.current = null
          setFormError(
            status === "FAILED"
              ? "Pengiriman kode gagal. Coba kirim ulang pesan atau gunakan kirim langsung."
              : "Waktu permintaan habis. Buat permintaan baru atau gunakan kirim langsung.",
          )
        }
      } catch {
        // Jaringan bergetar saat polling: biarkan tick berikutnya mencoba lagi.
      }
    }

    void tick()
    pollTimer.current = setInterval(() => void tick(), POLL_INTERVAL_MS)
    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current)
        pollTimer.current = null
      }
    }
  }, [refCode, done, goVerifyOtp])

  const openWhatsapp = useCallback(() => {
    // B-08: URL yang tidak lolos whitelist TIDAK dibuka apa pun adanya —
    // tampilkan instruksi manual (kode refCode tetap terlihat di layar).
    if (!waUrl) {
      setFormError(
        flow?.triggerText
          ? `Tidak bisa membuka WhatsApp otomatis. Kirim pesan "${flow.triggerText}" ke bot resmi Kahade dari nomor Anda.`
          : "Tidak bisa membuka WhatsApp otomatis. Kirim pesan berisi kode di atas ke bot resmi Kahade dari nomor Anda.",
      )
      return
    }
    void Linking.openURL(waUrl).catch(() => {
      setFormError("Tidak bisa membuka WhatsApp. Kirim pesan berisi kode di atas manual ke nomor bot.")
    })
  }, [waUrl, flow])

  const handleDirectSend = useCallback(async () => {
    if (sending) return
    setSending(true)
    setFormError(null)
    try {
      // Fallback: jalur kirim langsung (meta refCode hanya untuk audit).
      await api.auth.sendOtpDirect({
        phoneNumber: phoneNumber!,
        method: otpMethod,
        refCode: refCode!,
      })
      goVerifyOtp()
    } catch (err) {
      setFormError(isApiError(err) ? userMessage(err) : "Gagal mengirim kode. Coba lagi sebentar.")
    } finally {
      setSending(false)
    }
  }, [sending, phoneNumber, refCode, otpMethod, goVerifyOtp])

  // Jangan render tanpa alur aktif (effect akan redirect).
  if (!phoneNumber || !refCode) return null

  return (
    <Screen padded={false} edges={["top"]}>
      <Header title="Verifikasi WhatsApp" safeArea={false} />

      <KeyboardAvoiding>
        <View className="flex-1 gap-8 px-5 pb-8 pt-8">
          <View className="gap-3">
            <Heading level={1} className="text-balance">
              Konfirmasi lewat WhatsApp
            </Heading>
            <Text variant="body" tone="secondary" className="text-pretty">
              Untuk keamanan, kode dikirim sebagai balasan chat kamu sendiri —
              bukan pesan mendadak dari kami. Nomor:{" "}
              <Text variant="monoBody" weight={600}>
                {displayPhone}
              </Text>
            </Text>
          </View>

          {/* Langkah 1 — kirim pesan pemicu (deeplink sudah berisi teks) */}
          <View className="gap-3">
            <Button onPress={openWhatsapp} leftIcon={WhatsappLogo}>
              Kirim lewat WhatsApp
            </Button>
            <Text variant="caption" tone="secondary" className="text-center text-pretty">
              WhatsApp akan terbuka dengan pesan berisi kode{" "}
              <Text variant="monoBody" weight={600}>
                {refCode}
              </Text>{" "}
              — tinggal tekan kirim.
            </Text>
          </View>

          {/* Langkah 2 — status menunggu balasan */}
          <View className="gap-2 rounded-md border border-border bg-surface-elevated px-4 py-3">
            <Text variant="body" weight={500}>
              Menunggu balasan kode…
            </Text>
            <Text variant="caption" tone="secondary" className="text-pretty">
              Layar ini otomatis lanjut begitu bot membalas kode verifikasi.
            </Text>
          </View>

          {formError ? (
            <Alert tone="danger" title="Belum berhasil" onDismiss={() => setFormError(null)}>
              {formError}
            </Alert>
          ) : null}

          <View className="flex-1" />

          <Text variant="caption" tone="secondary" className="text-center text-pretty">
            Tidak muncul balasan? Periksa apakah kamu mengirim dari nomor{" "}
            <Text variant="monoBody" weight={600}>
              {displayPhone}
            </Text>
            .
          </Text>
        </View>

        <FooterBar>
          <View className="gap-3">
            <Button variant="secondary" onPress={() => void handleDirectSend()} loading={sending}>
              Kirim langsung tanpa chat
            </Button>
            <Text variant="caption" tone="secondary" className="text-center">
              Kirim ulang tersedia setelah {DIRECT_SEND_COOLDOWN_SECONDS} detik di layar berikutnya
            </Text>
            <TextLink
              onPress={() => {
                if (router.canGoBack()) router.back()
                else router.replace(ROUTES.register)
              }}
            >
              Kembali
            </TextLink>
          </View>
        </FooterBar>
      </KeyboardAvoiding>
    </Screen>
  )
}
