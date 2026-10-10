/**
 * Kahade — <AppLockGate> (§14 re-autentikasi setelah background > 1 menit).
 *
 * Implementasi "Kunci aplikasi / buka dengan biometrik" yang DIJANJIKAN
 * `app/biometric-settings.tsx` tetapi tidak pernah ada (audit A-04). Dipasang
 * SEKALI di root layout (AppShell), hanya native + hanya saat ada sesi.
 *
 * Perilaku:
 *   - Toggle `SecureKeys.biometricEnabled` = "kunci aplikasi aktif".
 *   - App ke background ≥ APP_LOCK_AFTER_MS (60 detik, sesuai §14) lalu
 *     kembali active → layar kunci penuh menutupi seluruh tree.
 *   - Buka kunci: prompt biometrik OS (otomatis muncul sekali saat terkunci)
 *     atau PIN dompet — PIN diverifikasi SERVER (POST /v1/wallet/verify-pin),
 *     tidak pernah dibandingkan lokal (slot `pinHash` lama sudah dihapus,
 *     audit A-05).
 *   - Jalan keluar darurat: "Keluar & masuk ulang" → clearSession(). Tanpa
 *     ini, pengguna yang sensor biometriknya rusak DAN lupa PIN dompet
 *     terkunci permanen dari uangnya sendiri.
 *
 * Keputusan non-obvious:
 *   - Overlay dirender SETELAH PortalHost di root layout sehingga menutupi
 *     Stack; unlock memakai PinInput INLINE (bukan BottomSheet ber-portal)
 *     agar tidak ada masalah urutan z-index portal vs overlay.
 *   - Flag `enabled` dibaca ulang setiap kali app kembali active (bukan hanya
 *     saat mount): pengguna yang baru mematikan toggle di Pengaturan tidak
 *     perlu restart app.
 *   - Prompt biometrik otomatis hanya SEKALI per lock (guard ref): kegagalan
 *     tidak boleh memicu loop prompt OS yang mengunci perangkat (lockout).
 *   - `AppState` "inactive" (control center / pemilih app) TIDAK memulai
 *     hitungan background di iOS bila kembali active dalam < 60 d — ambang
 *     waktu yang sama melindungi keduanya.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { AccessibilityInfo, AppState, Platform, View } from "react-native"
import { LockKey } from "phosphor-react-native"

import { api, clearSession } from "@/lib/api"
import { isOfflineError, userMessage } from "@/lib/api/errors"
import { authenticateBiometric, getBiometricCapability } from "@/lib/biometrics"
import { haptic } from "@/lib/haptics"
import { translate } from "@/lib/i18n/translate"
import { isCooldownError, retryAfterMessage } from "@/lib/retry-cooldown"
import { getSecureItem, SecureKeys } from "@/lib/secure-storage"
import { logWarn } from "@/lib/telemetry"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { Heading } from "@/components/ui/heading"
import { Icon } from "@/components/ui/icon"
import { PinInput } from "@/components/ui/pin-input"
import { Text } from "@/components/ui/text"

/** Ambang §14: re-autentikasi setelah background lebih dari 1 menit. */
export const APP_LOCK_AFTER_MS = 60_000

