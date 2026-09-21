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
import { AppState, Platform, View } from "react-native"
import { LockKey } from "phosphor-react-native"

import { api, clearSession } from "@/lib/api"
import { authenticateBiometric, getBiometricCapability } from "@/lib/biometrics"
import { haptic } from "@/lib/haptics"
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
        promptMessage: "Buka Kahade",
        promptSubtitle: "Verifikasi untuk melanjutkan ke aplikasi",
      })
      if (outcome === "success") {
        haptic("success")
        setLocked(false)
      } else if (outcome === "failed" || outcome === "lockout") {
        setPinError(
          outcome === "lockout"
            ? "Biometrik terkunci sementara. Masukkan PIN dompet."
            : "Biometrik tidak dikenali. Masukkan PIN dompet.",
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
          setPinError("PIN salah. Coba lagi.")
        }
      } catch (err) {
        // Kegagalan jaringan saat unlock tidak boleh diklaim sebagai PIN salah.
        haptic("error")
        setPinError("Tidak dapat memverifikasi PIN. Periksa koneksi lalu coba lagi.")
        logWarn("app-lock:verify-pin", err)
      } finally {
        setVerifying(false)
      }
    },
    [verifying, unlock],
  )

  const handleBiometricPress = useCallback(async () => {
    const outcome = await authenticateBiometric({
      promptMessage: "Buka Kahade",
      promptSubtitle: "Verifikasi untuk melanjutkan ke aplikasi",
    })
    if (outcome === "success") {
      haptic("success")
      unlock()
    } else if (outcome === "failed" || outcome === "lockout") {
      setPinError(
        outcome === "lockout"
          ? "Biometrik terkunci sementara. Masukkan PIN dompet."
          : "Biometrik tidak dikenali. Masukkan PIN dompet.",
      )
    }
  }, [unlock])

  const handleSignOut = useCallback(() => {
    void clearSession().catch((err) => logWarn("app-lock:sign-out", err))
  }, [])

  if (!locked || Platform.OS === "web") return null

  return (
    <View
      className="absolute inset-0 bg-background"
      style={{ zIndex: 10, elevation: 10, padding: tokens.space[5] }}
    >
      <View className="flex-1 items-center justify-center gap-8">
        <View className="items-center gap-3">
          <Icon icon={LockKey} size={40} weight="duotone" tone="active" />
          <Heading level={2} className="text-center">
            Kahade terkunci
          </Heading>
          <Text variant="body" tone="secondary" className="text-center text-pretty">
            {biometricAvailable
              ? "Gunakan biometrik atau masukkan PIN dompet untuk melanjutkan."
              : "Masukkan PIN dompet Anda untuk melanjutkan."}
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
          Keluar & masuk ulang
        </Button>
      </View>
    </View>
  )
}
