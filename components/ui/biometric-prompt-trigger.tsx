/**
 * Kahade — <BiometricPromptTrigger> (§9.21 PIN/Biometric Confirmation Sheet,
 * §10 "Konfirmasi PIN/biometric = BottomSheet", §14 re-auth & lockout,
 * §8 haptic di momen kritikal, §12 Voice & Tone).
 *
 * Pembungkus yang memicu prompt biometrik OS (lib/biometrics.ts) dan, bila
 * gagal / dibatalkan ke PIN / tidak tersedia, membuka <BottomSheet> berisi
 * <PinPad> sebagai fallback. Pemanggil hanya perlu SATU callback:
 * `onAuthenticated({ method })` — apakah lewat wajah/sidik jari atau PIN,
 * layar tidak perlu peduli.
 *
 * Alur:
 *   tekan -> (biometrik aktif & tersedia?) -> prompt OS
 *     success   -> haptic success -> onAuthenticated({ method: "biometric" })
 *     cancelled -> tidak apa-apa (onCancel)
 *     fallback / failed / lockout / unavailable -> buka sheet PIN
 *   sheet PIN -> 6 digit -> `verifyPin(pin)` (async, pemanggil membandingkan
 *   dengan hash di SecureStore atau memanggil backend)
 *     true  -> haptic success -> onAuthenticated({ method: "pin" })
 *     false -> haptic error, dots kembali kosong, `attempts` naik; setelah
 *              `maxAttempts` -> `onLockout()` dan pad disabled (lockout
 *              progresif + countdown dikelola pemanggil via `lockedUntilLabel`)
 *
 * Keputusan non-obvious:
 *   - Biometrik TIDAK pernah menggantikan PIN sebagai satu-satunya faktor:
 *     PIN wajib ada dulu (`biometricEnabled` hanya jalan pintas). Karena itu
 *     komponen selalu mensyaratkan `verifyPin` — walau biometrik ada.
 *   - Prompt OS memakai `disableDeviceFallback` (lihat lib/biometrics.ts):
 *     passcode perangkat ≠ PIN Kahade. Fallback kita adalah sheet PIN sendiri.
 *   - Sheet PIN menampilkan judul aksi (`promptMessage`, mis. "Konfirmasi
 *     transfer Rp1.500.000") — pengguna harus tahu APA yang ia setujui,
 *     bukan sekadar "Masukkan PIN". Nominal dirakit pemanggil (§13).
 *   - Indikator PIN = 6 titik (`Dot`) yang terisi, bukan <OtpInput>: OtpInput
 *     memakai TextInput (keyboard OS) — §9.21 melarang keyboard OS untuk PIN.
 *     Titik terisi memakai `bg-primary`, kosong `border-border`.
 *   - Error PIN salah: titik-titik dikosongkan + <Alert tone="danger" soft>
 *     dengan sisa percobaan (Mono). Tidak ada shake animation: §8 tidak
 *     mendefinisikannya, dan haptic "error" sudah memberi umpan fisik.
 *   - `verifying` (menunggu backend) menonaktifkan pad, bukan menampilkan
 *     spinner besar — sheet tetap stabil, pengguna melihat 6 titik penuh.
 *   - Tombol biometrik di PinPad (slot kiri-bawah) muncul hanya bila
 *     kapabilitas tersedia DAN belum lockout OS, supaya pengguna bisa
 *     mencoba lagi setelah gagal sekali (mis. jari basah).
 *   - Sheet menutup DULU lalu `onAuthenticated` dipanggil dari `onHidden`:
 *     kalau pemanggil langsung Push layar sukses saat sheet masih terbuka,
 *     transisi bertumpuk dan Portal sheet tertinggal di layar lama (§9.9).
 *   - Render trigger: default <Button>; `children(open, state)` render-prop
 *     untuk trigger custom (mis. `<PinPad onBiometric>` di layar lock,
 *     atau memicu otomatis saat app kembali dari background §14 lewat `ref`).
 */
