/**
 * Kahade — <ChatComposer> bilah tulis pesan di dasar ruang chat & dispute
 * (§9.2 Input, §9.1 Icon button, §6.2 layer sticky, §4 safe area).
 *
 * Mengumpulkan payload SendMessageDto (`POST /v1/chat/rooms/{roomId}/messages`
 * dan `POST /v1/disputes/{id}/messages`): content ≤2000, attachments
 * (ChatAttachmentDto[] hasil `.../upload`), replyToId. Komponen controlled —
 * teks & antrean lampiran dipegang pemanggil supaya draft bertahan saat
 * navigasi & upload berjalan di luar komponen.
 *
 * Anatomi (bawah -> atas):
 *   [ + ] [ TextInput multiline auto-grow (maks 5 baris) ] [ kirim ]
 *   baris lampiran (chip <ChatAttachmentItem layout="chip">, scroll horizontal)
 *   strip balasan ("Membalas Nama · cuplikan" + X) bila `replyTo`
 *
 * Keputusan non-obvious:
 *   - TIDAK memakai <Input>: Input membawa floating label, tinggi tetap 56,
 *     dan Field wrapper — semuanya salah untuk composer yang harus tumbuh
 *     mengikuti isi. TextInput mentah di-styling dengan token yang sama
 *     (border-border, rounded-sm, text-bodyLarge) supaya tetap satu keluarga.
 *   - Auto-grow dibatasi 5 baris (lineHeight bodyLarge 26 × 5 + padding):
 *     lebih dari itu, area chat tertutup; scroll internal mengambil alih.
 *   - Tombol kirim = <IconButton primary> PaperPlaneRight, disabled bila teks
 *     kosong DAN tanpa lampiran, atau ada lampiran yang masih "uploading"/
 *     "error". Mengirim saat upload belum selesai membuat fileUrl kosong dan
 *     ditolak server — lebih jujur menonaktifkan tombol daripada gagal.
 *   - Enter di web mengirim; Shift+Enter baris baru. Di native, Enter = baris
 *     baru (return key "default") — kebiasaan platform. IME CJK dihormati
 *     lewat `nativeEvent.isComposing`/keyCode 229.
 *   - Penghitung karakter hanya muncul saat >= 90% batas (1800/2000): angka
 *     yang selalu tampil menambah kebisingan di layar chat yang sudah padat.
 *   - Komponen tidak mengurus KeyboardAvoiding/safe-area: bungkus dengan
 *     <KeyboardAvoiding> + <SafeAreaSpacer> di layar (lihar §4 safe area).
 */
import { PaperPlaneRight, Plus, X } from "phosphor-react-native"
import { useCallback, useState } from "react"
import {
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
  type TextInputProps,
  type ViewProps,
} from "react-native"

import { ChatAttachmentItem, type ChatAttachment, type ChatAttachmentStatus } from "@/components/ui/chat-attachment-item"
import { IconButton } from "@/components/ui/icon-button"
import { Text } from "@/components/ui/text"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

export const CHAT_MESSAGE_MAX = 2000
const MAX_LINES = 5

export type ComposerAttachment = ChatAttachment & {
  /** Kunci lokal stabil (bukan fileUrl — URL belum ada saat masih diunggah) */
  localId: string
  status?: ChatAttachmentStatus
  progress?: number
}

export type ComposerReplyTarget = {
  id: string
  senderName: string
  /** Cuplikan pesan yang dibalas (sudah dipotong pemanggil bila panjang) */
  preview: string
}

export type ChatComposerPayload = {
  content: string
  attachments: ChatAttachment[]
  replyToId?: string
}

export type ChatComposerLabels = {
  placeholder: string
  attach: string
  send: string
  replyingTo: string
  cancelReply: string
}

const DEFAULT_LABELS: ChatComposerLabels = {
  placeholder: "Tulis pesan",
  attach: "Tambah lampiran",
  send: "Kirim pesan",
  replyingTo: "Membalas",
  cancelReply: "Batalkan balasan",
}

export type ChatComposerProps = Omit<ViewProps, "children"> & {
  value: string
  onChangeText: (text: string) => void
  onSend: (payload: ChatComposerPayload) => void
  attachments?: ComposerAttachment[]
  onAttach?: () => void
  onRemoveAttachment?: (localId: string) => void
  onRetryAttachment?: (localId: string) => void
  replyTo?: ComposerReplyTarget
  onCancelReply?: () => void
  sending?: boolean
  disabled?: boolean
  maxLength?: number
  labels?: Partial<ChatComposerLabels>
  className?: string
  inputProps?: Omit<TextInputProps, "value" | "onChangeText" | "multiline" | "style" | "className">
}

