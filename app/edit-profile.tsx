/**
 * Screen — Edit Profil.
 *
 * Endpoint:
 *   GET/PUT /v1/users/me                 profil (UpdateProfileDto, partial)
 *   GET/PUT /v1/users/me/links           tautan sosial (PUT mengganti semua)
 *   POST    /v1/users/me/avatar/direct   unggah foto (multipart `file`)
 *   POST    /v1/users/me/avatar/confirm  bila server mengembalikan avatarKey
 *   DELETE  /v1/users/me/avatar          hapus foto → kembali ke inisial
 *   POST    /v1/users/me/header/direct   unggah foto sampul (header image)
 *   POST    /v1/users/me/header/confirm  bila server mengembalikan headerKey
 *   DELETE  /v1/users/me/header          hapus foto sampul
 *
 * Keputusan non-obvious:
 *   - Email AKUN (`me.email`) bersifat read-only di sini: mengubahnya adalah
 *     alur verifikasi terpisah (correct-email/verify-email). Yang bisa diedit
 *     adalah `contactEmail`/`contactPhone` (kontak PUBLIK di profil) + toggle
 *     tampil/sembunyi — sesuai field UpdateProfileDto. Nomor HP akun
 *     (`phoneNumber`) dikirim sebagai `phoneNumber`.
 *   - Hanya field yang BERUBAH yang dikirim (dto partial): username hanya
 *     boleh diganti sekali sebulan, jadi mengirim username lama setiap simpan
 *     berisiko ditolak backend.
 *   - Username/phone/kontak butuh `currentPassword` (komentar DTO). Password
 *     diminta lewat Dialog HANYA bila salah satu field itu berubah — bukan
 *     setiap simpan.
 *   - Tautan disimpan dengan PUT terpisah setelah profil sukses; kegagalannya
 *     dilaporkan sendiri agar pengguna tahu bagian mana yang belum tersimpan.
 *   - Avatar diunggah langsung saat dipilih (tidak menunggu "Simpan") — pola
 *     yang sama dengan Setup Profil; foto bukan bagian dari dto profil.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import { router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Camera as CameraIcon, Image as ImageIcon, Images, Trash } from "phosphor-react-native"

import { api, type UpdateProfileDto, userMessage } from "@/lib/api"
import { pickImage, pickedImageToFormData, type PickImageOptions } from "@/lib/image-picker"
import { goBackOrNavigate } from "@/lib/navigation"
import { resolveMediaUrl } from "@/lib/media"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import type { UserLinkItemDto } from "@/lib/api/types"
import { useApiQuery } from "@/lib/use-api-query"

import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet"
import { Alert } from "@/components/ui/alert"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { EmailField } from "@/components/ui/email-field"
import { ErrorState } from "@/components/ui/error-state"
import { Field } from "@/components/ui/field"
import { FormSection } from "@/components/ui/form-section"
import { Header } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { PasswordField } from "@/components/ui/password-field"
import { normalizePhoneId, PhoneInput, toE164Id } from "@/components/ui/phone-input"
import { Picture } from "@/components/ui/picture"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { Skeleton } from "@/components/ui/skeleton"
import { SocialLinksEditor, type SocialLink } from "@/components/ui/social-links-editor"
import { Text } from "@/components/ui/text"
import { Switch } from "@/components/ui/switch"
import { TextArea } from "@/components/ui/text-area"
import { UsernameField, type UsernameAvailability } from "@/components/ui/username-field"
import { useToast } from "@/components/ui/toast"

const AVATAR_PICKER: PickImageOptions = { square: true }
/** Sampul dipotong melebar (rasio ~2.6:1 di ProfileHeader), bukan persegi. */
const COVER_PICKER: PickImageOptions = { allowsEditing: true, aspect: [16, 6] }
/** Tinggi pratinjau sampul — harus sama dengan COVER_HEIGHT di ProfileHeader. */
const COVER_HEIGHT = 120
const MAX_LINKS = 4

