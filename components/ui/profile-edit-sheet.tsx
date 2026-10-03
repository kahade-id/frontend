/**
 * Kahade — <ProfileEditSheet> (item 22, 2026-09-28).
 *
 * Edit profil INLINE lewat bottom sheet — tanpa pindah halaman. Mencakup
 * field yang paling sering diubah: foto profil, nama lengkap, username, bio.
 * Field sensitif/kompleks (email akun, HP, kontak publik, tautan sosial)
 * tetap di layar edit lengkap (`app/edit-profile.tsx`, dibuka lewat link
 * "Ubah lengkap" di sheet ini).
 *
 * API: PUT /v1/users/me (partial, `api.users.updateProfile`) — hanya field
 * yang berubah yang dikirim. Foto diunggah langsung saat dipilih
 * (POST /v1/users/me/avatar/direct + confirm), pola yang sama dengan layar
 * edit lengkap: foto bukan bagian dto profil.
 *
 * Validasi & error state:
 *   - Nama: 2–60 karakter (inline error).
 *   - Username: format lokal via <UsernameField> + cek ketersediaan server
 *     (debounce, hanya bila berubah); username hanya bisa diganti sekali
 *     sebulan — bila backend menolak, error server ditampilkan inline.
 *   - Bio: ≤500 karakter (counter).
 *   - Error simpan: inline <Alert> di sheet (bukan cuma toast) + toast.
 *   - Username yang berubah butuh `currentPassword` (kontrak DTO): diminta
 *     lewat <Dialog> kecil di dalam sheet — konsisten dengan layar lengkap.
 */
import { Camera as CameraIcon, Images, PencilSimple, Trash } from "phosphor-react-native"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View } from "react-native"
import { router } from "expo-router"

import { api, userMessage, type UpdateProfileDto } from "@/lib/api"
import { translate, useLanguage } from "@/lib/i18n"
import { ROUTES } from "@/lib/routes"
import { useAvatarUpload } from "@/lib/use-avatar-upload"

import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet"
import { AvatarPreviewDialog } from "@/components/ui/avatar-preview-dialog"
import { Alert } from "@/components/ui/alert"
import { Avatar } from "@/components/ui/avatar"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { Field } from "@/components/ui/field"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { PasswordField } from "@/components/ui/password-field"
import { ProgressBar } from "@/components/ui/progress-bar"
import { TextArea } from "@/components/ui/text-area"
import { Text } from "@/components/ui/text"
import { UsernameField, type UsernameAvailability } from "@/components/ui/username-field"
import { useToast } from "@/components/ui/toast"

export type ProfileEditSheetProfile = {
  fullName?: string | null
  username?: string | null
  bio?: string | null
  avatarUrl?: string | null
}

export type ProfileEditSheetProps = {
  visible: boolean
  onRequestClose: () => void
  profile: ProfileEditSheetProfile
  /** Dipanggil setelah simpan sukses — parent me-refresh profil. */
  onSaved: () => void
}