export function canSendMessage(text: string, attachments: readonly ComposerAttachment[] = []): boolean {
  const hasText = text.trim().length > 0
  const hasFiles = attachments.length > 0
  const allReady = attachments.every((a) => (a.status ?? "idle") === "idle")
  return (hasText || hasFiles) && allReady
}

export function ChatComposer({
  value,
  onChangeText,
  onSend,
  attachments = [],
  onAttach,
  onRemoveAttachment,
  onRetryAttachment,
  replyTo,
  onCancelReply,
  sending = false,
  disabled = false,
  maxLength = CHAT_MESSAGE_MAX,
  labels,
  className,
  inputProps,
  ...rest
}: ChatComposerProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const { mode } = useTheme()
  const palette = tokens.colors[mode]
  const [focused, setFocused] = useState(false)

  const lineHeight = tokens.typography.bodyLarge.lineHeight
  const maxInputHeight = lineHeight * MAX_LINES
  const ready = canSendMessage(value, attachments) && !sending && !disabled
  const showCount = value.length >= Math.floor(maxLength * 0.9)

  const submit = useCallback(() => {
    if (!ready) return
    onSend({
      content: value.trim(),
      attachments: attachments.map(({ localId: _l, status: _s, progress: _p, ...a }) => a),
      replyToId: replyTo?.id,
    })
  }, [ready, onSend, value, attachments, replyTo])

  // Web: Enter kirim, Shift+Enter baris baru; hormati komposisi IME CJK.
  const onKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (Platform.OS !== "web") return
      const native = e.nativeEvent as TextInputKeyPressEventData & {
        shiftKey?: boolean
        isComposing?: boolean
        keyCode?: number
      }
      if (native.key !== "Enter" || native.shiftKey) return
      if (native.isComposing || native.keyCode === 229) return
      e.preventDefault?.()
      submit()
    },
    [submit],
  )

  return (
    <View
      className={cn("w-full gap-2 border-t border-border bg-background px-4 pb-2 pt-2", className)}
      accessibilityRole="toolbar"
      {...rest}
    >
      {replyTo ? (
        <View className="flex-row items-center gap-3 rounded-sm border-l-2 border-border-focus bg-surface py-2 pl-3 pr-1">
          <View className="flex-1">
            <Text variant="caption" weight={600} tone="primary" numberOfLines={1}>
              {t.replyingTo} {replyTo.senderName}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {replyTo.preview}
            </Text>
          </View>
          {onCancelReply ? (
            <IconButton icon={X} size="sm" variant="ghost" accessibilityLabel={t.cancelReply} onPress={onCancelReply} />
          ) : null}
        </View>
      ) : null}

      {attachments.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-4">
          {attachments.map((a) => (
            <ChatAttachmentItem
              key={a.localId}
              attachment={a}
              layout="chip"
              status={a.status}
              progress={a.progress}
              onRemove={onRemoveAttachment ? () => onRemoveAttachment(a.localId) : undefined}
              onRetry={onRetryAttachment ? () => onRetryAttachment(a.localId) : undefined}
            />
          ))}
        </ScrollView>
      ) : null}

      <View className="flex-row items-end gap-2">
        {onAttach ? (
          <IconButton
            icon={Plus}
            variant="secondary"
            size="md"
            accessibilityLabel={t.attach}
            onPress={onAttach}
            disabled={disabled || sending}
          />
        ) : null}

        <View
          className={cn(
            "min-h-12 flex-1 flex-row items-end rounded-sm bg-background",
            focused ? "border-focus border-border-focus px-[15px]" : "border border-border px-4",
            disabled && "opacity-disabled",
          )}
        >
          <TextInput
            value={value}
            onChangeText={(next) => onChangeText(next.slice(0, maxLength))}
            multiline
            editable={!disabled && !sending}
            placeholder={t.placeholder}
            placeholderTextColor={palette.textDisabled}
            selectionColor={palette.primary}
            cursorColor={palette.primary}
            allowFontScaling={false}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyPress={onKeyPress}
            blurOnSubmit={false}
            accessibilityLabel={t.placeholder}
            className={cn(
              "flex-1 py-[11px] font-sans-400 text-bodyLarge text-text-primary",
              Platform.OS === "web" && "outline-none",
            )}
            style={[{ maxHeight: maxInputHeight + tokens.space[3] * 2 }, Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null]}
            {...inputProps}
          />
          {showCount ? (
            <Pressable accessible={false} className="pb-3 pl-2">
              <Text variant="caption" tone={value.length >= maxLength ? "danger" : "secondary"} className="tabular-nums">
                {value.length}/{maxLength}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <IconButton
          icon={PaperPlaneRight}
          variant="primary"
          size="md"
          weight="fill"
          accessibilityLabel={t.send}
          onPress={submit}
          disabled={!ready}
          loading={sending}
        />
      </View>
    </View>
  )
}
