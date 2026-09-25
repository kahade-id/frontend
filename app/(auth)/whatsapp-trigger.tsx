/**
 * Kahade — WhatsApp OTP Trigger (customer-initiated conversation).
 *
 * Kenapa layar ini ada (non-obvious):
 *   Bot WhatsApp adalah akun otomatis. Mem-push OTP tanpa diminta adalah pola
 *   yang paling sering dilaporkan user WhatsApp lain dan berujung pada
 *   pembekuan nomor. Maka OTP TIDAK dikirim duluan: user yang mengirim pesan
 *   pemicu (berisi kode referensi 12 hex) ke bot akan DIBALAS OTP —
 *   percakapan diprakarsai user, tidak ada pesan yang tidak diminta.
 *
 * Alur layar:
 *   1. Layar asal memanggil `requestOtpTrigger()` lalu ke sini; state alur
 *      { phoneNumber, purpose, refCode, whatsappUrl, triggerText, expiresAt }
 *      hidup di `lib/otp-flow.ts` (memori modul), BUKAN query param URL —
 *      B-07: nomor HP + refCode pernah bocor ke history browser/log hosting/
 *      Referer saat deeplink dibuka.
 *   2. User WAJIB mengirim pesan dulu ke nomor resmi Kahade +6285786035715
 *      (tombol "Kirim lewat WhatsApp" membuka chat dengan teks terisi —
 *      tinggal tekan kirim; atau kirim manual berisi kode referensi).
 *   3. Layar polling `GET /v1/auth/otp-trigger/status/:refCode` tiap 2.5 dtk.
 *      COMPLETED → /verify-otp (kode sudah dibalas bot).
 *   4. FAILED/EXPIRED → Alert + tombol "Minta kode baru" (trigger baru via
 *      requestOtpTrigger — TIDAK ADA jalur kirim langsung; dihapus di
 *      auth-rework 2026-09-26).
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
import { api, isApiError, userMessage } from "@/lib/api"
import { safeWhatsAppLink } from "@/lib/external-url"
import { formatPhoneId } from "@/lib/format"
import { getAuthLocation } from "@/lib/location"
import { getOtpFlow, patchOtpFlow } from "@/lib/otp-flow"
import { ROUTES } from "@/lib/routes"

// D-01 (audit): whitelist deeplink WhatsApp pindah ke validator bersama
// `lib/external-url.ts` (skema https + host resmi WhatsApp) — aturan yang sama
// tidak lagi disalin ulang di sini, dan gate `check-external-urls.mjs`
// memastikan setiap pemanggil `openURL` melewati validator.

/** Nomor WhatsApp resmi Kahade — satu-satunya nomor bot yang sah. */
export const KAHADE_WHATSAPP_NUMBER = "+6285786035715"

/** Interval polling status trigger (ms) — cukup cepat terasa instan, hemat request. */
const POLL_INTERVAL_MS = 2500

