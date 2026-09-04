/**
 * Kahade — Setup Profil (screen #6 alur auth): foto profil + bio.
 *
 * Screen opsional SETELAH akun jadi (phone-register berhasil). User sudah
 * login — token tersimpan di SecureStore.
 *
 * Struktur:
 *   <Header title="Setup Profil"> (tanpa progress — ini bukan step registrasi)
 *   H1 "Selamat datang, [firstName]!"
 *   body penjelasan
 *   <Avatar xl> (inisial dari fullName) + overlay ikon kamera
 *   [Button "Unggah foto" secondary sm] → ActionSheet → info "segera hadir"
 *   <TextArea "Tentang Anda"> (max 500 char)
 *   ── footer: [Lewati]  •  [Simpan]
 *
 *   Setelah simpan berhasil → ResultState "Akun Anda siap!" → "Mulai"
 *   Setelah lewati → langsung ke login (placeholder untuk Home)
 *
 * Kontrak API (docs/api/kahade-api-mobile.json):
 *   PUT /v1/users/me  body UpdateProfileDto { bio: string (max 500) }
 *   - auth: required (Bearer token dari phone-register)
 *   - Hanya field `bio` yang dikirim; field lain tidak diubah di screen ini.
 *
 *   Avatar upload:
 *   - POST /v1/users/me/avatar/direct (multipart) → POST /v1/users/me/avatar/confirm
 *   - API sudah tersedia di lib/api/users.ts
 *   - Image picker BELUM terpasang (expo-image-picker) — tombol "Unggah foto"
 *     menampilkan ActionSheet informatif. Struktur siap untuk ditambahkan
 *     picker tanpa mengubah API atau layout.
 *
 * Keputusan non-obvious:
 *   - Header TANPA progress bar (§9.22): setup profil BUKAN bagian dari alur
 *     registrasi 4 langkah. Ini langkah opsional pasca-registrasi, seperti
 *     "welcome tour". Tidak ada "Langkah X/Y" yang relevan.
 *   - Back button disembunyikan (`showBack={false}`): tidak ada screen sebelumnya
 *     yang masuk akal untuk kembali (screen #5 sudah submit ke server; kembali
 *     akan membuat user mengulang form data diri). Satu-satunya jalan keluar
 *     adalah "Lewati" (footer) atau "Simpan".
 *   - Guard: butuh access token. Kalau tidak ada (langsung ke URL tanpa
 *     phone-register), redirect ke login. Token didapat dari SecureStore
 *     lewat `getAccessToken()`.
 *   - "firstName" dari registration state (bukan fetch GET /v1/users/me):
 *     lebih cepat (tidak perlu round-trip) dan data sudah tersedia dari
 *     screen #5. Kalau somehow tidak ada, fallback ke "Selamat datang!" saja.
 *   - Avatar menampilkan inisial (dari `initials()` di lib/format) — bukan
 *     placeholder kosong. Ini memberi kesan "profil Anda sudah ada, tinggal
 *     lengkapi" — bukan "profil kosong".
 *   - Tombol "Unggah foto" memakai ActionSheet (bukan Alert RN) karena
 *     ActionSheet konsisten dengan design system (§10 action menu). Opsi
 *     "Ambil foto" dan "Pilih dari galeri" disiapkan tapi menampilkan pesan
 *     informatif — struktur siap untuk expo-image-picker.
 *   - Setelah "Simpan" berhasil → ResultState "Akun Anda siap!" memberi
 *     closure untuk seluruh alur registrasi. User merasa selesai dan welcome.
 *   - Bio field auto-trim whitespace di ujung (sama seperti EmailField) —
 *     sumber umum bio yang terlihat aneh di profil.
 *   - Tombol "Simpan" disabled saat bio kosong DAN tidak ada perubahan dari
 *     state awal — mencegah submit kosong yang tidak bermakna.
 *   - "Lewati untuk sekarang" = TextLink (bukan Button ghost): ini navigasi
 *     keluar, bukan aksi. Konsisten dengan pola TextLink di Onboarding.
 */
import { useCallback, useEffect, useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Redirect, useRouter } from "expo-router"
import { Camera as CameraIcon, PencilSimple } from "phosphor-react-native"

import { useTheme } from "@/components/theme-provider"
import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet"
import { Alert } from "@/components/ui/alert"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { Screen } from "@/components/ui/screen"
import { TextArea } from "@/components/ui/text-area"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { VStack } from "@/components/ui/stack"
import { api, getAccessToken, isApiError, userMessage } from "@/lib/api"
import { clearRegistrationState, getRegistrationState } from "@/lib/registration"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