import { Fingerprint, ScanSmiley } from "phosphor-react-native"
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react"
import { View } from "react-native"

import { Alert } from "@/components/ui/alert"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button, type ButtonProps } from "@/components/ui/button"
import type { IconComponent } from "@/components/ui/icon"
import { PinPad } from "@/components/ui/pin-pad"
import { Text } from "@/components/ui/text"
import { authenticateBiometric, getBiometricCapability, type BiometricCapability, type BiometricOutcome } from "@/lib/biometrics"
import { cn } from "@/lib/cn"
import { haptic } from "@/lib/haptics"

export type AuthMethod = "biometric" | "pin"

export type BiometricPromptState = {
  /** Kapabilitas perangkat (null = belum dicek) */
  capability: BiometricCapability | null
  /** Prompt OS sedang tampil */
  prompting: boolean
  /** Sheet PIN terbuka */
  pinOpen: boolean
}

export type BiometricPromptTriggerHandle = {
  /** Mulai alur (biometrik -> fallback PIN) secara programatik */
  open: () => void
  /** Langsung ke sheet PIN, melewati biometrik */
  openPin: () => void
}

export type BiometricPromptTriggerLabels = {
  trigger: string
  pinTitle: string
  pinDescription: string
  wrongPin: (remaining: number) => string
  lockedTitle: string
  biometricFailed: string
  biometricLockout: string
}

export type BiometricPromptTriggerProps = {
  /** Judul prompt OS & sheet PIN: "Konfirmasi transfer Rp1.500.000" */
  promptMessage: string
  /** Baris kedua (Android prompt / deskripsi sheet) */
  promptSubtitle?: string
  /** Pengguna mengizinkan biometrik (dari SecureStore `biometricEnabled`) */
  biometricEnabled?: boolean
  /** Bandingkan PIN dengan hash / backend. Kembalikan true bila benar. */
  verifyPin: (pin: string) => Promise<boolean> | boolean
  pinLength?: number
  /** Percobaan PIN yang sudah gagal (controlled, dari pemanggil/backend) */
  attempts?: number
  maxAttempts?: number
  /** Sedang lockout progresif; label countdown sudah diformat pemanggil */
  lockedUntilLabel?: string
  onAuthenticated: (result: { method: AuthMethod }) => void
  /** Pengguna menutup prompt/sheet tanpa berhasil */
  onCancel?: () => void
  /** Setiap PIN salah — pemanggil menaikkan `attempts`, mencatat ke backend */
  onPinFailed?: (attempts: number) => void
  /** `attempts` mencapai `maxAttempts` — pemanggil memulai lockout */
  onLockout?: () => void
  /** Biometrik gagal/lockout/unavailable sebelum fallback (untuk Banner) */
  onBiometricOutcome?: (outcome: BiometricOutcome) => void
  /** Trigger custom */
  children?: (open: () => void, state: BiometricPromptState) => ReactNode
  variant?: ButtonProps["variant"]
  size?: ButtonProps["size"]
  fullWidth?: boolean
  disabled?: boolean
  labels?: Partial<BiometricPromptTriggerLabels>
  className?: string
}

const DEFAULT_LABELS: BiometricPromptTriggerLabels = {
  trigger: "Konfirmasi",
  pinTitle: "Masukkan PIN",
  pinDescription: "Masukkan PIN Kahade Anda untuk melanjutkan.",
  wrongPin: (remaining) => `PIN salah. Sisa percobaan: ${remaining}`,
  lockedTitle: "Terlalu banyak percobaan",
  biometricFailed: "Biometrik tidak dikenali. Gunakan PIN.",
  biometricLockout: "Biometrik terkunci sementara oleh sistem. Gunakan PIN.",
}

