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
 *   [Button "Unggah foto" secondary sm] → ActionSheet (kamera / galeri)
 *   <TextArea "Tentang Anda"> (max 500 char)
 *   ── footer: [Lewati]  •  [Simpan]
 *
 *   Setelah simpan/lewati → Welcome screen (`ROUTES.welcome({ newUser: true })`)
 *   yang menyapa user baru dan meminta izin kamera/notifikasi/biometrik.
 *
 * Kontrak API (docs/api/kahade-api-mobile.json):
 *   PUT /v1/users/me  body UpdateProfileDto { bio: string (max 500) }
 *   - auth: required (Bearer token dari phone-register)
 *   - Hanya field `bio` yang dikirim; field lain tidak diubah di screen ini.
 *
 *   Avatar upload:
 *   - POST /v1/users/me/avatar/direct (multipart, field `file`)
 *     → POST /v1/users/me/avatar/confirm { avatarKey }
 *   - lib/image-picker (kamera / galeri, izin, FormData) + ActionSheet —
 *     error ditangani di screen; upload tidak memblokir tombol Simpan/Lewati.
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
 *     "Ambil foto" (kamera) & "Pilih dari galeri" memakai expo-image-picker;
 *     izin diminta hanya di native. Upload gagal tidak menggagalkan alur —
 *     user tetap bisa Lewati/Simpan bio.
 *   - Setelah "Simpan"/"Lewati" → Welcome screen memberi closure untuk seluruh
 *     alur registrasi. Registration state dibersihkan DI SINI (password & PIN
 *     tidak boleh hidup lebih lama dari yang diperlukan), dan fakta "user
 *     baru" diteruskan lewat route param, bukan lewat state itu.
 *   - Bio field auto-trim whitespace di ujung (sama seperti EmailField) —
 *     sumber umum bio yang terlihat aneh di profil.
 *   - Tombol "Simpan" disabled saat bio kosong DAN tidak ada perubahan dari
 *     state awal — mencegah submit kosong yang tidak bermakna.
 *   - "Lewati untuk sekarang" = TextLink (bukan Button ghost): ini navigasi
 *     keluar, bukan aksi. Konsisten dengan pola TextLink di Onboarding.
 */
import { useCallback, useEffect, useState } from "react"
import { ScrollView, View } from "react-native"
import { Redirect, useRouter } from "expo-router"
import { Camera as CameraIcon, PencilSimple } from "phosphor-react-native"

import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet"
import { FooterBar } from "@/components/ui/footer-bar"
import { Alert } from "@/components/ui/alert"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { IconButton } from "@/components/ui/icon-button"
import { Screen } from "@/components/ui/screen"
import { TextArea } from "@/components/ui/text-area"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { VStack } from "@/components/ui/stack"
import { api, getAccessToken, isApiError, userMessage } from "@/lib/api"
import { clearRegistrationState, getRegistrationState } from "@/lib/registration"
import { pickImage, pickedImageToFormData, type PickedImage, type PickImageOptions } from "@/lib/image-picker"
import { ROUTES } from "@/lib/routes"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

/** Crop persegi + kompresi avatar sebelum upload (§9.19: klien mengirim JPG/PNG). */
const AVATAR_PICKER: PickImageOptions = { square: true }