export default function SetupProfileScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { mode } = useTheme()
  const regState = getRegistrationState()

  // Guard: butuh access token (user sudah login dari phone-register)
  const [hasToken, setHasToken] = useState<boolean | null>(null)
  useEffect(() => {
    let alive = true
    getAccessToken().then((t) => {
      if (alive) setHasToken(!!t)
    })
    return () => {
      alive = false
    }
  }, [])

  // Derived state
  const fullName = regState?.fullName ?? ""
  const firstName = fullName.split(" ")[0] || ""

  // Form state
  const [bio, setBio] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Avatar sheet
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false)

  // Redirect kalau belum login
  if (hasToken === null) return null
  if (!hasToken) return <Redirect href={ROUTES.login} />

  const hasChanges = bio.trim().length > 0

  const handleBioChange = useCallback((text: string) => {
    setBio(text)
    setFormError(null)
  }, [])

  const handleSave = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    setFormError(null)

    try {
      await api.users.updateProfile({
        bio: bio.trim() || undefined,
      })

      // Sukses: bersihkan state registrasi dan tampilkan welcome
      clearRegistrationState()
      // Redirect ke welcome screen (cek permissions)
      router.replace(ROUTES.welcome)
    } catch (err) {
      if (isApiError(err)) {
        // Error validasi bio → tampilkan di form
        if (err.code === "VALIDATION" || err.code === "BAD_REQUEST") {
          setFormError(err.message || "Bio tidak valid. Maksimal 500 karakter.")
          return
        }
      }
      setFormError(userMessage(err))
    } finally {
      setSubmitting(false)
    }
  }, [submitting, bio])

  const handleSkip = useCallback(() => {
    clearRegistrationState()
    // Redirect ke welcome screen (cek permissions)
    router.replace(ROUTES.welcome)
  }, [router])

  // ActionSheet items untuk avatar
  const avatarActions: readonly ActionSheetItem[] = [
    {
      key: "camera",
      label: "Ambil foto",
      icon: CameraIcon,
      onPress: () => {
        // TODO: buka expo-camera untuk mengambil foto dari kamera
        // Implementasi:
        //   1. Camera.requestCameraPermissionsAsync()
        //   2. Tampilkan Camera component
        //   3. takePictureAsync() → simpan URI
        //   4. Upload ke api.users.uploadAvatarDirect(formData)
        //   5. Confirm: api.users.confirmAvatar({ avatarKey })
      },
      disabled: true, // Image picker belum terpasang
    },
    {
      key: "gallery",
      label: "Pilih dari galeri",
      icon: PencilSimple,
      onPress: () => {
        // TODO: buka expo-image-picker untuk memilih foto dari galeri
        // Implementasi:
        //   1. ImagePicker.launchImageLibraryAsync()
        //   2. Upload ke api.users.uploadAvatarDirect(formData)
        //   3. Confirm: api.users.confirmAvatar({ avatarKey })
      },
      disabled: true, // Image picker belum terpasang
    },
  ]

  // ── Tampilan Form ──────────────────────────────────────────────
  return (
    <Screen padded={false} edges={["top"]}>
      <Header title="Setup Profil" safeArea={false} showBack={false} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="grow px-6 pb-8 pt-8"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <VStack gap={8}>
          {/* Welcome greeting */}
          <VStack gap={2}>
            <Heading level={1} className="text-balance">
              {firstName ? `Selamat datang, ${firstName}!` : "Selamat datang!"}
            </Heading>
            <Text variant="body" tone="secondary" className="text-pretty">
              Lengkapi profil Anda agar orang lain bisa mengenal Anda.
              Anda bisa mengubah ini nanti di pengaturan.
            </Text>
          </VStack>

          {/* Avatar section */}
          <VStack gap={3} className="items-center">
            <View className="relative">
              <Avatar
                name={fullName || "User"}
                size="xl"
              />
              {/* Camera overlay button */}
              <View className="absolute -bottom-1 -right-1">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-primary">
                  <CameraIcon
                    size={16}
                    color={tokens.colors[mode].primaryForeground}
                    weight="fill"
                  />
                </View>
              </View>
            </View>

            <Button
              variant="secondary"
              size="sm"
              onPress={() => setAvatarSheetOpen(true)}
            >
              Unggah foto
            </Button>

            <Text variant="caption" tone="tertiary" className="text-center">
              Fitur unggah foto akan segera hadir
            </Text>
          </VStack>

          {/* Bio section */}
          <VStack gap={3}>
            <TextArea
              label="Tentang Anda"
              value={bio}
              onChangeText={handleBioChange}
              maxLength={500}
              rows={4}
              placeholder="Ceritakan sedikit tentang diri Anda, minat, atau bisnis Anda..."
              helperText="Tampil di profil publik Anda"
            />
          </VStack>

          {/* Error alert */}
          {formError ? (
            <Alert
              tone="danger"
              title="Gagal menyimpan"
              onDismiss={() => setFormError(null)}
            >
              {formError}
            </Alert>
          ) : null}
        </VStack>
      </ScrollView>

      {/* Footer */}
      <View
        className="w-full gap-4 border-t border-border bg-background px-6 pt-4"
        style={{ paddingBottom: tokens.space[4] + insets.bottom }}
      >
        <Button
          onPress={() => void handleSave()}
          loading={submitting}
          disabled={!hasChanges}
        >
          Simpan
        </Button>

        <View className="items-center">
          <TextLink onPress={handleSkip} disabled={submitting}>
            Lewati untuk sekarang
          </TextLink>
        </View>
      </View>

      {/* ActionSheet untuk avatar */}
      <ActionSheet
        visible={avatarSheetOpen}
        onRequestClose={() => setAvatarSheetOpen(false)}
        title="Foto profil"
        description="Pilih cara untuk mengunggah foto profil Anda"
        actions={avatarActions}
      />
    </Screen>
  )
}
