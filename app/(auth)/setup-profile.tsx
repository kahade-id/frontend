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
 *   Setelah simpan/lewati → langsung ke Beranda (U5-003: layar welcome
 *   dihapus; rationale izin notifikasi menjadi bottom sheet di feed).
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
 *   - FE-106: tombol back ADA, tapi tujuannya memperbaiki data via
 *     ROUTES.editProfile — BUKAN mundur ke wizard registrasi (screen #5 sudah
 *     submit ke server; kembali ke sana berisiko submit registrasi ulang).
 *     Satu-satunya jalan keluar lain adalah "Lewati" (footer) atau "Simpan".
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
import { useCallback, useEffect, useRef, useState } from "react"
import { ScrollView, View } from "react-native"
import { Redirect, useRouter } from "expo-router"
import { Camera as CameraIcon, PencilSimple } from "phosphor-react-native"

import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet"
import { FadeIn } from "@/components/ui/fade-in"
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
import { uploadMessage } from "@/lib/upload-errors"
import { validateAvatarAsset } from "@/lib/photo-upload-guards"
import { ProgressBar } from "@/components/ui/progress-bar"
import { clearRegistrationState, getRegistrationState } from "@/lib/registration"
import { hasProfileChanges } from "@/lib/auth-ui"
import { useLeaveConfirm } from "@/lib/use-leave-confirm"
import { Dialog } from "@/components/ui/modal"
import { pickImage, pickedImageToFormData, resizePickedImage, type PickedImage, type PickImageOptions } from "@/lib/image-picker"
import { AuthFlowLoading } from "@/lib/auth-flow-gate"
import { ROUTES } from "@/lib/routes"
import { resolvePostLoginTarget } from "@/lib/login-redirect"
import { translate } from "@/lib/i18n/translate"

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
  // Audit 2026-10-09 (C5/D2): progress byte jujur 0–1 + batalkan per file.
  const [avatarProgress, setAvatarProgress] = useState(0)
  const avatarAbortRef = useRef<AbortController | null>(null)

  // UI-A003: upload avatar non-blocking dan langsung tersimpan di server,
  // jadi foto yang terunggah dihitung sebagai perubahan — pengguna yang
  // hanya menambah foto tetap bisa memakai CTA utama "Simpan".
  const hasChanges = hasProfileChanges(bio, avatarUrl)

  // A06 (batch 139): "Lewati" membuang bio/foto yang belum disimpan —
  // konfirmasi hanya bila ada perubahan.
  const doSkip = useCallback(async () => {
    clearRegistrationState()
    // U5-003 (journey): layar welcome dihapus — langsung ke tujuan/Beranda.
    router.replace((await resolvePostLoginTarget()) as never)
  }, [router])
  // FE-106: tombol back memakai guard yang SAMA dengan "Lewati" — konfirmasi
  // bila bio/foto berubah, tapi tujuannya ROUTES.editProfile (perbaiki data),
  // bukan mundur ke wizard registrasi. Registration state TIDAK dibersihkan
  // (akun sudah tercipta; user hanya pindah ke layar Ubah Profil normal).
  // Didefinisikan SEBELUM useLeaveConfirm karena dipakai di onBackDiscard.
  const [backConfirmOpen, setBackConfirmOpen] = useState(false)
  const handleBack = useCallback(() => {
    if (hasChanges) setBackConfirmOpen(true)
    else router.push(ROUTES.editProfile)
  }, [hasChanges, router])
  const leaveConfirm = useLeaveConfirm(hasChanges && !submitting, {
    title: "Lewati setup profil?",
    description:
      "Foto dan bio yang belum disimpan akan hilang. Anda bisa melengkapinya nanti dari Ubah Profil.",
    confirmLabel: "Ya, lewati",
    onConfirmDiscard: doSkip,
    // P1-A3: hardware back = seperti tombol back header (ke Ubah Profil),
    // bukan "Lewati" (ke Beranda).
    onBackDiscard: handleBack,
  })

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

      // Sukses: bersihkan state registrasi lalu langsung ke tujuan/Beranda
      // (U5-003: layar welcome dihapus).
      // A06: simpan sukses = keluar yang disengaja.
      leaveConfirm.markLeaving()
      clearRegistrationState()
      router.replace((await resolvePostLoginTarget()) as never)
    } catch (err) {
      if (isApiError(err)) {
        // Error validasi bio → tampilkan di form.
        // T4-007: JANGAN err.message mentah (bisa Inggris dari
        // class-validator). `raw` hanya untuk klasifikasi, tidak dirender:
        // bila menyebut bio/panjang → pesan spesifik; sisanya fail-closed.
        if (err.code === "VALIDATION" || err.code === "BAD_REQUEST") {
          const raw = (err.validationMessages ?? [err.message ?? ""]).join(" ")
          setFormError(
            /bio|panjang|karakter|length|max/i.test(raw)
              ? "Bio terlalu panjang. Maksimal 500 karakter."
              : userMessage(err),
          )
          return
        }
      }
      setFormError(userMessage(err))
    } finally {
      setSubmitting(false)
    }
  }, [submitting, bio, router, leaveConfirm])

  // A06: "Lewati" meminta konfirmasi hanya bila ada perubahan belum
  // tersimpan; bila bersih langsung lewati.
  const handleSkip = useCallback(() => {
    if (hasChanges) leaveConfirm.showConfirm()
    else doSkip()
  }, [hasChanges, leaveConfirm, doSkip])

  const confirmBack = useCallback(() => {
    setBackConfirmOpen(false)
    router.push(ROUTES.editProfile)
  }, [router])

  // ── Upload avatar ──────────────────────────────────────────────────
  const uploadAvatar = useCallback(async (asset: PickedImage) => {
    // UMD-004: guard klien — tolak >2 MB / MIME tak didukung SEBELUM upload
    // (pola sama dengan useAvatarUpload); layar ini dulunya tidak memvalidasi.
    const guardError = validateAvatarAsset(asset)
    if (guardError) {
      setAvatarError(guardError)
      return
    }
    setAvatarUploading(true)
    setAvatarError(null)
    setAvatarProgress(0)
    const controller = new AbortController()
    avatarAbortRef.current = controller
    try {
      // Langkah 1: POST /v1/users/me/avatar/direct (multipart)
      // PERF-FIX (2026-09-30): resize avatar sebelum upload (fail-open).
      // Audit 2026-10-09 (B2): dulu TANPA timeoutMs (deadline 20 dtk global
      // membunuh avatar di 4G lambat). Kini `fileBytes` memicu timeout
      // adaptif di transport + progress byte jujur + batalkan per file.
      const resized = await resizePickedImage(asset)
      const uploaded = await api.users.uploadAvatarDirect(await pickedImageToFormData(resized), {
        fileBytes: resized.size,
        onProgress: setAvatarProgress,
        signal: controller.signal,
      })
      // Langkah 2: POST /v1/users/me/avatar/confirm — hanya bila server
      // mengembalikan avatarKey (kontrak ConfirmAvatarDto).
      if (uploaded.avatarKey) {
        await api.users.confirmAvatar({ avatarKey: uploaded.avatarKey })
      }
      if (uploaded.avatarUrl) setAvatarUrl(uploaded.avatarUrl)
    } catch (err) {
      // Audit 2026-10-09 (D2): user membatalkan → tanpa error.
      if (isApiError(err) && err.code === "ABORTED") return
      // Audit 2026-10-09 (A1): uploadMessage — 413 "maks 2 MB", timeout
      // "koneksi lambat", offline hanya bila NetInfo memverifikasi.
      setAvatarError(uploadMessage(err, { purpose: "AVATAR" }))
    } finally {
      avatarAbortRef.current = null
      setAvatarUploading(false)
      setAvatarProgress(0)
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
  // JANGAN blank selagi token sesi dibaca (audit layar blank 2026-10-01):
  // keadaan "belum tahu" butuh UI loading, bukan layar kosong.
  if (hasToken === null) return <AuthFlowLoading label="Menyiapkan profil…" />
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
    <Screen padded={false} edges={["top"]} keyboardAvoiding>
      {/*
       * FE-106: tombol back KEMBALI, tapi tujuannya memperbaiki data via
       * ROUTES.editProfile — BUKAN mundur ke wizard registrasi (akun sudah
       * tercipta; submit ulang berisiko). Guard konfirmasi perubahan
       * bio/foto memakai pola yang sama dengan "Lewati" (handleBack).
       */}
      <Header
        title="Setup Profil"
        safeArea={false}
        onBack={handleBack}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="grow px-5 pb-8 pt-8"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* v2: form reveal satu kesatuan (fast) — pola yang sama di semua
            layar auth; FooterBar di bawah tetap statis. */}
        <FadeIn duration="fast">
        <VStack gap={8}>
          {/* Welcome greeting */}
          <VStack gap={2}>
            <Heading level={1} className="text-balance">
              {firstName ? translate("Selamat datang, {x}!", { x: firstName }) : "Selamat datang!"}
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

            <Button
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
              // Audit 2026-10-09 (C5/D2): progress byte JUJUR + batalkan.
              <View className="w-44 items-center gap-1.5">
                <ProgressBar
                  size="sm"
                  className="w-full"
                  value={Math.round(avatarProgress * 100)}
                  accessibilityLabel="Mengunggah foto profil"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => avatarAbortRef.current?.abort()}
                >
                  Batalkan unggahan
                </Button>
              </View>
            ) : avatarUrl ? (
              <Text variant="caption" tone="success" className="text-center">
                Foto profil berhasil diperbarui
              </Text>
            ) : null}
            {/*
             * FE-IMP-3 #118 — upload gagal tidak memblokir alur: tegaskan foto
             * bisa ditambahkan nanti dari Ubah Profil.
             */}
            {avatarError ? (
              <Text variant="caption" tone="secondary" className="text-center">
                Foto bisa ditambahkan nanti dari Ubah Profil.
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
        </FadeIn>
      </ScrollView>

      {/* Footer */}
      <FooterBar>
        <Button
          onPress={() => void handleSave()}
          loading={submitting}
          disabled={!hasChanges || avatarUploading}
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

      {/* A06: dialog konfirmasi "Lewati" — hanya bila ada perubahan */}
      <Dialog {...leaveConfirm.dialogProps} />

      {/* FE-106: dialog konfirmasi back — hanya bila bio/foto berubah. */}
      <Dialog
        visible={backConfirmOpen}
        onRequestClose={() => setBackConfirmOpen(false)}
        title="Kembali tanpa menyimpan?"
        description="Foto dan bio yang belum disimpan akan hilang. Anda bisa melengkapinya nanti dari Ubah Profil."
        cancelLabel="Batal"
        confirmLabel="Ya, kembali"
        onConfirm={confirmBack}
      />
    </Screen>
  )
}