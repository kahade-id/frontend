/**
 * Screen — Buat/Ubah PIN (POST /v1/wallet/set-pin).
 *
 * `SetPinDto` = { pin, currentPin?, password }. `currentPin` wajib saat PIN
 * sudah pernah dibuat; TIDAK wajib saat user belum punya PIN (registrasi baru
 * tidak membuat PIN — user membuatnya di sini).
 *
 * Alur (punya PIN): password akun → PIN lama (diverifikasi lewat
 * POST /v1/wallet/verify-pin supaya kesalahan ketahuan sebelum memilih PIN
 * baru) → PIN baru (mode "setup": masukkan + ulangi) → simpan.
 *
 * Alur (belum punya PIN): password akun → langsung PIN baru → simpan.
 *
 * Keputusan non-obvious:
 *   - Validasi panjang password memakai `PASSWORD_MIN` dari lib/auth-constants
 *     (12), bukan angka literal — sama dengan aturan registrasi.
 *   - WF-025 (fail-closed): bila `verify-pin` gagal karena jaringan, pengguna
 *     TIDAK boleh lanjut — tampilkan pesan jelas dan tetap di langkah PIN
 *     lama. Backend tetap memvalidasi ulang `currentPin` di set-pin sebagai
 *     pertahanan berlapis.
 *   - `hasPin` diambil dari GET /v1/wallet; jika gagal diambil (offline),
 *     fallback ke mode "ubah" (minta PIN lama) karena itu yang paling aman —
 *     backend akan menolak dengan pesan jelas jika ternyata belum punya PIN.
 */
import { useCallback, useEffect, useState } from "react"
import { ScrollView } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router } from "expo-router"

import { api, isApiError, userMessage } from "@/lib/api"
import { PASSWORD_MIN } from "@/lib/auth-constants"
import { goBackOrNavigate } from "@/lib/navigation"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { showMutationError } from "@/lib/mutation-toast"

import { Button } from "@/components/ui/button"
import { ScreenCaptureGuard } from "@/components/security/screen-capture-guard"
import { Header } from "@/components/ui/header"
import { PasswordField } from "@/components/ui/password-field"
import { TextLink } from "@/components/ui/text-link"
import { PinInput } from "@/components/ui/pin-input"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { SensitiveConfirmDialog } from "@/components/ui/sensitive-confirm"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

type Step = "password" | "current" | "new"

