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
 *   3. Layar polling `GET /v1/auth/otp-trigger/status/:refCode` dengan
 *      exponential backoff (2.5 → 5 → 10 → 15 dtk maks).
 *      COMPLETED → /verify-otp (kode sudah dibalas bot).
 *   4. FAILED/EXPIRED → Alert + tombol "Minta kode baru" (trigger baru via
 *      requestOtpTrigger — TIDAK ADA jalur kirim langsung; dihapus di
 *      auth-rework 2026-09-26). Alert juga membawa tautan lintas-alur
 *      ("Sudah punya akun? Masuk" / "Belum punya akun? Daftar") — jalan
 *      keluar untuk nomor yang salah alur (mis. nomor terdaftar mencoba
 *      daftar ulang mendapat decoy yang selalu EXPIRED).
 *
 * Deeplink: `Linking.openURL` bekerja di web (wa.me) dan native (WhatsApp).
 * Bila WhatsApp tidak terpasang, wa.me tetap membuka fallback web chat.
 * B-08: rute ini deep-linkable, jadi `whatsappUrl` WAJIB lolos whitelist
 * `https://wa.me|api.whatsapp.com|chat.whatsapp.com` sebelum dibuka — tanpa
 * itu `/whatsapp-trigger?...` menjadi open-redirect / peluncur skema arbitrary.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { AppState, Linking, View } from "react-native"