export function AppLockGate({ sessionActive }: { sessionActive: boolean }) {
  const [locked, setLocked] = useState(false)
  const [pinError, setPinError] = useState<string | undefined>()
  const [verifying, setVerifying] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const backgroundAt = useRef<number | null>(null)
  const autoPrompted = useRef(false)

  // Sesi berakhir (logout di layar mana pun) → lock tidak relevan lagi.
  useEffect(() => {
    if (!sessionActive && locked) {
      setLocked(false)
      backgroundAt.current = null
    }
  }, [sessionActive, locked])

  /**
   * Audit Auth 2026-10-10 (#FE-S17): kunci juga saat SESI DIPULIHKAN pada
   * cold start. Sebelumnya gate hanya menyala lewat transisi AppState
   * background→active, jadi mematikan aplikasi (app switcher / OS) lalu
   * membukanya lagi — "latar belakang" terpanjang yang ada — justru melewati
   * kunci sama sekali: isi dompet/chat tampil tanpa biometrik/PIN.
   *
   * Dibedakan dari login baru: `startSession()` menghapus flag
   * `biometricEnabled` (akun baru tidak mewarisi kunci), jadi flag "1" saat
   * sesi menjadi aktif hanya terjadi pada pemulihan sesi tersimpan.
   */
  const restoreChecked = useRef(false)
  useEffect(() => {
    if (Platform.OS === "web") return
    if (!sessionActive) {
      restoreChecked.current = false
      return
    }
    if (restoreChecked.current) return
    restoreChecked.current = true
    void (async () => {
      const [stored, cap] = await Promise.all([
        getSecureItem(SecureKeys.biometricEnabled).catch((err) => {
          logWarn("app-lock:read-flag", err)
          return null
        }),
        getBiometricCapability().catch((err) => {
          logWarn("app-lock:capability", err)
          return null
        }),
      ])
      if (stored !== "1") return
      setBiometricAvailable(Boolean(cap?.available))
      autoPrompted.current = false
      setPinError(undefined)
      setLocked(true)
    })()
  }, [sessionActive])

  useEffect(() => {
    if (Platform.OS === "web" || !sessionActive) return
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        if (backgroundAt.current == null) backgroundAt.current = Date.now()
        return
      }
      const since = backgroundAt.current
      backgroundAt.current = null
      if (since == null) return
      void (async () => {
        // Baca flag segar: toggle bisa berubah saat app di background.
        const [stored, cap] = await Promise.all([
          getSecureItem(SecureKeys.biometricEnabled).catch((err) => {
            logWarn("app-lock:read-flag", err)
            return null
          }),
          getBiometricCapability().catch((err) => {
            logWarn("app-lock:capability", err)
            return null
          }),
        ])
        if (stored !== "1") return
        setBiometricAvailable(Boolean(cap?.available))
        if (Date.now() - since < APP_LOCK_AFTER_MS) return
        autoPrompted.current = false
        setPinError(undefined)
        setLocked(true)
        haptic("warning")
      })()
    })
    return () => subscription.remove()
  }, [sessionActive])

  // Prompt biometrik otomatis sekali saat layar kunci muncul.
  useEffect(() => {
    if (!locked || !biometricAvailable || autoPrompted.current) return
    autoPrompted.current = true
    void (async () => {
      const outcome = await authenticateBiometric({
        promptMessage: translate("Buka Kahade"),
        promptSubtitle: translate("Verifikasi untuk melanjutkan ke aplikasi"),
      })
      if (outcome === "success") {
        haptic("success")
        setLocked(false)
      } else if (outcome === "failed" || outcome === "lockout") {
        setPinError(
          outcome === "lockout"
            ? translate("Biometrik terkunci sementara. Masukkan PIN dompet.")
            : translate("Biometrik tidak dikenali. Masukkan PIN dompet."),
        )
      }
    })()
  }, [locked, biometricAvailable])

  const unlock = useCallback(() => {
    setLocked(false)
    setPinError(undefined)
    backgroundAt.current = null
  }, [])

  const handlePin = useCallback(
    async (pin: string) => {
      if (verifying) return
      setVerifying(true)
      setPinError(undefined)
      try {
        const res = await api.wallet.verifyWalletPin({ pin })
        if (res.valid) {
          haptic("success")
          unlock()
        } else {
          haptic("error")
          setPinError(translate("PIN salah. Coba lagi."))
        }
      } catch (err) {
        haptic("error")
        /*
         * Audit Auth 2026-10-10 (#FE-S18): SEMUA galat dulu dilaporkan sebagai
         * "periksa koneksi" — termasuk lockout PIN (403/429 dengan durasi) dan
         * sesi yang sudah habis — pelanggaran aturan pesan jujur (CLAUDE.md §3).
         * Lockout → durasi nyata; offline → kalimat offline; sisanya pesan
         * spesifik dari transport (timeout, server) lewat userMessage.
         */
        if (isCooldownError(err)) {
          setPinError(
            retryAfterMessage(
              err,
              translate("Terlalu banyak percobaan PIN. Tunggu beberapa saat lalu coba lagi."),
              translate("Terlalu banyak percobaan PIN"),
            ),
          )
        } else if (isOfflineError(err)) {
          setPinError(translate("Tidak ada koneksi internet. PIN tidak bisa diverifikasi."))
        } else {
          setPinError(userMessage(err))
        }
        logWarn("app-lock:verify-pin", err)
      } finally {
        setVerifying(false)
      }
    },
    [verifying, unlock],
  )

  const handleBiometricPress = useCallback(async () => {
    const outcome = await authenticateBiometric({
      promptMessage: translate("Buka Kahade"),
      promptSubtitle: translate("Verifikasi untuk melanjutkan ke aplikasi"),
    })
    if (outcome === "success") {
      haptic("success")
      unlock()
    } else if (outcome === "failed" || outcome === "lockout") {
      setPinError(
        outcome === "lockout"
          ? translate("Biometrik terkunci sementara. Masukkan PIN dompet.")
          : translate("Biometrik tidak dikenali. Masukkan PIN dompet."),
      )
    }
  }, [unlock])

  /**
   * Audit Auth 2026-10-10 (#FE-S3): jalan keluar darurat dulu hanya
   * `clearSession()` LOKAL — sesi server (refresh token 7 hari) tetap hidup
   * dan masih bisa dipakai bila token sempat bocor. Kini lewat
   * `api.auth.logout()`: mencabut sesi di server (best-effort, retry +
   * penjadwalan ulang saat offline) DAN membersihkan sesi lokal apa pun
   * hasilnya — pengguna tidak pernah terjebak di layar kunci.
   */
  const handleSignOut = useCallback(() => {
    void api.auth
      .logout()
      .catch((err) => {
        logWarn("app-lock:sign-out", err)
        return clearSession().catch((cleanupErr) => logWarn("app-lock:sign-out-clear", cleanupErr))
      })
  }, [])

  // UX-A11Y-002: saat overlay kunci muncul, umumkan ke screen reader.
  // Overlay penuh menutupi seluruh app tanpa ini tidak terdeteksi SR.
  useEffect(() => {
    if (locked) {
      AccessibilityInfo.announceForAccessibility(
        translate("Kahade terkunci. Masukkan PIN dompet untuk melanjutkan."),
      )
    }
  }, [locked])

  if (!locked || Platform.OS === "web") return null

  return (
    <View
      className="absolute inset-0 bg-background"
      style={{ zIndex: 10, elevation: 10, padding: tokens.space[5] }}
      // UX-A11Y-002: modal aksesibilitas — SR tidak boleh menjelajahi
      // tree di belakang overlay kunci.
      accessible
      accessibilityViewIsModal
      accessibilityLabel={translate("Kunci aplikasi")}
    >
      <View className="flex-1 items-center justify-center gap-8">
        <View className="items-center gap-3">
          <Icon icon={LockKey} size={40} weight="duotone" tone="active" />
          <Heading level={2} className="text-center">
            {translate("Kahade terkunci")}
          </Heading>
          <Text variant="body" tone="secondary" className="text-center text-pretty">
            {biometricAvailable
              ? translate("Gunakan biometrik atau masukkan PIN dompet untuk melanjutkan.")
              : translate("Masukkan PIN dompet Anda untuk melanjutkan.")}
          </Text>
        </View>

        <PinInput
          mode="enter"
          onComplete={(pin) => void handlePin(pin)}
          onBiometric={biometricAvailable ? () => void handleBiometricPress() : undefined}
          errorText={pinError}
          disabled={verifying}
        />

        <Button variant="ghost" fullWidth={false} onPress={handleSignOut}>
          {translate("Keluar & masuk ulang")}
        </Button>
      </View>
    </View>
  )
}