export default function ChangePinScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [step, setStep] = useState<Step>("password")
  const [password, setPassword] = useState("")
  const [currentPin, setCurrentPin] = useState("")
  const [currentError, setCurrentError] = useState<string | undefined>()
  const [newError, setNewError] = useState<string | undefined>()
  const [verifying, setVerifying] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // A11 (batch 139): konfirmasi sensitif seragam — PIN baru ditahan di sini
  // sampai pengguna menyetujui dialog konfirmasi.
  const [pendingPin, setPendingPin] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  /** null = belum diketahui (loading/gagal), true/false = status dari server */
  const [hasPin, setHasPin] = useState<boolean | null>(null)

  // Ambil status PIN dari wallet — menentukan apakah langkah "PIN lama" perlu.
  useEffect(() => {
    let cancelled = false
    api.wallet
      .getWallet()
      .then((w) => {
        if (!cancelled && typeof w?.hasPin === "boolean") setHasPin(w.hasPin)
      })
      .catch(() => {
        /* fallback: null → mode ubah (aman) */
      })
    return () => {
      cancelled = true
    }
  }, [])

  /** true jika user dipastikan belum punya PIN → lewati langkah PIN lama */
  const isSetupMode = hasPin === false

  const passwordOk = password.length >= PASSWORD_MIN

  const handleCurrentPin = useCallback(async (pin: string) => {
    setVerifying(true)
    setCurrentError(undefined)
    try {
      const res = await api.wallet.verifyWalletPin({ pin })
      if (res && res.valid === false) {
        setCurrentError("PIN lama salah. Coba lagi.")
        return
      }
      setCurrentPin(pin)
      setStep("new")
    } catch (err) {
      // WF-025 (fail-closed): error transient (jaringan/timeout/5xx) TIDAK
      // boleh lanjut — tampilkan pesan jelas dan tetap di langkah PIN lama.
      // Sebelumnya kode lanjut ke langkah PIN baru dengan asumsi backend
      // validasi ulang, yang menyesatkan bila PIN salah + jaringan buruk.
      if (isApiError(err) && err.code === "RATE_LIMITED") {
        setCurrentError("Terlalu banyak percobaan PIN. Coba lagi dalam 15 menit.")
        return
      }
      if (isApiError(err) && err.isTransient) {
        setCurrentError("Tidak dapat memverifikasi PIN lama. Periksa koneksi internet lalu coba lagi.")
        return
      }
      setCurrentError("PIN lama salah. Coba lagi.")
      return
    } finally {
      setVerifying(false)
    }
  }, [])

  const handleNewPin = useCallback(
    async (pin: string) => {
      if (!isSetupMode && pin === currentPin) {
        setNewError("PIN baru harus berbeda dari PIN lama.")
        return
      }
      setSubmitting(true)
      setNewError(undefined)
      try {
        // Mode setup (belum punya PIN): currentPin tidak dikirim — backend
        // hanya butuh password + PIN baru.
        await api.wallet.setWalletPin(
          isSetupMode ? { pin, password } : { pin, currentPin, password },
        )
        toast.show({
          title: isSetupMode ? "PIN berhasil dibuat" : "PIN berhasil diubah",
          tone: "success",
        })
        // Sidebar 2026-10-05: /settings dihapus — PIN adalah bagian hub Keamanan.
        goBackOrNavigate(ROUTES.security)
      } catch (err: unknown) {
        // §14: percobaan PIN dibatasi. Bila backend mengunci akun, pesan itulah
        // yang harus dibaca pengguna — bukan saran "periksa password" yang
        // membuatnya mencoba lagi dan memperpanjang penguncian.
        const msg = userMessage(err)
        // Klasifikasi toast: error mutasi non-blokir via showMutationError.
        showMutationError(toast.show, {
          failTitle: isSetupMode ? "Gagal membuat PIN" : "Gagal mengubah PIN",
          uncertainHint: "Aksi mungkin sudah diproses — periksa kembali sebelum mencoba lagi.",
          err: err,
          scope: "change-pin:pin",
        })
        // A-18 (audit): error transient (jaringan/timeout/5xx) TIDAK lagi
        // melempar pengguna ke langkah password dan membuang PIN baru yang
        // sudah diketik dua kali — tetap di langkah "new". Hanya penolakan
        // autentikasi (password/PIN salah menurut server) yang kembali.
        const authRejected =
          isApiError(err) && (err.code === "UNAUTHORIZED" || err.code === "FORBIDDEN")
        if (authRejected) setStep("password")
        else setNewError(msg)
      } finally {
        setSubmitting(false)
      }
    },
    [currentPin, isSetupMode, password, toast.show],
  )

  // Setelah password OK: ke "new" langsung jika belum punya PIN, else "current".
  const afterPassword = useCallback(() => {
    setStep(isSetupMode ? "new" : "current")
  }, [isSetupMode])

  // Tombol kembali dari langkah "new": ke "current" jika ada, else ke "password".
  const backFromNew = useCallback(() => {
    setStep(isSetupMode ? "password" : "current")
  }, [isSetupMode])

  return (
    // SEC-404: proteksi screen-capture iOS di layar PIN.
    <ScreenCaptureGuard>
      <Screen keyboardAvoiding edges={["top"]} padded={false}>
      <Header title={hasPin === null ? "PIN dompet" : isSetupMode ? "Buat PIN" : "Ubah PIN"} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-4 px-5"
        contentContainerStyle={{ paddingTop: tokens.space[3], paddingBottom: insets.bottom + tokens.space[8] }}
      >
        {step === "password" ? (
          <>
            <SectionHeader title="Verifikasi kata sandi" />
            <Text variant="body" tone="secondary">
              {isSetupMode
                ? "Masukkan kata sandi akun untuk membuat PIN dompet."
                : "Masukkan kata sandi akun untuk mengizinkan perubahan PIN."}
            </Text>
            <PasswordField
              label="Kata sandi akun"
              value={password}
              onChangeText={setPassword}
              required
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => passwordOk && afterPassword()}
            />
            {/* FE-IMP-4 item 12: backend TIDAK punya reset PIN wallet via OTP
                (OtpType tidak punya jenis reset PIN; `set-pin` selalu butuh
                PIN lama untuk PIN existing). JANGAN mengklaim reset kata
                sandi bisa membuat PIN baru — itu salah. Arahkan ke dukungan. */}
            <Text variant="caption" tone="secondary" className="text-pretty">
              Lupa PIN wallet? Reset PIN mandiri belum didukung — hubungi{" "}
              <TextLink
                variant="caption"
                inline
                onPress={() => router.push(ROUTES.faq)}
                accessibilityLabel="Buka pusat bantuan"
              >
                pusat bantuan
              </TextLink>{" "}
              untuk verifikasi identitas dan bantuan reset.
            </Text>
            {/* P3 (overhaul auth 2026-10-10): tombol aksi mengikuti konten,
                bukan FooterBar berpemisah `border-t`. */}
            <Button fullWidth disabled={!passwordOk} onPress={afterPassword}>
              Lanjut
            </Button>
          </>
        ) : step === "current" ? (
          <>
            <SectionHeader title="PIN lama" />
            <Text variant="body" tone="secondary">
              Masukkan PIN dompet yang sedang aktif.
            </Text>
            <PinInput
              mode="enter"
              onComplete={(p) => void handleCurrentPin(p)}
              disabled={verifying}
              errorText={currentError}
            />
            <Button
              variant="ghost"
              fullWidth={false}
              onPress={() => setStep("password")}
              disabled={verifying}
            >
              Kembali
            </Button>
          </>
        ) : (
          <>
            {/* UI-W011: judul langkah membedakan mode — dulu dua cabang identik. */}
            <SectionHeader title={isSetupMode ? "Buat PIN" : "PIN baru"} />
            <Text variant="body" tone="secondary">
              Pilih PIN 6 digit. Jangan gunakan tanggal lahir atau angka berurutan.
            </Text>
            <PinInput
              mode="setup"
              // A11: jangan langsung submit — tahan PIN, minta konfirmasi dulu.
              onComplete={(p) => { setPendingPin(p); setConfirmOpen(true) }}
              disabled={submitting}
              errorText={newError}
            />
            <Button
              variant="ghost"
              fullWidth={false}
              onPress={backFromNew}
              disabled={submitting}
            >
              Kembali
            </Button>
          </>
        )}
      </ScrollView>

      {/* A11: konfirmasi sensitif seragam sebelum PIN benar-benar diganti. */}
      <SensitiveConfirmDialog
        visible={confirmOpen}
        title={isSetupMode ? "Buat PIN dompet?" : "Ubah PIN dompet?"}
        consequences={
          isSetupMode
            ? [
                "PIN 6 digit akan melindungi dompet Anda mulai sekarang.",
                "Jangan bagikan PIN kepada siapa pun, termasuk pihak yang mengaku dari Kahade.",
              ]
            : [
                "PIN dompet Anda akan diganti dengan yang baru.",
                "PIN lama langsung tidak berlaku setelah berhasil.",
              ]
        }
        confirmLabel={isSetupMode ? "Ya, buat PIN" : "Ya, ubah PIN"}
        loading={submitting}
        onConfirm={() => { setConfirmOpen(false); void handleNewPin(pendingPin) }}
        onCancel={() => setConfirmOpen(false)}
      />
      </Screen>
    </ScreenCaptureGuard>
  )
}
