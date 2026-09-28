/**
 * Kahade — sheet terjemahkan pesan (batch 43 FE-CHAT, 2026-09-28).
 *
 * POST /v1/chat/rooms/{id}/messages/{messageId}/translate.
 * Backend 501 (TRANSLATION_NOT_CONFIGURED) → "belum tersedia", BUKAN error
 * generik (keputusan produk: provider opsional).
 *
 * Bahasa target default = kebalikan bahasa app aktif (id ↔ en); daftar
 * ringkas 6 bahasa.
 */
import { useEffect, useState } from "react"
import { Pressable, View } from "react-native"

import {
  translateChatMessage,
  TRANSLATION_NOT_CONFIGURED,
  type ChatMessage,
  type ChatTranslation,
} from "@/lib/api/chat"
import { isApiError, userMessage } from "@/lib/api"
import { getLanguage } from "@/lib/i18n/store"
import { logWarn } from "@/lib/telemetry"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

export type ChatTranslateSheetProps = {
  /** Pesan yang diterjemahkan; `null` menutup sheet. */
  message: ChatMessage | null
  roomId: string | null
  onRequestClose: () => void
  /** Terapkan hasil ke thread (blok di bawah pesan asli). */
  onApply: (messageId: string, translation: ChatTranslation) => void
}

const TARGET_LANGS = [
  { code: "id", label: "Indonesia" },
  { code: "en", label: "English" },
  { code: "ms", label: "Melayu" },
  { code: "ar", label: "Arab" },
  { code: "zh", label: "Mandarin" },
  { code: "ja", label: "Jepang" },
] as const

export function ChatTranslateSheet({
  message,
  roomId,
  onRequestClose,
  onApply,
}: ChatTranslateSheetProps) {
  const toast = useToast()
  const [targetLang, setTargetLang] = useState("en")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ChatTranslation | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    if (message) {
      setTargetLang(getLanguage() === "id" ? "en" : "id")
      setResult(null)
      setUnavailable(false)
      setLoading(false)
    }
  }, [message])

  const run = async () => {
    if (!message || !roomId || !message.text?.trim()) return
    setLoading(true)
    setUnavailable(false)
    try {
      const t = await translateChatMessage(roomId, message.id, targetLang)
      setResult(t)
    } catch (err) {
      logWarn("chat:translate", err)
      if (
        isApiError(err) &&
        (err.backendCode === TRANSLATION_NOT_CONFIGURED || err.status === 501)
      ) {
        // Provider belum dikonfigurasi — bukan kesalahan user.
        setUnavailable(true)
      } else {
        toast.show({
          title: "Gagal menerjemahkan",
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <BottomSheet
      visible={!!message}
      onRequestClose={onRequestClose}
      title="Terjemahkan pesan"
      description={message?.text?.trim().slice(0, 120)}
      avoidKeyboard
    >
      <View className="gap-3">
        <View className="gap-2">
          <Text variant="caption" weight={600} tone="secondary">
            Bahasa tujuan
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {TARGET_LANGS.map((l) => (
              <Pressable
                key={l.code}
                onPress={() => {
                  setTargetLang(l.code)
                  setResult(null)
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: targetLang === l.code }}
                className={`rounded-full border px-3 py-1.5 ${
                  targetLang === l.code ? "border-primary bg-primary/10" : "border-border"
                }`}
              >
                <Text
                  variant="caption"
                  weight={600}
                  tone={targetLang === l.code ? "primary" : "secondary"}
                >
                  {l.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {loading ? (
          <View className="items-center py-6">
            <Spinner />
            <Text variant="caption" tone="secondary" className="mt-2">
              Menerjemahkan…
            </Text>
          </View>
        ) : unavailable ? (
          <View className="rounded-md bg-surface p-3">
            <Text variant="body" weight={600} tone="primary">
              Terjemahan belum tersedia
            </Text>
            <Text variant="caption" tone="secondary" className="mt-1">
              Layanan terjemahan belum diaktifkan. Coba lagi nanti.
            </Text>
          </View>
        ) : result ? (
          <View className="gap-2 rounded-md border border-border bg-surface p-3">
            <Text variant="caption" weight={600} tone="info">
              {result.sourceLang ? `${result.sourceLang} → ${result.targetLang}` : result.targetLang}
            </Text>
            <Text variant="body" tone="primary" selectable>
              {result.translatedText}
            </Text>
          </View>
        ) : null}

        <View className="flex-row gap-2">
          <View className="flex-1">
            <Button
              variant="secondary"
              onPress={() => void run()}
              disabled={loading || !message?.text?.trim()}
            >
              {result ? "Terjemahkan ulang" : "Terjemahkan"}
            </Button>
          </View>
          {result && message ? (
            <View className="flex-1">
              <Button
                onPress={() => {
                  onApply(message.id, result)
                  onRequestClose()
                }}
              >
                Tampilkan di chat
              </Button>
            </View>
          ) : null}
        </View>
      </View>
    </BottomSheet>
  )
}
