/**
 * Kahade — Umpan Balik.
 *
 * Layanan mandiri untuk saran dan masukan pengguna (sebelumnya menu ini
 * membuka "Hubungi Kami"/tiket). Berbeda dengan tiket bantuan, umpan balik
 * tidak butuh subjek/kategori masalah; pengguna cukup memilih jenis masukan
 * dan menulis pesannya. Lihat lib/feedback.ts: endpoint backend masih
 * dijadwalkan, jadi kiriman yang gagal karena endpoint belum ada/luring
 * diantrekan lokal dan dikirim ulang kemudian.
 */
import { useCallback, useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { userMessage } from "@/lib/api"
import { FEEDBACK_CATEGORIES, submitFeedback, type FeedbackCategory } from "@/lib/feedback"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { Field } from "@/components/ui/field"
import { FadeIn } from "@/components/ui/fade-in"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

const MESSAGE_MIN = 10
const MESSAGE_MAX = 1000

export default function FeedbackScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const [category, setCategory] = useState<FeedbackCategory>(FEEDBACK_CATEGORIES[0])
  const [message, setMessage] = useState("")
  const [contact, setContact] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const trimmed = message.trim()
  const valid = trimmed.length >= MESSAGE_MIN

  const handleSubmit = useCallback(async () => {
    if (!valid || submitting) return
    setSubmitting(true)
    try {
      const result = await submitFeedback({
        category,
        message: trimmed,
        contact: contact.trim() || undefined,
      })
      if (result.status === "queued") {
        toast.show({
          title: "Masukan tersimpan",
          description:
            "Server umpan balik belum tersedia/sedang luring; masukan akan dikirim otomatis saat tersambung.",
          tone: "info",
          duration: 5000,
        })
      } else {
        toast.show({
          title: "Terima kasih!",
          description: "Masukan Anda telah dikirim ke tim Kahade.",
          tone: "success",
        })
      }
      setMessage("")
      setContact("")
    } catch (err) {
      toast.show({
        title: "Masukan belum terkirim",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setSubmitting(false)
    }
  }, [category, contact, submitting, toast, trimmed, valid])

  return (
    <Screen
      keyboardAvoiding
      edges={["top"]}
      padded={false}
      footer={
        <View
          className="bg-background px-6 pt-4"
          style={{ paddingBottom: Math.max(tokens.space[4], insets.bottom) }}
        >
          <Button onPress={() => void handleSubmit()} loading={submitting} disabled={!valid}>
            Kirim masukan
          </Button>
        </View>
      }
    >
      <Header title="Umpan Balik" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-6 py-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + tokens.space[8] }}
      >
        <FadeIn duration="fast">
          <View className="gap-4">
            <View className="gap-1">
              <Text variant="body" tone="primary">
                Punya saran atau menemui kendala?
              </Text>
              <Text variant="caption" tone="secondary">
                Tuliskan masukan Anda. Ide-ide terbaik Kahade datang dari
                pengguna. Untuk kendala transaksi yang butuh tindakan, gunakan
                Dukungan Langsung atau tiket bantuan.
              </Text>
            </View>

            <Field label="Jenis masukan">
              <View className="flex-row flex-wrap gap-2">
                {FEEDBACK_CATEGORIES.map((item) => (
                  <Chip
                    key={item}
                    selected={category === item}
                    onPress={() => setCategory(item)}
                    accessibilityRole="radio"
                  >
                    {item}
                  </Chip>
                ))}
              </View>
            </Field>

            <Field
              label="Masukan"
              required
              helperText={`${trimmed.length}/${MESSAGE_MAX} karakter · minimal ${MESSAGE_MIN}`}
            >
              <TextArea
                value={message}
                onChangeText={setMessage}
                placeholder="Ceritakan saran, masalah, atau pengalaman Anda…"
                maxLength={MESSAGE_MAX}
                multiline
                numberOfLines={6}
              />
            </Field>

            <Field
              label="Kontak (opsional)"
              helperText="Email atau username bila Anda ingin kami menindaklanjuti."
            >
              <Input
                value={contact}
                onChangeText={setContact}
                placeholder="email@contoh.com / @username"
                autoCapitalize="none"
                keyboardType="default"
              />
            </Field>
          </View>
        </FadeIn>
      </ScrollView>
    </Screen>
  )
}