export const BiometricPromptTrigger = forwardRef<BiometricPromptTriggerHandle, BiometricPromptTriggerProps>(
  function BiometricPromptTrigger(
    {
      promptMessage,
      promptSubtitle,
      biometricEnabled = true,
      verifyPin,
      pinLength = 6,
      attempts = 0,
      maxAttempts = 5,
      lockedUntilLabel,
      onAuthenticated,
      onCancel,
      onPinFailed,
      onLockout,
      onBiometricOutcome,
      children,
      variant = "primary",
      size = "md",
      fullWidth = true,
      disabled = false,
      labels,
      className,
    },
    ref,
  ) {
    const t = { ...DEFAULT_LABELS, ...labels }

    const [capability, setCapability] = useState<BiometricCapability | null>(null)
    const [prompting, setPrompting] = useState(false)
    const [pinOpen, setPinOpen] = useState(false)
    const [pin, setPin] = useState("")
    const [verifying, setVerifying] = useState(false)
    const [pinError, setPinError] = useState<string | null>(null)
    const [biometricNote, setBiometricNote] = useState<string | null>(null)
    const [osLockout, setOsLockout] = useState(false)
    // Hasil yang menunggu sheet tertutup sebelum dilaporkan ke pemanggil
    const pendingMethod = useRef<AuthMethod | null>(null)

    const locked = !!lockedUntilLabel || attempts >= maxAttempts
    const remaining = Math.max(0, maxAttempts - attempts)

    useEffect(() => {
      let alive = true
      getBiometricCapability().then((cap) => {
        if (alive) setCapability(cap)
      })
      return () => {
        alive = false
      }
    }, [])

    const openPin = useCallback(() => {
      setPin("")
      setPinError(null)
      setPinOpen(true)
    }, [])

    const succeed = useCallback(
      (method: AuthMethod) => {
        haptic("success")
        if (pinOpen) {
          // Tutup sheet dulu; laporkan di onHidden
          pendingMethod.current = method
          setPinOpen(false)
        } else {
          onAuthenticated({ method })
        }
      },
      [onAuthenticated, pinOpen],
    )

    const runBiometric = useCallback(async () => {
      if (prompting) return
      setPrompting(true)
      const outcome = await authenticateBiometric({ promptMessage, promptSubtitle })
      setPrompting(false)
      onBiometricOutcome?.(outcome)

      switch (outcome) {
        case "success":
          succeed("biometric")
          return
        case "cancelled":
          onCancel?.()
          return
        case "fallback":
          setBiometricNote(null)
          break
        case "failed":
          haptic("error")
          setBiometricNote(t.biometricFailed)
          break
        case "lockout":
          haptic("error")
          setOsLockout(true)
          setBiometricNote(t.biometricLockout)
          break
        case "unavailable":
          setBiometricNote(null)
          break
      }
      if (!pinOpen) openPin()
    }, [prompting, promptMessage, promptSubtitle, onBiometricOutcome, succeed, onCancel, pinOpen, openPin, t])  

    const open = useCallback(() => {
      if (disabled) return
      if (locked) {
        openPin() // tampilkan sheet dengan Alert lockout, pad disabled
        return
      }
      if (biometricEnabled && capability?.available && !osLockout) void runBiometric()
      else openPin()
    }, [disabled, locked, biometricEnabled, capability, osLockout, runBiometric, openPin])

    useImperativeHandle(ref, () => ({ open, openPin }), [open, openPin])

    const submitPin = useCallback(
      async (value: string) => {
        setVerifying(true)
        let ok = false
        try {
          ok = await verifyPin(value)
        } finally {
          setVerifying(false)
        }
        if (ok) {
          succeed("pin")
          return
        }
        haptic("error")
        setPin("")
        const next = attempts + 1
        onPinFailed?.(next)
        if (next >= maxAttempts) {
          setPinError(null)
          onLockout?.()
        } else {
          setPinError(t.wrongPin(maxAttempts - next))
        }
      },
      [verifyPin, succeed, attempts, onPinFailed, maxAttempts, onLockout, t],
    )

    const onDigit = useCallback(
      (d: string) => {
        if (verifying || locked) return
        setPinError(null)
        const next = pin + d
        setPin(next)
        if (next.length === pinLength) void submitPin(next)
      },
      [pin, pinLength, verifying, locked, submitPin],
    )

    const onBackspace = useCallback(() => {
      if (verifying) return
      setPin((p) => p.slice(0, -1))
    }, [verifying])

    const handleRequestClose = useCallback(() => {
      if (verifying) return
      setPinOpen(false)
      onCancel?.()
    }, [verifying, onCancel])

    const handleHidden = useCallback(() => {
      const m = pendingMethod.current
      pendingMethod.current = null
      setPin("")
      setPinError(null)
      setBiometricNote(null)
      if (m) onAuthenticated({ method: m })
    }, [onAuthenticated])

    const showBiometricKey = biometricEnabled && !!capability?.available && !osLockout && !locked
    const triggerIcon: IconComponent | undefined =
      biometricEnabled && capability?.available ? (capability.kind === "face" ? ScanSmiley : Fingerprint) : undefined
    const state: BiometricPromptState = { capability, prompting, pinOpen }

    return (
      <>
        {children ? (
          children(open, state)
        ) : (
          <Button accessibilityHint="Ketuk untuk berinteraksi"
            variant={variant}
            size={size}
            fullWidth={fullWidth}
            leftIcon={triggerIcon}
            loading={prompting}
            disabled={disabled}
            haptic
            onPress={open}
            className={className}
          >
            {t.trigger}
          </Button>
        )}

        <BottomSheet
          visible={pinOpen}
          onRequestClose={handleRequestClose}
          onHidden={handleHidden}
          title={t.pinTitle}
          description={promptMessage}
          dismissOnBackdrop={!verifying}
          dragArea="handle"
          accessibilityLabel={`${t.pinTitle}: ${promptMessage}`}
        >
          <View className="items-center gap-6 pb-2">
            {promptSubtitle ? (
              <Text variant="caption" tone="secondary" className="text-center">
                {promptSubtitle}
              </Text>
            ) : (
              <Text variant="caption" tone="secondary" className="text-center">
                {t.pinDescription}
              </Text>
            )}

            {/* Indikator 6 titik — bukan OtpInput (tanpa keyboard OS, §9.21) */}
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`PIN ${pin.length} dari ${pinLength} digit`}
              accessibilityValue={{ min: 0, max: pinLength, now: pin.length }}
              className="flex-row items-center gap-4"
            >
              {Array.from({ length: pinLength }).map((_, i) => (
                <View
                  key={i}
                  className={cn(
                    "h-4 w-4 rounded-full border",
                    // Dot kosong = indikator state non-teks -> border-control >= 3:1 (WCAG 1.4.11, audit #6)
                    i < pin.length ? "border-primary bg-primary" : "border-border-control bg-transparent",
                    pinError && "border-danger",
                  )}
                />
              ))}
            </View>

            {locked ? (
              <Alert tone="danger" title={t.lockedTitle} className="w-full">
                {lockedUntilLabel ?? ""}
              </Alert>
            ) : pinError ? (
              <Alert tone="danger" className="w-full">
                {pinError}
              </Alert>
            ) : biometricNote ? (
              <Alert tone="warning" className="w-full">
                {biometricNote}
              </Alert>
            ) : null}

            {!locked && remaining < maxAttempts && !pinError ? (
              <Text variant="caption" tone="secondary">
                Sisa percobaan:{" "}
                <Text variant="monoBody" tone="secondary">
                  {remaining}
                </Text>
              </Text>
            ) : null}

            <PinPad
              onDigit={onDigit}
              onBackspace={onBackspace}
              onBiometric={showBiometricKey ? () => void runBiometric() : undefined}
              disabled={verifying || locked}
            />
          </View>
        </BottomSheet>
      </>
    )
  },
)
