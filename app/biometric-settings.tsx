/**
 * Screen — Biometrik.
 *
 * Toggle "buka dengan Face ID / sidik jari" (preferensi lokal di SecureStore,
 * `SecureKeys.biometricEnabled`) + pintasan ke Verifikasi Dua Langkah.
 *
 * Keputusan non-obvious:
 *   - Sebelum mengaktifkan, perangkat WAJIB lolos prompt biometrik
 *     (`authenticateBiometric`) — kalau tidak, pengguna bisa menyalakan
 *     opsi di perangkat yang tidak punya sensor/enrolment dan terkunci di
 *     PinPad nanti. Mematikan tidak butuh prompt (menurunkan keamanan tidak
 *     perlu dibuktikan dengan biometrik; PIN tetap dibutuhkan untuk transaksi).
 *   - Kapabilitas dicek saat mount (`getBiometricCapability` +
 *     `canUseBiometricStorage`); bila tidak tersedia, Switch dinonaktifkan
 *     dengan penjelasan — bukan disembunyikan, supaya pengguna tahu fiturnya
 *     ada dan apa syaratnya.
 *   - Kartu 2FA & kode cadangan TIDAK diduplikasi di sini (sebelumnya
 *     memanggil regenerate dengan password kosong). Satu sumber alur 2FA:
 *     app/two-factor.tsx.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ShieldCheck } from "phosphor-react-native"

import { authenticateBiometric, getBiometricCapability, type BiometricCapability } from "@/lib/biometrics"
import { canUseBiometricStorage, getSecureItem, setSecureItem, SecureKeys } from "@/lib/secure-storage"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { Alert } from "@/components/ui/alert"
import { Header } from "@/components/ui/header"
import { ListGroup, ListItem } from "@/components/ui/list-item"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

// UX polish: biometric toggle memakai Switch dengan haptic + description caption (audit #029)
export default function BiometricSettingsScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [biometric, setBiometric] = useState(false)
  const [capability, setCapability] = useState<BiometricCapability | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [stored, cap] = await Promise.all([
        getSecureItem(SecureKeys.biometricEnabled).catch(() => null),
        getBiometricCapability().catch(
          () => ({ available: false, kind: "none", label: "biometrik" }) as BiometricCapability,
        ),
      ])
      if (cancelled) return
      const usable = cap.available && canUseBiometricStorage()
      setCapability({ ...cap, available: usable })
      // Preferensi lama di perangkat yang kehilangan enrolment tidak boleh
      // tetap "aktif" — PinPad akan gagal memanggil biometrik.
      setBiometric(stored === "1" && usable)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleToggle = useCallback(
    async (next: boolean) => {
      if (toggling) return
      setToggling(true)
      try {
        if (next) {
          const outcome = await authenticateBiometric({
            promptMessage: "Konfirmasi untuk mengaktifkan biometrik",
            promptSubtitle: "Kahade akan memakai biometrik untuk membuka aplikasi",
            fallbackLabel: "Batal",
          })
          if (outcome !== "success") {
            if (outcome === "lockout") {
              toast.show({
                title: "Biometrik terkunci sementara",
                description: "Terlalu banyak percobaan gagal. Coba lagi nanti.",
                tone: "danger",
              })
            } else if (outcome === "failed" || outcome === "unavailable") {
              toast.show({ title: "Biometrik tidak dikenali", tone: "danger" })
            }
            return
          }
        }
        await setSecureItem(SecureKeys.biometricEnabled, next ? "1" : "0")
        setBiometric(next)
        toast.show({ title: next ? "Biometrik diaktifkan" : "Biometrik dimatikan", tone: "success" })
      } catch {
        // Kegagalan di sini berasal dari perangkat (sensor/SecureStore), bukan
        // backend — tidak ada pesan server yang bisa diteruskan.
        toast.show({ title: "Gagal menyimpan pengaturan biometrik", tone: "danger" })
      } finally {
        setToggling(false)
      }
    },
    [toggling, toast.show],
  )

  const label = capability?.label ?? "biometrik"
  const unavailable = !loading && !capability?.available

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Biometrik" />
      <View
        className="gap-4 px-6"
        style={{ paddingTop: tokens.space[3], paddingBottom: insets.bottom + tokens.space[8] }}
      >
        <Switch
          value={biometric}
          onChange={(v) => void handleToggle(v)}
          label={`Buka dengan ${label}`}
          description="Untuk membuka aplikasi dan konfirmasi transaksi tanpa mengetik PIN."
          disabled={loading || toggling || unavailable}
        />

        {unavailable ? (
          <Alert tone="info" title="Biometrik belum tersedia di perangkat ini">
            Daftarkan wajah atau sidik jari di pengaturan sistem perangkat, lalu kembali ke sini untuk
            mengaktifkannya.
          </Alert>
        ) : (
          <Text variant="caption" tone="secondary">
            PIN dompet tetap diminta bila {label} gagal dikenali atau saat perangkat baru dipakai masuk.
          </Text>
        )}

        <SectionHeader title="Lapisan keamanan lain" />
        <ListGroup>
          <ListItem
            title="Verifikasi dua langkah"
            subtitle="Kode dari aplikasi autentikator saat masuk"
            leading={ShieldCheck}
            chevron
            onPress={() => router.push(ROUTES.twoFactor)}
          />
        </ListGroup>
      </View>
    </Screen>
  )
}