export function ProfileEditSheet({ visible, onRequestClose, profile, onSaved }: ProfileEditSheetProps) {
  useLanguage()
  const toast = useToast()

  const [fullName, setFullName] = useState("")
  const [username, setUsername] = useState("")
  const [bio, setBio] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [usernameAvailability, setUsernameAvailability] = useState<UsernameAvailability>("idle")
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | undefined>()
  // Baseline perbandingan — diisi saat sheet dibuka (bukan saat profile
  // berubah di background: menimpa ketikan user lebih buruk).
  const baselineRef = useRef<ProfileEditSheetProfile>({})

  useEffect(() => {
    if (!visible) return
    baselineRef.current = {
      fullName: profile.fullName ?? "",
      username: profile.username ?? "",
      bio: profile.bio ?? "",
      avatarUrl: profile.avatarUrl ?? null,
    }
    setFullName(profile.fullName ?? "")
    setUsername(profile.username ?? "")
    setBio(profile.bio ?? "")
    setAvatarUrl(profile.avatarUrl ?? null)
    setFormError(null)
    setUsernameAvailability("idle")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  // Cek ketersediaan username — pola yang sama dengan app/edit-profile.tsx.
  useEffect(() => {
    if (!visible) return
    const next = username.trim()
    const initial = (baselineRef.current.username ?? "").trim()
    if (!next || next === initial) {
      setUsernameAvailability("idle")
      return
    }
    if (next.length < 3 || next.length > 30 || !/^[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])?$/.test(next)) {
      setUsernameAvailability("idle")
      return
    }
    const controller = new AbortController()
    setUsernameAvailability("checking")
    const timer = setTimeout(() => {
      void api.users
        .checkUsernameAvailability(next, controller.signal)
        .then((available) => setUsernameAvailability(available ? "available" : "taken"))
        .catch(() => setUsernameAvailability("idle"))
    }, 450)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [username, visible])

  // ── Validasi inline ──────────────────────────────────────────────
  const nameError = useMemo(() => {
    const v = fullName.trim()
    if (v.length === 0) return translate("Nama wajib diisi.")
    if (v.length < 2) return translate("Nama minimal 2 karakter.")
    return null
  }, [fullName])

  const usernameChanged = username.trim() !== (baselineRef.current.username ?? "").trim()

  const dto = useMemo<UpdateProfileDto>(() => {
    const d: UpdateProfileDto = {}
    const base = baselineRef.current
    if (fullName.trim() !== (base.fullName ?? "")) d.fullName = fullName.trim()
    if (username.trim() !== (base.username ?? "")) d.username = username.trim()
    if (bio.trim() !== (base.bio ?? "")) d.bio = bio.trim()
    return d
  }, [fullName, username, bio])
  const dirty = Object.keys(dto).length > 0

  const save = useCallback(
    async (password?: string) => {
      if (nameError) {
        setFormError(nameError)
        return
      }
      if (usernameChanged && usernameAvailability !== "available") {
        setFormError(
          usernameAvailability === "checking"
            ? translate("Tunggu pemeriksaan nama pengguna selesai.")
            : translate("Nama pengguna tidak tersedia. Pilih yang lain."),
        )
        return
      }
      setSubmitting(true)
      setFormError(null)
      setPasswordError(undefined)
      try {
        await api.users.updateProfile(
          password ? { ...dto, currentPassword: password } : dto,
        )
        setPasswordOpen(false)
        setCurrentPassword("")
        toast.show({ title: translate("Profil diperbarui"), tone: "success" })
        onSaved()
        onRequestClose()
      } catch (err: unknown) {
        const message = userMessage(err)
        if (password) {
          setPasswordError(translate("Kata sandi salah atau perubahan ditolak."))
        } else {
          setFormError(translate("Gagal menyimpan: {x}", { x: message }))
        }
        // B3O-23: error juga lewat toast global — tetap terlihat walau
        // pengguna menutup sheet tepat setelah simpan gagal (formError
        // hanya tampil di dalam sheet).
        toast.show({ title: translate("Gagal menyimpan profil"), description: message, tone: "danger" })
      } finally {
        setSubmitting(false)
      }
    },
    [dto, nameError, onRequestClose, onSaved, toast.show, usernameAvailability, usernameChanged],
  )

  const handleSubmit = useCallback(() => {
    if (!dirty || submitting) return
    if (usernameChanged) {
      setCurrentPassword("")
      setPasswordError(undefined)
      setPasswordOpen(true)
      return
    }
    void save()
  }, [dirty, submitting, usernameChanged, save])

  // ── Foto profil (diunggah langsung, bukan bagian dto) ─────────────
  // Item 66 (mega-batch 2026-09-28): progress bar saat mengunggah + tombol
  // "Coba lagi" saat gagal, via hook terpadu useAvatarUpload.
  const avatar = useAvatarUpload({ onAvatarUrl: setAvatarUrl, onChanged: onSaved })

  const avatarActions: ActionSheetItem[] = [
    {
      key: "camera",
      label: translate("Ambil foto"),
      icon: CameraIcon,
      onPress: () => void avatar.upload("camera"),
    },
    {
      key: "gallery",
      label: translate("Pilih dari galeri"),
      icon: Images,
      onPress: () => void avatar.upload("library"),
    },
    ...(avatarUrl
      ? [
          {
            key: "remove",
            label: translate("Hapus foto"),
            icon: Trash,
            destructive: true,
            onPress: () => void avatar.remove(),
          } satisfies ActionSheetItem,
        ]
      : []),
  ]

  return (
    <>
      <BottomSheet
        // B3O-01 (§9.9): sheet edit disembunyikan selama ActionSheet
        // "Foto profil" terbuka — tidak ada dua sheet co-visible.
        visible={visible && !avatarSheetOpen}
        // B3O-23: telan tutup saat menyimpan (guard ala PIN sheet
        // transfer/withdraw) — error simpan hanya tampil di dalam sheet.
        onRequestClose={() => {
          if (submitting) {
            toast.show({ title: translate("Tunggu sebentar, masih memproses…"), tone: "info" })
            return
          }
          onRequestClose()
        }}
        title={translate("Ubah profil")}
        avoidKeyboard
        footer={
          <View className="gap-2">
            <Button
              fullWidth
              loading={submitting}
              disabled={!dirty || !!nameError}
              onPress={handleSubmit}
            >
              {translate("Simpan perubahan")}
            </Button>
            <Button
              fullWidth
              variant="ghost"
              leftIcon={PencilSimple}
              onPress={() => {
                onRequestClose()
                router.push(ROUTES.editProfile)
              }}
            >
              {translate("Ubah lengkap")}
            </Button>
          </View>
        }
      >
        <View className="gap-4 px-5 pb-2">
          {formError ? (
            <Alert tone="danger" title={translate("Tidak bisa menyimpan")}>
              {formError}
            </Alert>
          ) : null}

          <View className="items-center">
            <View className="relative">
              <Avatar
                source={avatarUrl ? { uri: avatarUrl } : undefined}
                name={fullName || undefined}
                size="xl"
              />
              <View className="absolute -bottom-1 -right-1">
                <IconButton
                  icon={CameraIcon}
                  variant="primary"
                  size="sm"
                  shape="pill"
                  accessibilityLabel={translate("Ubah foto profil")}
                  loading={avatar.busy}
                  disabled={avatar.busy}
                  onPress={() => setAvatarSheetOpen(true)}
                />
              </View>
            </View>
            {/* Item 66 (2026-09-28): progress saat mengunggah + error inline
                dengan tombol "Coba lagi" (tanpa pilih ulang foto). */}
            {avatar.busy ? (
              <View className="w-44 gap-1.5 pt-3">
                <ProgressBar size="sm" accessibilityLabel={translate("Mengunggah foto profil")} />
                <Text variant="caption" tone="secondary" className="text-center">
                  {translate("Mengunggah foto…")}
                </Text>
              </View>
            ) : null}
            {avatar.error && !avatar.busy ? (
              <View className="items-center gap-1.5 pt-3">
                <Text variant="caption" tone="danger" className="text-center">
                  {avatar.error}
                </Text>
                <Button size="sm" variant="secondary" fullWidth={false} onPress={() => void avatar.retry()}>
                  {translate("Coba lagi")}
                </Button>
              </View>
            ) : null}
          </View>

          <Field
            label={translate("Nama lengkap")}
            required
            errorText={fullName.length > 0 ? (nameError ?? undefined) : undefined}
          >
            <Input
              value={fullName}
              onChangeText={setFullName}
              maxLength={60}
              placeholder={translate("Nama lengkap Anda")}
              autoComplete="name"
              textContentType="name"
              autoCapitalize="words"
              returnKeyType="next"
            />
          </Field>

          <UsernameField
            value={username}
            onChangeText={setUsername}
            availability={usernameAvailability}
            helperText={translate("Hanya bisa diganti sekali per bulan.")}
          />

          <Field label={translate("Bio")}>
            <TextArea
              value={bio}
              onChangeText={setBio}
              maxLength={500}
              showCount
              numberOfLines={4}
              placeholder={translate("Ceritakan tentang Anda")}
            />
          </Field>

          <Text variant="caption" tone="secondary" className="text-center">
            {translate("Email, nomor HP, kontak publik, dan tautan sosial diubah di Edit lengkap.")}
          </Text>
        </View>
      </BottomSheet>

      <ActionSheet
        visible={avatarSheetOpen}
        title={translate("Foto profil")}
        actions={avatarActions}
        onRequestClose={() => setAvatarSheetOpen(false)}
      />

      {/* Batch 139 E02: pratinjau lingkaran + batas aman sebelum upload avatar. */}
      <AvatarPreviewDialog
        asset={avatar.preview}
        busy={avatar.busy}
        onConfirm={() => void avatar.confirmPreview()}
        onCancel={avatar.cancelPreview}
      />

      {/* Username berubah → kontrak DTO butuh currentPassword. */}
      <Dialog
        title={translate("Konfirmasi kata sandi")}
        description={translate("Mengganti username membutuhkan kata sandi akun.")}
        visible={passwordOpen}
        loading={submitting}
        confirmLabel={translate("Simpan")}
        cancelLabel={translate("Batal")}
        confirmButtonProps={{ disabled: !currentPassword }}
        onConfirm={() => void save(currentPassword)}
        onCancel={() => setPasswordOpen(false)}
        onRequestClose={() => setPasswordOpen(false)}
      >
        <PasswordField
          label={translate("Kata sandi akun")}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          errorText={passwordError}
          required
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => currentPassword && void save(currentPassword)}
        />
      </Dialog>
    </>
  )
}
