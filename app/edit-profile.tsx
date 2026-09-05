/**
 * Screen — Edit Profil (GET/PUT /v1/users/me + links PUT /v1/users/me/links).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api, type UpdateProfileDto } from "@/lib/api"
import { tokens } from "@/lib/tokens"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { EmailField } from "@/components/ui/email-field"
import { Field } from "@/components/ui/field"
import { FormSection } from "@/components/ui/form-section"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SocialLinksEditor } from "@/components/ui/social-links-editor"
import { TextArea } from "@/components/ui/text-area"
import { UsernameField } from "@/components/ui/username-field"
import { useToast } from "@/components/ui/toast"

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [fullName, setFullName] = useState("")
  const [username, setUsername] = useState("")
  const [bio, setBio] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [links, setLinks] = useState<Array<{ platform: string; url: string; label?: string; displayOrder?: number }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchProfile = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const me = await api.users.getMe()
      setFullName(me.fullName ?? "")
      setUsername(me.username ?? "")
      setBio(me.bio ?? "")
      setEmail(me.email ?? "")
      setPhone(me.phoneNumber ?? "")
      setAvatarUrl(me.avatarUrl ?? null)
    } catch {
      setError("Gagal memuat profil.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchProfile()
  }, [fetchProfile])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchProfile()
    setRefreshing(false)
  }, [fetchProfile])

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    try {
      const dto: UpdateProfileDto = {
        fullName: fullName.trim() || undefined,
        username: username.trim() || undefined,
        bio: bio.trim() || undefined,
        contactEmail: email.trim() || undefined,
        contactPhone: phone.trim() || undefined,
      }
      await api.users.updateProfile(dto)
      toast.show({ title: "Profil diperbarui", tone: "success", duration: 3000 })
    } catch {
      toast.show({ title: "Gagal menyimpan profil", tone: "danger" })
    } finally {
      setSubmitting(false)
    }
  }, [fullName, username, bio, email, phone, links, toast.show])

  return (
    <Screen
      edges={["top"]}
      padded={false}
      footer={
        <View className="px-6 pb-4">
          <Button fullWidth loading={submitting} disabled={loading} onPress={() => void handleSubmit()}>
            Simpan Perubahan
          </Button>
        </View>
      }
    >
      <Header title="Edit Profil" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        <View className="items-center py-4">
          <Avatar source={avatarUrl ?? undefined} size="xl" />
        </View>

        <FormSection title="Informasi dasar">
          <Field label="Nama lengkap" required>
            <Input value={fullName} onChangeText={setFullName} maxLength={60} placeholder="Nama lengkap Anda" />
          </Field>
          <UsernameField value={username} onChangeText={setUsername} />
          <Field label="Bio" helperText="Maks. 500 karakter">
            <TextArea value={bio} onChangeText={setBio} maxLength={500} numberOfLines={4} placeholder="Ceritakan tentang Anda" />
          </Field>
        </FormSection>

        <FormSection title="Kontak" divider>
          <EmailField value={email} onChangeText={setEmail} validate={false} />
          <Field label="Nomor telepon">
            <PhoneInput value={phone} onChangeText={setPhone} />
          </Field>
        </FormSection>

        <FormSection title="Tautan sosial" divider description="Ditampilkan di profil publik Anda.">
          <SocialLinksEditor value={links} onChange={setLinks} max={4} />
        </FormSection>

        {error ? (
          <Button variant="ghost" fullWidth={false} onPress={() => void fetchProfile()}>
            {error} — Coba lagi
          </Button>
        ) : null}
      </PullToRefresh>
    </Screen>
  )
}