export default function WhatsappTriggerScreen() {
  const router = useRouter()
  /** State alur dari layar asal (memori modul — lihat lib/otp-flow). */
  const flowRef = useRef(getOtpFlow())
  const flow = flowRef.current
  const phoneNumber = flow?.phoneNumber
  const purpose = flow?.purpose
  // Kode referensi AKTIF — berubah setiap kali trigger baru diminta; polling
  // mengikuti state ini, bukan refCode awal.
  const [refCode, setRefCode] = useState(flow?.refCode)

  // Tanpa data trigger di memori (deep-link/reload langsung ke rute ini),
  // kembali ke awal alur — layar tidak bisa dipakai standalone.
  useEffect(() => {
    if (!phoneNumber || !purpose || !refCode) {
      if (router.canGoBack()) router.back()
      else router.replace(ROUTES.register)
    }
  }, [phoneNumber, purpose, refCode, router])

  const displayPhone = phoneNumber ? formatPhoneId(phoneNumber) : ""
  // Dibaca dari flowRef.current (bukan `flow` awal) supaya deeplink ikut
  // berganti setiap kali trigger baru diminta.
  const waUrl = safeWhatsAppLink(flowRef.current?.whatsappUrl)

  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [requesting, setRequesting] = useState(false)

  // Polling status — satu interval, dibersihkan saat unmount/selesai.
  // Batas total mengikuti expiresInSeconds dari trigger (default 10 menit).
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

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current)
      pollTimer.current = null
    }
  }, [])

  useEffect(() => {
    if (!refCode || done) return
    startedAt.current = Date.now()

    const tick = async () => {
      try {
        const { status } = await api.auth.getOtpTriggerStatus(refCode)
        if (status === "COMPLETED") {
          goVerifyOtp()
        } else if (status === "FAILED" || status === "EXPIRED") {
          stopPolling()
          setFormError(
            status === "FAILED"
              ? "Pengiriman kode gagal. Minta kode baru di bawah, lalu kirim pesan lagi ke WhatsApp resmi Kahade."
              : "Waktu permintaan habis. Minta kode baru di bawah, lalu kirim pesan lagi ke WhatsApp resmi Kahade.",
          )
        }
        // WAITING → tick berikutnya.
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
  }, [refCode, done, goVerifyOtp, stopPolling])

  const openWhatsapp = useCallback(() => {
    // B-08: URL yang tidak lolos whitelist TIDAK dibuka apa pun adanya —
    // tampilkan instruksi manual (kode refCode tetap terlihat di layar).
    if (!waUrl) {
      setFormError(
        flow?.triggerText
          ? `Tidak bisa membuka WhatsApp otomatis. Kirim pesan "${flow.triggerText}" ke ${KAHADE_WHATSAPP_NUMBER} dari nomor Anda.`
          : `Tidak bisa membuka WhatsApp otomatis. Kirim pesan berisi kode di atas ke ${KAHADE_WHATSAPP_NUMBER} dari nomor Anda.`,
      )
      return
    }
    void Linking.openURL(waUrl).catch(() => {
      setFormError(
        `Tidak bisa membuka WhatsApp. Kirim pesan berisi kode di atas manual ke ${KAHADE_WHATSAPP_NUMBER}.`,
      )
    })
  }, [waUrl, flow])

  /**
   * Minta trigger baru (kode referensi baru) — satu-satunya jalan kirim
   * ulang. Tidak ada jalur kirim-langsung: OTP hanya dibalas setelah user
   * mengirim pesan pemicu (keputusan produk, anti-bekukan nomor bot).
   */
  const handleRequestNew = useCallback(async () => {
    if (requesting || !phoneNumber || !purpose) return
    setRequesting(true)
    setFormError(null)
    try {
      const trigger = await api.auth.requestOtpTrigger({
        phoneNumber,
        purpose,
        migrationToken: flow?.migrationToken,
        location: (await getAuthLocation()) ?? undefined,
      })
      patchOtpFlow({
        refCode: trigger.refCode,
        whatsappUrl: trigger.whatsappUrl,
        triggerText: trigger.triggerText,
        expiresAt: trigger.expiresAt,
      })
      flowRef.current = getOtpFlow()
      // Ganti refCode aktif → effect polling restart dengan kode baru.
      setRefCode(trigger.refCode)
      setDone(false)
      startedAt.current = Date.now()
    } catch (err) {
      setFormError(
        isApiError(err) ? userMessage(err) : "Gagal meminta kode baru. Coba lagi sebentar.",
      )
    } finally {
      setRequesting(false)
    }
  }, [requesting, phoneNumber, purpose, flow])

  // Jangan render tanpa alur aktif (effect akan redirect).
  if (!phoneNumber || !purpose || !refCode) return null

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
              bukan pesan mendadak dari kami. Anda HARUS mengirim pesan dulu ke
              WhatsApp resmi Kahade{" "}
              <Text variant="monoBody" weight={600}>
                {KAHADE_WHATSAPP_NUMBER}
              </Text>{" "}
              dari nomor:{" "}
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

          {/* Kode referensi — selalu terlihat untuk pengiriman manual */}
          <View className="gap-2 rounded-md border border-border bg-surface-elevated px-4 py-3">
            <Text variant="caption" tone="secondary">
              Kode referensi Anda
            </Text>
            <Text variant="monoBody" weight={700} className="text-lg tracking-widest">
              {refCode}
            </Text>
            <Text variant="caption" tone="secondary" className="text-pretty">
              Tidak bisa membuka WhatsApp otomatis? Kirim pesan berisi kode di
              atas secara manual ke {KAHADE_WHATSAPP_NUMBER}.
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
            <Button variant="secondary" onPress={() => void handleRequestNew()} loading={requesting}>
              Minta kode baru
            </Button>
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
