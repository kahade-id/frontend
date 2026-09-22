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
import { useCallback, useEffect, useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { userMessage } from "@/lib/api"
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_QUEUE_PERSISTS,
  flushQueuedFeedback,
  queuedFeedbackCount,
  submitFeedback,
  type FeedbackCategory,
} from "@/lib/feedback"
import { tokens } from "@/lib/tokens"
import { logWarn } from "@/lib/telemetry"

import { Alert } from "@/components/ui/alert"
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
import { Platform } from "react-native"

const MESSAGE_MIN = 10
const MESSAGE_MAX = 1000

export default function FeedbackScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const [category, setCategory] = useState<FeedbackCategory>(FEEDBACK_CATEGORIES[0])
  const [message, setMessage] = useState("")
  const [contact, setContact] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [queuedCount, setQueuedCount] = useState(0)

  // Native queue tersimpan sementara di SecureStore. Retry saat layar dibuka
  // agar antrean tidak hanya bergerak ketika pengguna kebetulan mengirim
  // masukan baru; kegagalan tetap silent karena feedback bukan transaksi.
  useEffect(() => {
    const sync = () =>
      flushQueuedFeedback()
        .then(() => queuedFeedbackCount())
        .then(setQueuedCount)
        .catch((err) => logWarn("feedback:flush", err))
    void sync()
    /**
     * D-07 (audit): di web antrean hanya hidup di memori, jadi "kirim saat
     * terhubung" harus benar-benar dicoba selama halaman masih terbuka —
     * sebelumnya pengiriman ulang hanya terjadi saat layar dibuka lagi atau
     * saat pengguna mengirim masukan berikutnya, dan reload menghapus
     * antreannya. Listener `online` di sini menutup celah itu.
     */
    if (Platform.OS !== "web" || typeof window === "undefined") return
    window.addEventListener("online", sync)
    return () => window.removeEventListener("online", sync)
  }, [])

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
          description: FEEDBACK_QUEUE_PERSISTS
            ? "Masukan disimpan sementara di perangkat. Pengiriman ulang dicoba saat Anda membuka halaman ini lagi atau mengirim masukan berikutnya; ini bukan tiket bantuan."
            : "Pengiriman gagal dan versi web tidak menyimpan masukan pribadi di browser — jangan tutup halaman ini, kirim ulang setelah koneksi kembali. Untuk kendala yang butuh tindakan, buat tiket bantuan resmi.",
          tone: FEEDBACK_QUEUE_PERSISTS ? "info" : "warning",
          duration: 6000,
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
      void queuedFeedbackCount().then(setQueuedCount).catch((err) => logWarn("feedback:queue-count", err))
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
        // FooterBar milik <Screen> sudah memberi px-5 pt-4; duplikat di sini
        // membuat tombol menjorok 40px dari tepi layar.
        <View
          className="bg-background"
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
        contentContainerClassName="px-5 py-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + tokens.space[8] }}
      >
        <FadeIn duration="fast">
          <View className="gap-4">
            {queuedCount > 0 ? (
              <Alert tone="info">
                {FEEDBACK_QUEUE_PERSISTS
                  ? `${queuedCount} masukan tersimpan di perangkat dan akan dikirim otomatis saat terhubung.`
                  : `${queuedCount} masukan masih menunggu terkirim dan hanya bertahan selama halaman ini terbuka (versi web tidak menyimpan masukan pribadi di browser). Biarkan halaman ini terbuka sampai koneksi kembali, atau salin isi masukan Anda.`}
              </Alert>
            ) : null}

            <View className="gap-1">
              <Text variant="body" tone="primary">
                Punya saran atau menemui kendala?
              </Text>
              <Text variant="caption" tone="secondary">
                Tuliskan masukan Anda. Masukan ini bukan tiket bantuan. Untuk
                kendala transaksi yang butuh tindakan, buat tiket bantuan resmi.
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

            {/* D-12 (audit): persetujuan eksplisit penyimpanan lokal —
                antrean luring bisa memuat email/konteks transaksi (PII).
                Pengguna diberitahu batas & lifecycle-nya, bukan diam-diam. */}
            <Text variant="caption" tone="secondary" className="text-pretty">
              Dengan mengirim, Anda setuju masukan ini (beserta kontak di atas,
              bila diisi) disimpan sementara di perangkat ini maksimal 7 hari
              saat offline, lalu dikirim otomatis dan dihapus. Antrean lokal
              juga dibersihkan saat Anda keluar dari akun.
            </Text>
          </View>
        </FadeIn>
      </ScrollView>
    </Screen>
  )
}
