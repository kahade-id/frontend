/**
 * Screen — Hubungi Kami: form tiket baru (POST /v1/support/tickets).
 * Daftar tiket ada di layar Tiket Bantuan (Support) — bukan diulang di sini.
 */
import { useCallback, useState } from "react"
import { ScrollView, View } from "react-native"
import { router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api, userMessage } from "@/lib/api"
import { pickImages } from "@/lib/image-picker"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { Field } from "@/components/ui/field"
import { FormSection } from "@/components/ui/form-section"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { TextLink } from "@/components/ui/text-link"
import { useToast } from "@/components/ui/toast"

const TICKET_CATEGORIES = [
  { value: "GENERAL", label: "Umum" },
  { value: "ORDER", label: "Pesanan" },
  { value: "PAYMENT", label: "Pembayaran" },
  { value: "ACCOUNT", label: "Akun" },
  { value: "KYC", label: "Verifikasi" },
  { value: "TECHNICAL", label: "Teknis" },
  { value: "OTHER", label: "Lainnya" },
] as const

type TicketCategory = (typeof TICKET_CATEGORIES)[number]["value"]

/** Maksimal lampiran per tiket — selaras CreateTicketDto (maxItems 5). */
const MAX_ATTACHMENTS = 5

export default function ContactScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [category, setCategory] = useState<TicketCategory>("GENERAL")
  const [submitting, setSubmitting] = useState(false)
  // SP-024: lampiran tiket — backend POST /v1/support/tickets sudah menerima
  // `attachments` (fileKey, max 5, diverifikasi); form mengekspos picker-nya.
  const [attachments, setAttachments] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const handlePickAttachments = useCallback(async () => {
    const remaining = MAX_ATTACHMENTS - attachments.length
    if (remaining <= 0) return
    let picked: Awaited<ReturnType<typeof pickImages>>
    try {
      picked = await pickImages({ selectionLimit: remaining })
    } catch (err) {
      toast.show({
        title: "Gagal memilih foto",
        description: userMessage(err),
        tone: "danger",
      })
      return
    }
    if (picked.status === "denied") {
      toast.show({ title: "Akses galeri ditolak", tone: "danger" })
      return
    }
    if (picked.status !== "picked") return
    setUploading(true)
    try {
      const keys: string[] = []
      for (const asset of picked.assets) {
        const { fileKey } = await api.upload.uploadDirectImage(asset, "CHAT_ATTACHMENT")
        keys.push(fileKey)
      }
      setAttachments((prev) => [...prev, ...keys].slice(0, MAX_ATTACHMENTS))
    } catch (err) {
      toast.show({
        title: "Gagal mengunggah lampiran",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setUploading(false)
    }
  }, [attachments.length, toast])

  const handleRemoveAttachment = useCallback((fileKey: string) => {
    setAttachments((prev) => prev.filter((k) => k !== fileKey))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!subject.trim() || !message.trim()) return
    setSubmitting(true)
    try {
      const res = await api.support.createSupportTicket({
        subject: subject.trim(),
        message: message.trim(),
        category,
        attachments,
      })
      toast.show({
        title: "Tiket terkirim",
        description: "Tim Kahade akan membalas lewat tiket ini.",
        tone: "success",
        duration: 4000,
      })
      setSubject("")
      setMessage("")
      setCategory("GENERAL")
      setAttachments([])
      if (res?.id) router.replace(ROUTES.supportTicket(res.id))
      else router.replace(ROUTES.support)
    } catch (err: unknown) {
      // Tanpa deskripsi, pengguna tidak tahu apakah harus mengulang (jaringan)
      // atau memperbaiki isian (validasi/lampiran ditolak).
      toast.show({
        title: "Gagal mengirim tiket",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setSubmitting(false)
    }
  }, [category, subject, message, toast.show])

  return (
    <Screen
      keyboardAvoiding
      edges={["top"]}
      padded={false}
      footer={
        <View>
          <Button
            fullWidth
            loading={submitting}
            disabled={!subject.trim() || !message.trim()}
            onPress={() => void handleSubmit()}
          >
            Kirim tiket
          </Button>
        </View>
      }
    >
      <Header title="Hubungi Kami" />
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-4 px-5"
        contentContainerStyle={{
          paddingTop: tokens.space[3],
          paddingBottom: insets.bottom + tokens.space[8],
        }}
      >
        <FormSection
          title="Buat tiket baru"
          description="Jelaskan kendala Anda. Balasan tim Kahade muncul di Tiket Bantuan."
        >
          <Field label="Kategori">
            <View className="flex-row flex-wrap gap-2">
              {TICKET_CATEGORIES.map((item) => (
                <Chip
                  key={item.value}
                  selected={category === item.value}
                  onPress={() => setCategory(item.value)}
                  accessibilityRole="radio"
                >
                  {item.label}
                </Chip>
              ))}
            </View>
          </Field>
          <Field label="Subjek" required>
            <Input
              value={subject}
              onChangeText={setSubject}
              placeholder="Ringkasan masalah"
              autoCapitalize="sentences"
              returnKeyType="next"
              maxLength={120}
            />
          </Field>
          <Field label="Pesan" required>
            <TextArea
              value={message}
              onChangeText={setMessage}
              placeholder="Jelaskan kendala Anda"
              maxLength={2000}
              numberOfLines={5}
            />
          </Field>
          <Field label="Lampiran (opsional)">
            <View className="gap-2">
              {attachments.map((fileKey, index) => (
                <View
                  key={fileKey}
                  className="flex-row items-center justify-between rounded-xs bg-surface px-3 py-2"
                >
                  <Text variant="caption" tone="secondary" className="font-mono-500">
                    Lampiran {index + 1}
                  </Text>
                  <TextLink inline onPress={() => handleRemoveAttachment(fileKey)}>
                    Hapus
                  </TextLink>
                </View>
              ))}
              {attachments.length < MAX_ATTACHMENTS ? (
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  loading={uploading}
                  disabled={uploading}
                  onPress={() => void handlePickAttachments()}
                >
                  {attachments.length === 0
                    ? "Tambah lampiran"
                    : `Tambah lagi (${attachments.length}/${MAX_ATTACHMENTS})`}
                </Button>
              ) : null}
            </View>
          </Field>
        </FormSection>
        <Text variant="body" tone="secondary">
          Sudah punya tiket?{" "}
          <TextLink inline onPress={() => router.push(ROUTES.support)}>
            Lihat tiket saya
          </TextLink>
        </Text>
      </ScrollView>
    </Screen>
  )
}