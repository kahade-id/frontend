/**
 * Screen — Hubungi Kami: form tiket baru (POST /v1/support/tickets).
 * Daftar tiket ada di layar Tiket Bantuan (Support) — bukan diulang di sini.
 */
import { useCallback, useState } from "react"
import { ScrollView, View } from "react-native"
import { router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api, userMessage } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { FormSection } from "@/components/ui/form-section"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { TextLink } from "@/components/ui/text-link"
import { useToast } from "@/components/ui/toast"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export default function ContactScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!subject.trim() || !message.trim()) return
    setSubmitting(true)
    try {
      const res = await api.support.createSupportTicket({
        subject: subject.trim(),
        message: message.trim(),
        attachments: [],
      })
      toast.show({
        title: "Tiket terkirim",
        description: "Tim Kahade akan membalas lewat tiket ini.",
        tone: "success",
        duration: 4000,
      })
      setSubject("")
      setMessage("")
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
  }, [subject, message, toast.show])

  return (
    <Screen
      keyboardAvoiding
      edges={["top"]}
      padded={false}
      footer={
        <View accessible={false}>
          <Button
            fullWidth
            loading={submitting}
            disabled={!subject.trim() || !message.trim()}
            onPress={() => void handleSubmit()}
          >
            Kirim Tiket
          </Button>
        </View>
      }
    >
      <Header title="Hubungi Kami" />
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-4 px-6"
        contentContainerStyle={{
          paddingTop: tokens.space[3],
          paddingBottom: insets.bottom + tokens.space[8],
        }}
      >
        <FormSection
          title="Buat tiket baru"
          description="Jelaskan kendala Anda. Balasan tim Kahade muncul di Tiket Bantuan."
        >
          <Field label="Subjek" required>
            <Input
              value={subject}
              onChangeText={setSubject}
              placeholder="Ringkasan masalah"
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