export default function SetupProfileScreen() {
  const router = useRouter()
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

  // Avatar sheet + upload state
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

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

      // Sukses: bersihkan state registrasi dan tampilkan welcome.
      // `newUser` dibawa lewat param — welcome tidak bisa membaca state yang
      // baru saja dibersihkan.
      clearRegistrationState()
      router.replace(ROUTES.welcome({ newUser: true }))
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
  }, [submitting, bio, router])

  const handleSkip = useCallback(() => {
    clearRegistrationState()
    router.replace(ROUTES.welcome({ newUser: true }))
  }, [router])

  // ── Upload avatar ──────────────────────────────────────────────────
  const uploadAvatar = useCallback(async (asset: PickedImage) => {
    setAvatarUploading(true)
    setAvatarError(null)
    try {
      // Langkah 1: POST /v1/users/me/avatar/direct (multipart)
      const uploaded = await api.users.uploadAvatarDirect(await pickedImageToFormData(asset))
      // Langkah 2: POST /v1/users/me/avatar/confirm — hanya bila server
      // mengembalikan avatarKey (kontrak ConfirmAvatarDto).
      if (uploaded.avatarKey) {
        await api.users.confirmAvatar({ avatarKey: uploaded.avatarKey })
      }
      if (uploaded.avatarUrl) setAvatarUrl(uploaded.avatarUrl)
    } catch (err) {
      setAvatarError(isApiError(err) ? userMessage(err) : "Gagal mengunggah foto. Coba lagi.")
    } finally {
      setAvatarUploading(false)
    }
  }, [])

  const pickFromCamera = useCallback(async () => {
    const picked = await pickImage({ ...AVATAR_PICKER, source: "camera" })
    if (picked.status === "denied") {
      setAvatarError("Izin kamera ditolak. Aktifkan di pengaturan perangkat.")
      return
    }
    if (picked.status === "picked") await uploadAvatar(picked.asset)
  }, [uploadAvatar])

  const pickFromGallery = useCallback(async () => {
    const picked = await pickImage({ ...AVATAR_PICKER, source: "library" })
    if (picked.status === "denied") {
      setAvatarError("Izin galeri ditolak. Aktifkan di pengaturan perangkat.")
      return
    }
    if (picked.status === "picked") await uploadAvatar(picked.asset)
  }, [uploadAvatar])

  // ── Guard dijalankan SETELAH semua hook (Rules of Hooks) ───────────
  // Versi sebelumnya `return null` di antara useState dan useCallback →
  // "Rendered more hooks than during the previous render" saat token terbaca.
  if (hasToken === null) return null
  if (!hasToken) return <Redirect href={ROUTES.login} />

  // ActionSheet items untuk avatar
  const avatarActions: readonly ActionSheetItem[] = [
    {
      key: "camera",
      label: "Ambil foto",
      icon: CameraIcon,
      onPress: () => {
        setAvatarSheetOpen(false)
        void pickFromCamera().catch(() => setAvatarError("Gagal membuka kamera. Coba lagi."))
      },
      disabled: avatarUploading,
    },
    {
      key: "gallery",
      label: "Pilih dari galeri",
      icon: PencilSimple,
      onPress: () => {
        setAvatarSheetOpen(false)
        void pickFromGallery().catch(() => setAvatarError("Gagal membuka galeri. Coba lagi."))
      },
      disabled: avatarUploading,
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
            <Text numberOfLines={1} variant="body" tone="secondary" className="text-pretty">
              Lengkapi profil Anda agar orang lain bisa mengenal Anda.
              Anda bisa mengubah ini nanti di pengaturan.
            </Text>
          </VStack>

          {/* Avatar section */}
          <VStack gap={3} className="items-center">
            <View accessible={false} className="relative">
              <Avatar
                name={fullName || "User"}
                source={avatarUrl ?? undefined}
                size="xl"
              />
              {/* Camera overlay — pakai IconButton sistem (hit target 40+slop,
                  a11y label, loading state) */}
              <View className="absolute -bottom-1 -right-1">
                <IconButton
                  icon={CameraIcon}
                  variant="primary"
                  size="sm"
                  shape="pill"
                  accessibilityLabel="Unggah foto profil"
                  loading={avatarUploading}
                  disabled={avatarUploading}
                  onPress={() => setAvatarSheetOpen(true)}
                />
              </View>
            </View>

            <Button accessibilityHint="Ketuk untuk berinteraksi"
              variant="secondary"
              size="sm"
              loading={avatarUploading}
              disabled={avatarUploading}
              onPress={() => setAvatarSheetOpen(true)}
            >
              Unggah foto
            </Button>

            {avatarError ? (
              <Text variant="caption" tone="danger" className="text-center">
                {avatarError}
              </Text>
            ) : avatarUploading ? (
              <Text variant="caption" tone="secondary" className="text-center">
                Mengunggah foto…
              </Text>
            ) : avatarUrl ? (
              <Text variant="caption" tone="success" className="text-center">
                Foto profil berhasil diperbarui
              </Text>
            ) : null}
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
      <FooterBar>
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
      </FooterBar>

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