type ProfileForm = {
  fullName: string
  username: string
  bio: string
  phone: string
  contactEmail: string
  contactPhone: string
  showContactEmail: boolean
  showContactPhone: boolean
}

const EMPTY_FORM: ProfileForm = {
  fullName: "",
  username: "",
  bio: "",
  phone: "",
  contactEmail: "",
  contactPhone: "",
  showContactEmail: false,
  showContactPhone: false,
}

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM)
  const [initial, setInitial] = useState<ProfileForm>(EMPTY_FORM)
  const [accountEmail, setAccountEmail] = useState("")
  const [emailVerified, setEmailVerified] = useState<boolean | undefined>(undefined)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [links, setLinks] = useState<SocialLink[]>([])
  const [initialLinks, setInitialLinks] = useState<SocialLink[]>([])
  const [usernameAvailability, setUsernameAvailability] = useState<UsernameAvailability>("idle")

  /**
   * Audit: state async dirakit manual. Cacat terbukti dari kode lama:
   * `handleRefresh` memanggil `fetchProfile()` yang sama dengan muat-awal, dan
   * fungsi itu membuka dengan `setLoading(true)` — tarik-untuk-menyegarkan
   * mengganti seluruh layar profil dengan kerangka. Request juga tidak
   * dibatalkan saat layar ditutup.
   *
   * `.catch(() => [])` pada tautan DIPERTAHANKAN: tautan yang gagal diambil
   * tidak boleh mematikan profil.
   */
  const query = useApiQuery<{
    me: Awaited<ReturnType<typeof api.users.getMe>>
    myLinks: UserLinkItemDto[]
  }>("edit-profile", async (signal) => {
    const [me, myLinks] = await Promise.all([
      api.users.getMe(signal),
      api.users.getLinks(signal).catch(() => [] as UserLinkItemDto[]),
    ])
    return { me, myLinks: myLinks ?? [] }
  })
  const { loading, error, refreshing } = query
  const [submitting, setSubmitting] = useState(false)

  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)

  // Foto sampul (header image) profil — endpoint /v1/users/me/header/*.
  const [headerUrl, setHeaderUrl] = useState<string | null>(null)
  const [headerSheetOpen, setHeaderSheetOpen] = useState(false)
  const [headerBusy, setHeaderBusy] = useState(false)

  const [passwordOpen, setPasswordOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | undefined>()

  const set = useCallback(<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
  }, [])

  /**
   * Pengisian form yang dulu terjadi DI DALAM fetcher dipindah ke effect:
   * semuanya efek samping pada state UI (form, baseline perbandingan, avatar),
   * bukan bagian dari data server.
   *
   * Perilaku DIPERTAHANKAN persis, termasuk sisi yang kurang enak: karena
   * bergantung pada `query.data`, penyegaran mengisi ulang form — sama seperti
   * dulu, ketika `handleRefresh` memanggil `fetchProfile()` yang menimpa
   * `setForm(next)` tanpa syarat. Mengubah itu (mis. hanya isi saat form belum
   * disentuh) adalah perbaikan perilaku tersendiri dan sengaja tidak
   * dicampurkan ke migrasi ini.
   */
  const loaded = query.data
  useEffect(() => {
    if (!loaded) return
    const { me, myLinks } = loaded
    const next: ProfileForm = {
      fullName: me.fullName ?? "",
      username: me.username ?? "",
      bio: me.bio ?? "",
      phone: normalizePhoneId(me.phoneNumber ?? ""),
      contactEmail: me.contactEmail ?? "",
      contactPhone: normalizePhoneId(me.contactPhone ?? ""),
      showContactEmail: me.showContactEmail ?? false,
      showContactPhone: me.showContactPhone ?? false,
    }
    setForm(next)
    setInitial(next)
    setAccountEmail(me.email ?? "")
    setEmailVerified(me.emailVerified)
    setAvatarUrl(me.avatarUrl ?? null)
    setHeaderUrl(me.headerUrl ?? null)
    const sorted = [...myLinks].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    setLinks(sorted)
    setInitialLinks(sorted)
  }, [loaded])

  // Username availability is authenticated by the backend and only needs to
  // run when the username is actually being changed.
  useEffect(() => {
    const username = form.username.trim()
    if (!username || username === initial.username) {
      setUsernameAvailability("idle")
      return
    }
    if (username.length < 3 || username.length > 20 || !/^[a-z0-9](?:[a-z0-9._]{1,18}[a-z0-9])?$/.test(username)) {
      setUsernameAvailability("idle")
      return
    }
    const controller = new AbortController()
    setUsernameAvailability("checking")
    const timer = setTimeout(() => {
      void api.users
        .checkUsernameAvailability(username, controller.signal)
        .then((available) => setUsernameAvailability(available ? "available" : "taken"))
        .catch(() => setUsernameAvailability("idle"))
    }, 450)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [form.username, initial.username])

  // ── Diff → dto partial ─────────────────────────────────────────────────
  const dto = useMemo<UpdateProfileDto>(() => {
    const d: UpdateProfileDto = {}
    const trimmed = {
      fullName: form.fullName.trim(),
      username: form.username.trim(),
      bio: form.bio.trim(),
      contactEmail: form.contactEmail.trim(),
    }
    if (trimmed.fullName !== initial.fullName) d.fullName = trimmed.fullName
    if (trimmed.username !== initial.username) d.username = trimmed.username
    if (trimmed.bio !== initial.bio) d.bio = trimmed.bio
    if (form.phone !== initial.phone) d.phoneNumber = toE164Id(form.phone)
    if (trimmed.contactEmail !== initial.contactEmail) d.contactEmail = trimmed.contactEmail
    if (form.contactPhone !== initial.contactPhone) d.contactPhone = toE164Id(form.contactPhone)
    if (form.showContactEmail !== initial.showContactEmail)
      d.showContactEmail = form.showContactEmail
    if (form.showContactPhone !== initial.showContactPhone)
      d.showContactPhone = form.showContactPhone
    return d
  }, [form, initial])

  const linksChanged = useMemo(
    () => JSON.stringify(links) !== JSON.stringify(initialLinks),
    [links, initialLinks],
  )
  const profileChanged = Object.keys(dto).length > 0
  const dirty = profileChanged || linksChanged
  /** Field sensitif yang menurut kontrak butuh `currentPassword`. */
  const needsPassword =
    dto.username !== undefined ||
    dto.phoneNumber !== undefined ||
    dto.contactEmail !== undefined ||
    dto.contactPhone !== undefined

  const save = useCallback(
    async (password?: string) => {
      if (dto.username !== undefined && usernameAvailability !== "available") {
        toast.show({
          title: usernameAvailability === "checking" ? "Tunggu sebentar" : "Nama pengguna tidak tersedia",
          description:
            usernameAvailability === "checking"
              ? "Kami masih memeriksa nama pengguna tersebut."
              : "Silakan pilih nama pengguna lain.",
          tone: "danger",
        })
        return
      }
      setSubmitting(true)
      setPasswordError(undefined)
      try {
        if (profileChanged) {
          await api.users.updateProfile(password ? { ...dto, currentPassword: password } : dto)
        }
        if (linksChanged) {
          try {
            await api.users.updateLinks({
              links: links.map((l, i) => ({
                platform: l.platform,
                url: l.url,
                label: l.label,
                displayOrder: i,
              })),
            })
          } catch {
            toast.show({
              title: "Profil tersimpan, tautan sosial gagal disimpan",
              description: "Periksa format URL lalu coba simpan lagi.",
              tone: "danger",
            })
            await query.refresh()
            return
          }
        }
        setPasswordOpen(false)
        setCurrentPassword("")
        toast.show({ title: "Profil diperbarui", tone: "success" })
        goBackOrNavigate(ROUTES.settings)
      } catch {
        if (password) {
          setPasswordError("Password salah atau perubahan ditolak.")
        } else {
          toast.show({
            title: "Gagal menyimpan profil",
            description: "Username mungkin sudah dipakai atau baru saja diganti.",
            tone: "danger",
          })
        }
      } finally {
        setSubmitting(false)
      }
    },
    [dto, links, linksChanged, profileChanged, toast.show, usernameAvailability],
  )

  const handleSubmit = useCallback(() => {
    if (!dirty) return
    if (needsPassword) {
      setCurrentPassword("")
      setPasswordError(undefined)
      setPasswordOpen(true)
      return
    }
    void save()
  }, [dirty, needsPassword, save])

  // ── Avatar ─────────────────────────────────────────────────────────────
  const uploadAvatar = useCallback(
    async (source: PickImageOptions["source"]) => {
      const picked = await pickImage({ ...AVATAR_PICKER, source })
      if (picked.status === "denied") {
        toast.show({
          title: source === "camera" ? "Izin kamera ditolak" : "Izin galeri ditolak",
          description: "Aktifkan di pengaturan perangkat.",
          tone: "danger",
        })
        return
      }
      if (picked.status !== "picked") return
      setAvatarBusy(true)
      try {
        const uploaded = await api.users.uploadAvatarDirect(
          await pickedImageToFormData(picked.asset),
        )
        if (uploaded.avatarKey) await api.users.confirmAvatar({ avatarKey: uploaded.avatarKey })
        if (uploaded.avatarUrl) setAvatarUrl(uploaded.avatarUrl)
        toast.show({ title: "Foto profil diperbarui", tone: "success" })
      } catch (err: unknown) {
        toast.show({
          title: "Gagal mengunggah foto",
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        setAvatarBusy(false)
      }
    },
    [toast.show],
  )

  const removeAvatar = useCallback(async () => {
    setAvatarBusy(true)
    try {
      await api.users.deleteAvatar()
      setAvatarUrl(null)
      toast.show({ title: "Foto profil dihapus", tone: "success" })
    } catch (err: unknown) {
      toast.show({ title: "Gagal menghapus foto", description: userMessage(err), tone: "danger" })
    } finally {
      setAvatarBusy(false)
    }
  }, [toast.show])

  const avatarActions: ActionSheetItem[] = [
    {
      key: "camera",
      label: "Ambil foto",
      icon: CameraIcon,
      onPress: () => void uploadAvatar("camera"),
    },
    {
      key: "gallery",
      label: "Pilih dari galeri",
      icon: Images,
      onPress: () => void uploadAvatar("library"),
    },
    ...(avatarUrl
      ? [
          {
            key: "remove",
            label: "Hapus foto",
            icon: Trash,
            destructive: true,
            onPress: () => void removeAvatar(),
          } satisfies ActionSheetItem,
        ]
      : []),
  ]

  // ── Foto sampul (header image) ─────────────────────────────────────────
  /**
   * Pola sama dengan avatar (direct upload → confirm bila server mengembalikan
   * key): sampul bukan bagian dto profil, jadi diunggah saat dipilih dan tidak
   * menunggu tombol "Simpan perubahan".
   */
  const uploadHeader = useCallback(
    async (source: PickImageOptions["source"]) => {
      const picked = await pickImage({ ...COVER_PICKER, source })
      if (picked.status === "denied") {
        toast.show({
          title: source === "camera" ? "Izin kamera ditolak" : "Izin galeri ditolak",
          description: "Aktifkan di pengaturan perangkat.",
          tone: "danger",
        })
        return
      }
      if (picked.status !== "picked") return
      setHeaderBusy(true)
      try {
        const uploaded = await api.users.uploadHeaderDirect(
          await pickedImageToFormData(picked.asset),
        )
        if (uploaded.headerKey) await api.users.confirmHeader({ headerKey: uploaded.headerKey })
        if (uploaded.headerUrl) setHeaderUrl(uploaded.headerUrl)
        toast.show({ title: "Foto sampul diperbarui", tone: "success" })
      } catch (err: unknown) {
        toast.show({
          title: "Gagal mengunggah foto sampul",
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        setHeaderBusy(false)
      }
    },
    [toast.show],
  )

  const removeHeader = useCallback(async () => {
    setHeaderBusy(true)
    try {
      await api.users.deleteHeader()
      setHeaderUrl(null)
      toast.show({ title: "Foto sampul dihapus", tone: "success" })
    } catch (err: unknown) {
      toast.show({
        title: "Gagal menghapus foto sampul",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setHeaderBusy(false)
    }
  }, [toast.show])

  const headerActions: ActionSheetItem[] = [
    {
      key: "camera",
      label: "Ambil foto",
      icon: CameraIcon,
      onPress: () => void uploadHeader("camera"),
    },
    {
      key: "gallery",
      label: "Pilih dari galeri",
      icon: Images,
      onPress: () => void uploadHeader("library"),
    },
    ...(headerUrl
      ? [
          {
            key: "remove",
            label: "Hapus foto sampul",
            icon: Trash,
            destructive: true,
            onPress: () => void removeHeader(),
          } satisfies ActionSheetItem,
        ]
      : []),
  ]

  const coverUri = resolveMediaUrl(headerUrl)

  return (
    <Screen
      edges={["top"]}
      padded={false}
      // 7 field teks + CTA sticky: tanpa ini keyboard iOS menutupi Bio/HP/link
      // sosial dan tombol "Simpan perubahan" sekaligus.
      keyboardAvoiding
      footer={
        <View>
          <Button
            fullWidth
            loading={submitting}
            disabled={loading || !!error || !dirty}
            onPress={handleSubmit}
          >
            Simpan perubahan
          </Button>
        </View>
      }
    >
      <Header title="Edit Profil" />
      <PullToRefresh
        onRefresh={() => void query.refresh()}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
          keyboardShouldPersistTaps: "handled",
        }}
      >
        {error ? (
          <ErrorState
            title="Gagal memuat"
            description={error}
            onRetry={() => void query.reload()}
          />
        ) : loading ? (
          <View className="gap-4 py-4">
            <View className="items-center">
              <Skeleton shape="circle" className="h-20 w-20" />
            </View>
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-24" />
          </View>
        ) : (
          <>
            {/* Foto sampul (header image) */}
            <View className="pt-4">
              <View className="relative w-full overflow-hidden rounded-md border border-border bg-surface">
                {coverUri ? (
                  <Picture
                    source={{ uri: coverUri }}
                    alt="Foto sampul profil"
                    height={COVER_HEIGHT}
                    radius="none"
                    bordered={false}
                  />
                ) : (
                  <View
                    className="w-full items-center justify-center gap-1"
                    style={{ height: COVER_HEIGHT }}
                  >
                    <Icon icon={ImageIcon} size="md" tone="default" />
                    <Text variant="caption" tone="secondary">
                      Belum ada foto sampul
                    </Text>
                  </View>
                )}
                <View className="absolute bottom-2 right-2">
                  <IconButton
                    icon={CameraIcon}
                    variant="secondary"
                    size="sm"
                    accessibilityLabel="Ubah foto sampul"
                    loading={headerBusy}
                    disabled={headerBusy}
                    onPress={() => setHeaderSheetOpen(true)}
                  />
                </View>
              </View>
            </View>

            <View className="items-center gap-3 py-4">
              <View className="relative">
                <Avatar
                  source={avatarUrl ?? undefined}
                  name={form.fullName || undefined}
                  size="xl"
                />
                <View className="absolute -bottom-1 -right-1">
                  <IconButton
                    icon={CameraIcon}
                    variant="primary"
                    size="sm"
                    shape="pill"
                    accessibilityLabel="Ubah foto profil"
                    loading={avatarBusy}
                    disabled={avatarBusy}
                    onPress={() => setAvatarSheetOpen(true)}
                  />
                </View>
              </View>
            </View>

            <FormSection title="Informasi dasar">
              <Field label="Nama lengkap" required>
                <Input
                  value={form.fullName}
                  onChangeText={(v) => set("fullName", v)}
                  maxLength={60}
                  placeholder="Nama lengkap Anda"
                  // Field yang sama di (auth)/profile-data sudah membawa
                  // keempat prop ini; tanpanya iOS/Android tidak menawarkan
                  // nama dari kontak dan kapitalisasi tiap kata tidak otomatis.
                  autoComplete="name"
                  textContentType="name"
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </Field>
              <UsernameField
                value={form.username}
                onChangeText={(v) => set("username", v)}
                availability={usernameAvailability}
                helperText="Hanya bisa diganti sekali per bulan."
              />
              <Field label="Bio" helperText="Maks. 500 karakter">
                <TextArea
                  value={form.bio}
                  onChangeText={(v) => set("bio", v)}
                  maxLength={500}
                  numberOfLines={4}
                  placeholder="Ceritakan tentang Anda"
                />
              </Field>
            </FormSection>

            <FormSection
              title="Akun"
              divider
              description="Email akun dipakai untuk masuk dan tidak diubah di sini."
            >
              <EmailField
                label="Email akun"
                value={accountEmail}
                onChangeText={() => undefined}
                validate={false}
                disabled
              />
              {emailVerified === false && accountEmail ? (
                <Alert
                  tone="warning"
                  title="Email belum diverifikasi"
                  action={
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => router.push(ROUTES.verifyEmail(accountEmail))}
                    >
                      Verifikasi sekarang
                    </Button>
                  }
                >
                  Verifikasi email agar notifikasi penting dan pemulihan akun bisa dikirim.
                </Alert>
              ) : null}
              <PhoneInput
                label="Nomor HP akun"
                value={form.phone}
                onChangeText={(v) => set("phone", v)}
                helperText="Mengganti nomor membutuhkan password akun."
              />
            </FormSection>

            <FormSection
              title="Kontak publik"
              divider
              description="Ditampilkan di profil publik bila diaktifkan."
            >
              <EmailField
                label="Email kontak"
                value={form.contactEmail}
                onChangeText={(v) => set("contactEmail", v)}
                validate={form.contactEmail.length > 0}
              />
              <Switch
                value={form.showContactEmail}
                onChange={(v) => set("showContactEmail", v)}
                label="Tampilkan email kontak di profil"
                disabled={!form.contactEmail.trim()}
              />
              <PhoneInput
                label="Nomor HP kontak"
                value={form.contactPhone}
                onChangeText={(v) => set("contactPhone", v)}
              />
              <Switch
                value={form.showContactPhone}
                onChange={(v) => set("showContactPhone", v)}
                label="Tampilkan nomor HP kontak di profil"
                disabled={!form.contactPhone}
              />
            </FormSection>

            <FormSection
              title="Tautan sosial"
              divider
              description="Ditampilkan di profil publik Anda."
            >
              <SocialLinksEditor value={links} onChange={setLinks} max={MAX_LINKS} />
            </FormSection>
          </>
        )}
      </PullToRefresh>

      <ActionSheet
        visible={avatarSheetOpen}
        title="Foto profil"
        actions={avatarActions}
        onRequestClose={() => setAvatarSheetOpen(false)}
      />

      <ActionSheet
        visible={headerSheetOpen}
        title="Foto sampul"
        actions={headerActions}
        onRequestClose={() => setHeaderSheetOpen(false)}
      />

      <Dialog
        title="Konfirmasi password"
        description="Mengubah username, nomor HP, atau kontak membutuhkan password akun."
        visible={passwordOpen}
        loading={submitting}
        confirmLabel="Simpan"
        cancelLabel="Batal"
        confirmButtonProps={{ disabled: !currentPassword }}
        onConfirm={() => void save(currentPassword)}
        onCancel={() => setPasswordOpen(false)}
        onRequestClose={() => setPasswordOpen(false)}
      >
        <PasswordField
          label="Password akun"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          errorText={passwordError}
          required
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => currentPassword && void save(currentPassword)}
        />
      </Dialog>
    </Screen>
  )
}