import { useRouter } from "expo-router"
import { ArrowsClockwise, WarningCircle, WhatsappLogo, WifiSlash } from "phosphor-react-native"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Countdown } from "@/components/ui/countdown"
import { FooterBar } from "@/components/ui/footer-bar"
import { Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { Icon } from "@/components/ui/icon"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { useToast } from "@/components/ui/toast"
import { api, isApiError, userMessage } from "@/lib/api"
import { otpStepProgress } from "@/lib/auth-progress"
import { copyToClipboard } from "@/lib/clipboard"
import { isOfflineKnown, useIsOnline } from "@/lib/connectivity"
import { safeWhatsAppLink } from "@/lib/external-url"
import { formatPhoneId } from "@/lib/format"
import { getAuthLocation } from "@/lib/location"
import { getOtpFlow, patchOtpFlow, setOtpFlow } from "@/lib/otp-flow"
import { AuthFlowLoading, AuthFlowMissing } from "@/lib/auth-flow-gate"
import { useOtpFlow } from "@/lib/use-otp-flow"
import { ROUTES } from "@/lib/routes"

// D-01 (audit): whitelist deeplink WhatsApp pindah ke validator bersama
// `lib/external-url.ts` (skema https + host resmi WhatsApp) — aturan yang sama
// tidak lagi disalin ulang di sini, dan gate `check-external-urls.mjs`
// memastikan setiap pemanggil `openURL` melewati validator.

/** Nomor WhatsApp resmi Kahade — satu-satunya nomor bot yang sah. */
export const KAHADE_WHATSAPP_NUMBER = "+6285786035715"

/**
 * S-6 (audit 2026-09-26): polling memakai exponential backoff agar tidak
 * menghantam server ~240 request selama 10 menit. Tanpa mengubah UX:
 * respons pertama tetap secepat sebelumnya (2.5 dtk), lalu jeda memanjang
 * 2.5 → 5 → 10 → 15 dtk (maks). Status terminal tetap ditentukan server
 * (COMPLETED/FAILED/EXPIRED), bukan oleh client.
 */
const POLL_BASE_DELAY_MS = 2500
const POLL_MAX_DELAY_MS = 15000

function nextPollDelayMs(attempt: number): number {
  return Math.min(POLL_MAX_DELAY_MS, POLL_BASE_DELAY_MS * 2 ** attempt)
}

/**
 * Apakah app sedang terlihat pengguna?
 *
 * Audit 2026-10-01 (blank + back mati): SELURUH keputusan yang menyentuh
 * navigasi (polling, navigasi ke /verify-otp) dijeda saat app tidak terlihat.
 * Dipakai predikat "kecuali background/inactive" — bukan `=== "active"` —
 * supaya status `unknown` (Android saat transisi/startup) tidak membuat
 * polling atau navigasi menggantung tanpa jalan keluar.
 */
function isAppVisible(): boolean {
  const state = AppState.currentState
  return state !== "background" && state !== "inactive"
}

export default function WhatsappTriggerScreen() {
  const router = useRouter()
  const toast = useToast()
  /**
   * State alur dari layar asal — DIBACA REAKTIF (lib/use-otp-flow), bukan
   * sekali saat mount. Audit 2026-10-01: `useRef(getOtpFlow())` + `return
   * null` membuat layar mengunci dirinya kosong bila alur belum tersedia
   * saat mount (hidrasi SecureStore yang belum selesai / JS context baru
   * setelah proses dimatikan OS di WhatsApp) — termasuk saat alur baru
   * datang SESUDAH mount, yang tidak pernah lagi terbaca.
   */
  const { flow, status: flowStatus } = useOtpFlow()
  const phoneNumber = flow?.phoneNumber
  const purpose = flow?.purpose
  // Kode referensi AKTIF — berubah setiap kali trigger baru diminta; polling
  // mengikuti state ini, bukan refCode awal.
  const [refCode, setRefCode] = useState(flow?.refCode)

  // Alur yang baru terpulihkan SETELAH layar mount (race hidrasi) membawa
  // refCode-nya sendiri — selaraskan selama pengguna belum memilih kode lain.
  useEffect(() => {
    if (refCode) return
    if (flow?.refCode) setRefCode(flow.refCode)
  }, [flow?.refCode, refCode])

  const displayPhone = phoneNumber ? formatPhoneId(phoneNumber) : ""
  // Dibaca dari `flow` (reaktif) supaya deeplink & kedaluwarsa ikut berganti
  // setiap kali trigger baru diminta atau alur baru terpulihkan.
  const waUrl = safeWhatsAppLink(flow?.whatsappUrl)

  const [formError, setFormError] = useState<string | null>(null)
  /**
   * Jalan keluar saat trigger gagal/kedaluwarsa — tanpa ini user yang nomornya
   * sudah terdaftar (purpose=register) terjebak loop "minta kode baru" tanpa
   * akhir: backend sengaja mengembalikan payload decoy 200 (anti-enumerasi)
   * yang tidak pernah selesai, jadi satu-satunya jalan benar adalah Masuk.
   * Tautan ini tampil untuk SEMUA kegagalan/kedaluwarsa apa pun penyebabnya,
   * sehingga tidak menjadi sinyal pembeda nomor terdaftar vs tidak.
   */
  const [altAuth, setAltAuth] = useState<"login" | "register" | null>(null)
  const [done, setDone] = useState(false)
  const [requesting, setRequesting] = useState(false)
  /**
   * U5-002 (journey): jaring pengaman "kembali dengan tangan kosong".
   * `settledRef` = alur sudah selesai/gagal (poll tak perlu lagi);
   * `returnedEmpty` = user kembali foreground saat masih menunggu →
   * tampilkan hint inline + picu satu poll segera. Alur tetap
   * customer-initiated — hanya panduannya yang diperkuat.
   */
  const [returnedEmpty, setReturnedEmpty] = useState(false)
  const settledRef = useRef(false)
  /**
   * Alur selesai (COMPLETED) → minta navigasi ke /verify-otp lewat state.
   * `navTick` dipakai untuk mencoba ulang navigasi setiap app kembali aktif;
   * `navDispatchedRef` menjamin `router.replace` hanya sekali (idempoten).
   */
  const [verifyReady, setVerifyReady] = useState(false)
  const [navTick, setNavTick] = useState(0)
  const navDispatchedRef = useRef(false)

  // A07 (batch 139): bedakan status koneksi polling — offline (jeda),
  // menunggu balasan (normal), mencoba ulang (gagal jaringan beruntun).
  const isOnline = useIsOnline()
  const [netFailures, setNetFailures] = useState(0)
  const connStatus = !isOnline ? "offline" : netFailures > 0 ? "retrying" : "waiting"

  // Polling status — rantai setTimeout dengan backoff, dibersihkan saat
  // unmount/selesai. Batas total mengikuti expiresInSeconds dari trigger
  // (default 10 menit); server yang menandai EXPIRED.
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startedAt = useRef<number>(Date.now())

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current)
      pollTimer.current = null
    }
  }, [])

  const goVerifyOtp = useCallback(() => {
    if (settledRef.current) return
    settledRef.current = true
    stopPolling()
    setDone(true)
    // JANGAN navigasi di sini. Terdeteksi COMPLETED bisa terjadi di dalam
    // callback AppState (user baru kembali dari WhatsApp) — `router.replace`
    // pada jendela resume itu berisiko membuat layar tujuan tidak pernah
    // ter-render (blank + tombol back perangkat mati). Effect di bawah yang
    // menjalankan navigasi, setelah commit render DAN app benar-benar active.
    setVerifyReady(true)
  }, [stopPolling])

  /**
   * Jaring pengaman terakhir sebelum pindah layar: pastikan alur ada di
   * memori. Bila state modul entah bagaimana kosong padahal layar ini masih
   * memegang phoneNumber/purpose/refCode (mis. alur dibersihkan layar lain),
   * susun ulang dari nilai yang SUDAH ada di memori layar — bukan query
   * parameter URL, jadi nomor HP tetap tidak pernah masuk URL/history.
   */
  const ensureOtpFlowForVerify = useCallback(() => {
    if (getOtpFlow()) return
    if (!phoneNumber || !purpose || !refCode) return
    setOtpFlow({
      phoneNumber,
      purpose,
      refCode,
      migrationToken: flow?.migrationToken,
      whatsappUrl: flow?.whatsappUrl,
      triggerText: flow?.triggerText,
      expiresAt: flow?.expiresAt,
    })
  }, [phoneNumber, purpose, refCode, flow?.migrationToken, flow?.whatsappUrl, flow?.triggerText, flow?.expiresAt])

  /**
   * Navigasi ke /verify-otp — satu-satunya tempat `router.replace` dipanggil
   * untuk keberangkatan ini, dan hanya dari effect React (bukan callback
   * AppState/timer jaringan). `requestAnimationFrame` + gate `active`
   * memastikan app sudah selesai resume; rAF tidak berjalan saat app di
   * background, jadi navigasi otomatis menunggu sampai terlihat lagi.
   */
  useEffect(() => {
    if (!verifyReady || navDispatchedRef.current) return
    if (!isAppVisible()) return
    let cancelled = false
    const frame = requestAnimationFrame(() => {
      if (cancelled || navDispatchedRef.current) return
      navDispatchedRef.current = true
      ensureOtpFlowForVerify()
      router.replace(ROUTES.verifyOtp)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [verifyReady, navTick, ensureOtpFlowForVerify, router])

  /**
   * Penanganan status terminal (dipakai polling otomatis DAN poll manual
   * "Saya sudah kirim pesan" — FE-IMP-3 #107). Generic untuk semua penyebab,
   * bukan sinyal enumerasi (lihat state altAuth).
   */
  const handleTerminalStatus = useCallback(
    (status: "FAILED" | "EXPIRED") => {
      stopPolling()
      settledRef.current = true
      setReturnedEmpty(false)
      setAltAuth(
        purpose === "register" ? "login" : purpose === "login" ? "register" : null,
      )
      setFormError(
        status === "FAILED"
          ? "Pengiriman kode gagal. Minta kode baru di bawah, lalu kirim pesan lagi ke WhatsApp resmi Kahade."
          : "Waktu permintaan habis. Minta kode baru di bawah, lalu kirim pesan lagi ke WhatsApp resmi Kahade.",
      )
    },
    [purpose, stopPolling],
  )

  useEffect(() => {
    if (!refCode || done) return
    startedAt.current = Date.now()
    let attempt = 0
    let cancelled = false

    const scheduleNext = () => {
      pollTimer.current = setTimeout(() => void tick(), nextPollDelayMs(attempt))
    }

    const tick = async () => {
      // A07: perangkat JELAS offline → jangan hantam jaringan; jadwalkan
      // ulang saja. Polling lanjut otomatis saat koneksi kembali.
      if (isOfflineKnown()) {
        if (!cancelled) {
          attempt += 1
          scheduleNext()
        }
        return
      }
      // PERF-FIX (network P1): jeda saat app TIDAK aktif (background ATAU
      // inactive) — hasil poll tak bisa ditindaklanjuti sampai user kembali,
      // dan `router.replace` di jendela resume bermasalah (lihat goVerifyOtp).
      // Listener AppState di bawah sudah memicu SATU poll segera saat kembali
      // foreground, jadi tick di sini cukup dijadwalkan ulang tanpa menembak
      // jaringan. `inactive` ikut dijeda: di Android transisi background sering
      // melewati status ini sebelum app benar-benar tidak terlihat.
      if (!isAppVisible()) {
        if (!cancelled) {
          attempt += 1
          scheduleNext()
        }
        return
      }
      try {
        const { status } = await api.auth.getOtpTriggerStatus(refCode)
        if (cancelled) return
        setNetFailures(0)
        if (status === "COMPLETED") {
          goVerifyOtp()
        } else if (status === "FAILED" || status === "EXPIRED") {
          handleTerminalStatus(status)
        } else {
          // WAITING → tick berikutnya dengan jeda backoff yang lebih panjang.
          attempt += 1
          scheduleNext()
        }
      } catch {
        // Jaringan bergetar saat polling: coba lagi dengan backoff, jangan
        // reset jeda — kegagalan jaringan bukan sinyal balasan sudah dekat.
        // A07: hitung kegagalan beruntun untuk status "mencoba ulang".
        if (!cancelled) {
          setNetFailures((f) => f + 1)
          attempt += 1
          scheduleNext()
        }
      }
    }

    void tick()
    return () => {
      cancelled = true
      stopPolling()
    }
  }, [refCode, done, goVerifyOtp, stopPolling, handleTerminalStatus])

  // FE-IMP-3 #107 — "Saya sudah kirim pesan": SATU poll segera (tanpa
  // menunggu giliran backoff) + petunjuk salin kode bila balasan belum ada.
  // Polling otomatis tetap berjalan; ini hanya pengecekan ekstra.
  const [checkingNow, setCheckingNow] = useState(false)
  /**
   * PERF-FIX (network P2): debounce 2,5 dtk untuk cek manual. `checkingNow`
   * hanya menjaga konkurensi — tombol masih bisa di-mash tepat setelah check
   * selesai, menambah poll ekstra tak terjadwal di atas chain yang berjalan.
   */
  const lastManualCheckAt = useRef(0)
  const handleSentMessage = useCallback(async () => {
    if (checkingNow || !refCode || done) return
    const nowMs = Date.now()
    if (nowMs - lastManualCheckAt.current < 2500) return
    lastManualCheckAt.current = nowMs
    // A07: cek manual butuh koneksi — jangan diam saat offline.
    if (isOfflineKnown()) {
      toast.show({
        title: "Anda sedang offline",
        description: "Pengecekan manual butuh koneksi internet. Polling otomatis lanjut saat online.",
        tone: "warning",
        duration: 4000,
      })
      return
    }
    setCheckingNow(true)
    try {
      const { status } = await api.auth.getOtpTriggerStatus(refCode)
      if (status === "COMPLETED") {
        goVerifyOtp()
      } else if (status === "FAILED" || status === "EXPIRED") {
        handleTerminalStatus(status)
      } else {
        // WAITING → balasan belum terdeteksi: beri petunjuk, jangan error.
        toast.show({
          title: "Belum ada balasan terdeteksi",
          description:
            "Pastikan pesan berisi kode referensi sudah terkirim dari nomor Anda. Bila mengirim manual, salin kode di atas.",
          tone: "info",
          duration: 5000,
        })
      }
    } catch {
      // Jaringan bergetar: diam — polling otomatis tetap berjalan.
    } finally {
      setCheckingNow(false)
    }
  }, [checkingNow, refCode, done, goVerifyOtp, handleTerminalStatus, toast.show])

  /**
   * U5-002 (journey): saat app kembali foreground (mis. dari WhatsApp) dan
   * alur belum selesai → tampilkan hint inline "kembali tanpa balasan" +
   * picu SATU poll segera (pakai ulang handleSentMessage — poll manual yang
   * sama, tanpa menunggu giliran backoff). Alur tidak diubah.
   * `prevRef` memastikan hanya TRANSISI background/inactive → active yang
   * bereaksi (bukan pemanggilan awal saat mount di state active).
   */
  const appPrevRef = useRef<string>("active")
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      const wasBackground = appPrevRef.current === "background" || appPrevRef.current === "inactive"
      appPrevRef.current = state
      if (state !== "active" || !wasBackground) return
      if (settledRef.current) {
        // Balasan sudah terdeteksi (COMPLETED) — mungkin tepat saat app di
        // background. JANGAN navigasi dari callback ini: naikkan tick supaya
        // effect navigasi yang berjalan setelah commit render + app benar
        // benar aktif yang mengeksekusi `router.replace`.
        setNavTick((tick) => tick + 1)
        return
      }
      setReturnedEmpty(true)
      void handleSentMessage()
    })
    return () => sub.remove()
  }, [handleSentMessage])

  // FE-IMP-3 #107 — salin kode referensi untuk pengiriman manual.
  const handleCopyCode = useCallback(async () => {
    if (!refCode) return
    const ok = await copyToClipboard(refCode)
    toast.show(
      ok
        ? { title: "Kode referensi disalin", tone: "success", duration: 2500 }
        : { title: "Gagal menyalin kode", description: "Salin manual dari layar ini.", tone: "danger" },
    )
  }, [refCode, toast.show])

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
    setAltAuth(null)
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
      // Ganti refCode aktif → effect polling restart dengan kode baru.
      setRefCode(trigger.refCode)
      setDone(false)
      settledRef.current = false
      // Trigger baru membatalkan keberangkatan yang mungkin masih tertunda
      // (mis. COMPLETED gagal dinavigasikan saat app tidak aktif).
      navDispatchedRef.current = false
      setVerifyReady(false)
      setReturnedEmpty(false)
      startedAt.current = Date.now()
    } catch (err) {
      setFormError(
        isApiError(err) ? userMessage(err) : "Gagal meminta kode baru. Coba lagi sebentar.",
      )
    } finally {
      setRequesting(false)
    }
  }, [requesting, phoneNumber, purpose, flow])

  /**
   * Jalan keluar saat alur tidak ditemukan (deep-link/reload langsung ke
   * rute ini). Audit 2026-10-01: sebelumnya `return null` — layar kosong
   * tanpa penjelasan, dan `router.back()` di effect bisa no-op sehingga
   * tombol back perangkat terasa mati. Kini selalu ada UI + tombol.
   */
  const leaveMissingFlow = () => {
    if (router.canGoBack()) {
      router.back()
      return
    }
    router.replace(ROUTES.login)
  }

  // Jangan render tanpa alur aktif — tetapi JANGAN blank: pemulihan sedang
  // berjalan → loading; benar-benar tidak ada → pesan + tombol kembali.
  if (flowStatus === "loading") {
    return <AuthFlowLoading label="Memulihkan data kode referensi…" />
  }
  if (!phoneNumber || !purpose || !refCode) {
    return (
      <AuthFlowMissing
        title="Data kode referensi tidak ditemukan"
        description="Sesi pengiriman pesan WhatsApp tidak tersedia — kemungkinan aplikasi ditutup di tengah alur atau halaman ini dibuka langsung. Kembali dan mulai dari layar masuk/daftar untuk meminta kode baru."
        backLabel="Kembali"
        onBack={leaveMissingFlow}
      />
    )
  }

  return (
    <Screen padded={false} edges={["top"]}>
      {/*
       * T1-002: progress per purpose — register 2/4, forgot_password 2/3,
       * login/migrasi disembunyikan (bukan bagian wizard pendaftaran).
       * FE-040: layar ini = langkah "kirim pesan WA" (2/4); layar OTP = 3/4.
       */}
      <Header
        title="Verifikasi WhatsApp"
        safeArea={false}
        progress={purpose ? otpStepProgress(purpose, "trigger") : undefined}
      />

      <KeyboardAvoiding>
        <View className="flex-1 gap-8 px-5 pb-8 pt-8">
          <View className="gap-3">
            <Heading level={1} className="text-balance">
              Konfirmasi lewat WhatsApp
            </Heading>
            <Text variant="body" tone="secondary" className="text-pretty">
              {/* UI-A005: copy formal "Anda" (§12) — konsisten dengan layar auth lain. */}
              Untuk keamanan, kode dikirim sebagai balasan chat Anda sendiri —
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
              — tinggal ketuk kirim.
            </Text>
          </View>

          {/* Kode referensi — selalu terlihat untuk pengiriman manual */}
          <Card variant="elevated" padded={false} className="gap-2 px-4 py-3">
            <View className="flex-row items-center justify-between">
              <Text variant="caption" tone="secondary">
                Kode referensi Anda
              </Text>
              {/* FE-IMP-3 #107 — salin kode untuk pengiriman manual. */}
              <TextLink onPress={() => void handleCopyCode()}>
                Salin kode
              </TextLink>
            </View>
            <Text variant="monoBody" weight={600} className="tracking-widest">
              {refCode}
            </Text>
            {/*
             * U5-001 (journey): tegaskan DUA kode berbeda — kode referensi di
             * layar ini (kode pengiriman pesan) BUKAN kode verifikasi 6 digit
             * yang diminta layar berikutnya. Satu baris pencegah salah salin.
             */}
            <Text variant="caption" tone="secondary" className="text-pretty">
              Ini kode pengiriman pesan — kode verifikasi 6 digit dikirim bot
              sebagai balasan.
            </Text>
            {/*
             * FE-IMP-3 #106 — countdown kedaluwarsa kode referensi (timestamp
             * absolut dari server; tetap benar walau app ke background).
             */}
            {flow?.expiresAt ? (
              <Countdown
                key={refCode}
                until={new Date(flow.expiresAt).getTime()}
                prefix="Kode kedaluwarsa dalam"
                tone="secondary"
              />
            ) : null}
            <Text variant="caption" tone="secondary" className="text-pretty">
              Tidak bisa membuka WhatsApp otomatis? Kirim pesan berisi kode di
              atas secara manual ke {KAHADE_WHATSAPP_NUMBER}.
            </Text>
          </Card>

          {/* Langkah 2 — status menunggu balasan (A07: dibedakan per koneksi) */}
          <Card variant="elevated" padded={false} className="gap-2 px-4 py-3">
            {connStatus === "offline" ? (
              <View className="flex-row items-start gap-2">
                <Icon icon={WifiSlash} size="sm" tone="warning" />
                <View className="flex-1 gap-1">
                  <Text variant="body" weight={500}>
                    Anda sedang offline
                  </Text>
                  <Text variant="caption" tone="secondary" className="text-pretty">
                    Polling dijeda dan lanjut otomatis saat koneksi kembali.
                    Kode referensi di atas tetap berlaku.
                  </Text>
                </View>
              </View>
            ) : connStatus === "retrying" ? (
              <View className="flex-row items-start gap-2">
                <Icon icon={ArrowsClockwise} size="sm" tone="warning" />
                <View className="flex-1 gap-1">
                  <Text variant="body" weight={500}>
                    Koneksi bermasalah — mencoba lagi…
                  </Text>
                  <Text variant="caption" tone="secondary" className="text-pretty">
                    Percobaan ulang ke-{netFailures + 1}. Pastikan koneksi
                    internet stabil.
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <Text variant="body" weight={500}>
                  Menunggu balasan kode…
                </Text>
                <Text variant="caption" tone="secondary" className="text-pretty">
                  Layar ini otomatis lanjut begitu bot membalas kode verifikasi.
                </Text>
                {/*
                 * U5-002 (journey): hint "kembali dengan tangan kosong" —
                 * muncul saat user kembali ke app ini tanpa balasan terdeteksi.
                 */}
                {returnedEmpty ? (
                  <View className="flex-row items-start gap-2 rounded-md bg-warning-soft px-3 py-2">
                    <Icon icon={WarningCircle} size="sm" tone="warning" />
                    <Text variant="caption" tone="secondary" className="flex-1 text-pretty">
                      Kembali tanpa balasan? Pastikan pesan berisi kode terkirim
                      dari nomor{" "}
                      <Text variant="monoBody" weight={600}>
                        {displayPhone}
                      </Text>
                      .
                    </Text>
                  </View>
                ) : null}
              </>
            )}
            {/*
             * FE-IMP-3 #107 — "Saya sudah kirim pesan": satu poll segera
             * (tanpa menunggu giliran backoff). Polling otomatis tetap jalan.
             */}
            <View className="pt-1">
              <Button
                variant="secondary"
                size="sm"
                loading={checkingNow}
                onPress={() => void handleSentMessage()}
              >
                Saya sudah kirim pesan
              </Button>
            </View>
          </Card>

          {formError ? (
            <Alert
              tone="danger"
              title="Belum berhasil"
              onDismiss={() => {
                setFormError(null)
                setAltAuth(null)
              }}
              action={
                altAuth ? (
                  <TextLink
                    onPress={() => {
                      stopPolling()
                      router.replace(altAuth === "login" ? ROUTES.login : ROUTES.register)
                    }}
                  >
                    {altAuth === "login" ? "Sudah punya akun? Masuk" : "Belum punya akun? Daftar"}
                  </TextLink>
                ) : undefined
              }
            >
              {formError}
            </Alert>
          ) : null}

          <View className="flex-1" />

          <Text variant="caption" tone="secondary" className="text-center text-pretty">
            Tidak muncul balasan? Periksa apakah Anda mengirim dari nomor{" "}
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
            {/*
             * T1-001: petunjuk lintas-alur GENERIK sejak awal (tampil untuk
             * semua purpose — bukan sinyal pembeda nomor terdaftar vs tidak,
             * jadi aman terhadap enumerasi). Menyelamatkan user yang salah
             * alur (mis. nomor terdaftar masuk alur Daftar) sebelum menunggu
             * decoy kedaluwarsa.
             */}
            <Text variant="caption" tone="secondary" className="text-center text-pretty">
              Sudah pernah daftar tapi tidak ada balasan? Coba{" "}
              <TextLink
                inline
                onPress={() => {
                  stopPolling()
                  router.replace(ROUTES.login)
                }}
              >
                Masuk
              </TextLink>{" "}
              di sini.
            </Text>
            {/*
             * T1-010: alur lupa kata sandi + nomor salah ketik/tidak aktif =
             * decoy yang tidak pernah selesai. Saat gagal, tawarkan jalan ke
             * live support (pola yang sama dengan layar forgot-password).
             * Generik untuk semua kegagalan purpose ini — tidak enumerating.
             */}
            {purpose === "forgot_password" && formError ? (
              <Text variant="caption" tone="secondary" className="text-center text-pretty">
                Nomor HP tidak aktif atau salah ketik?{" "}
                <TextLink inline onPress={() => router.push(ROUTES.liveSupport)}>
                  Minta bantuan
                </TextLink>
              </Text>
            ) : null}
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
