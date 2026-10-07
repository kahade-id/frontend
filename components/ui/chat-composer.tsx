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
 *   [ + ] [ TextInput multiline auto-grow (maks 5 baris) ] [ mic | kirim ]
 *   baris lampiran (chip <ChatAttachmentItem layout="chip">, scroll horizontal)
 *   strip balasan ("Membalas Nama · cuplikan" + X) bila `replyTo`
 *
 * Tombol kanan bersifat kontekstual ala WhatsApp: saat teks & lampiran kosong
 * dan `onMicPress` diset, yang tampil tombol mic (membuka perekam voice
 * note); begitu ada isi/lampiran, tombol kirim menggantikannya. Tanpa
 * `onMicPress` (mis. live-support), tombol kirim selalu tampil seperti dulu.
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
import { Microphone, PaperPlaneRight, Plus, X } from "phosphor-react-native"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  Platform,
  ScrollView,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputProps,
  type ViewProps,
} from "react-native"

import { ChatAttachmentItem, type ChatAttachment, type ChatAttachmentStatus } from "@/components/ui/chat-attachment-item"
import { canSendMessage } from "@/lib/chat-send-ready"
export { canSendMessage }
import { IconButton } from "@/components/ui/icon-button"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Icon } from "@/components/ui/icon"
import { QuickReplyPicker } from "@/components/ui/quick-reply-picker"
import { ChatFormatBar } from "@/components/ui/chat-format-bar"
import { applyChatFormat, type ChatTextFormat } from "@/lib/chat-format"
import { Text } from "@/components/ui/text"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/cn"
import { translateProp, useLanguage } from "@/lib/i18n"
import { tokens } from "@/lib/tokens"

export const CHAT_MESSAGE_MAX = 2000
const MAX_LINES = 5
/**
 * FE-SEND (2026-10-08, keluhan "double-send"): jendela anti-kirim-ulang
 * untuk MUATAN YANG SAMA.
 *
 * Bug: dua ketukan pada tombol kirim dalam rentang satu frame (atau sebelum
 * React sempat melukis ulang `sending`) memanggil `onSend` dua kali → dua
 * pesan dengan dua idempotency key berbeda → server membuat DUA pesan asli.
 * Tidak ada dedupe sisi klien yang bisa menyembuhkan pesan yang memang
 * dikirim dua kali, jadi pagarnya harus di sini (sinkron, sebelum await).
 *
 * Aturan: muatan identik (teks + lampiran + kutipan) diabaikan bila
 *   (a) ketukan berikutnya < SEND_DUPLICATE_WINDOW_MS, atau
 *   (b) kiriman sebelumnya masih dalam perjalanan (`sending`).
 * Muatan BERBEDA (pesan berikutnya) tidak pernah terhalang.
 */
const SEND_DUPLICATE_WINDOW_MS = 1500

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
  /** Label aksesibilitas tombol mic (voice note). */
  mic: string
  replyingTo: string
  cancelReply: string
}

const DEFAULT_LABELS: ChatComposerLabels = {
  placeholder: "Tulis pesan",
  attach: "Tambah lampiran",
  send: "Kirim pesan",
  mic: "Rekam pesan suara",
  replyingTo: "Membalas",
  cancelReply: "Batalkan balasan",
}

export type ChatComposerProps = Omit<ViewProps, "children"> & {
  value: string
  onChangeText: (text: string) => void
  onSend: (payload: ChatComposerPayload) => void
  attachments?: ComposerAttachment[]
  onAttach?: () => void
  /**
   * Mic ala WhatsApp: tampil menggantikan tombol kirim saat teks & lampiran
   * kosong. Opsional — tanpa ini tombol kirim selalu tampil (live-support).
   */
  onMicPress?: () => void
  onRemoveAttachment?: (localId: string) => void
  onRetryAttachment?: (localId: string) => void
  /** B04: batalkan unggahan yang sedang berjalan (chip "Batal"). */
  onCancelAttachment?: (localId: string) => void
  replyTo?: ComposerReplyTarget
  onCancelReply?: () => void
  sending?: boolean
  disabled?: boolean
  maxLength?: number
  labels?: Partial<ChatComposerLabels>
  /**
   * Item 23 (2026-09-28): balasan cepat — ketik "/" di awal teks memunculkan
   * picker template (tersinkron backend per akun, lib/reply-templates.ts).
   * Default true; matikan bila konteks tidak cocok.
   */
  quickReplies?: boolean
  /**
   * Batch 43: tampilkan toolbar format teks (tebal/miring/mono/garis
   * bawah/spoiler/tautan) di atas baris input. Memakai seleksi teks
   * TextInput; tanpa seleksi, format diterapkan di ujung teks.
   */
  formatBar?: boolean
  className?: string
  inputProps?: Omit<TextInputProps, "value" | "onChangeText" | "multiline" | "style" | "className">
}

export function ChatComposer({
  value,
  onChangeText,
  onSend,
  attachments = [],
  onAttach,
  onMicPress,
  onRemoveAttachment,
  onRetryAttachment,
  onCancelAttachment,
  replyTo,
  onCancelReply,
  sending = false,
  disabled = false,
  maxLength = CHAT_MESSAGE_MAX,
  labels,
  quickReplies = true,
  formatBar = false,
  className,
  inputProps,
  ...rest
}: ChatComposerProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const micLabel =
    labels?.mic === undefined
      ? translateProp("Rekam pesan suara") ?? t.mic
      : translateProp(labels.mic) ?? labels.mic
  // Placeholder dibaca langsung oleh TextInput native → kamus + langganan bahasa.
  useLanguage()
  const { mode } = useTheme()
  const palette = tokens.colors[mode]
  // Batch 43: seleksi teks untuk toolbar format (onSelectionChange).
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>(undefined)

  /**
   * Batch 43: terapkan format markdown ke teks terpilih (atau kursor bila
   * tidak ada seleksi) via `applyChatFormat` murni; kursor/seleksi baru
   * ikut diatur agar pengetikan berlanjut mulus.
   */
  const handleFormat = useCallback(
    (format: ChatTextFormat) => {
      if (disabled || sending) return
      const start = selection?.start ?? value.length
      const end = selection?.end ?? value.length
      const edit = applyChatFormat(value, start, end, format)
      onChangeText(edit.value)
      setSelection({ start: edit.start, end: edit.end })
    },
    [disabled, sending, onChangeText, value, selection],
  )

  // Item 23: "/" di awal teks (tanpa baris baru) → picker template. Memilih
  // template mengganti token "/..." dengan teks template.
  const quickReplyActive =
    quickReplies && !disabled && value.startsWith("/") && !value.includes("\n")
  const quickReplyQuery = quickReplyActive ? value.slice(1) : ""

  const lineHeight = tokens.typography.bodyLarge.lineHeight
  const maxInputHeight = lineHeight * MAX_LINES
  const ready = canSendMessage(value, attachments) && !sending && !disabled
  const showCount = value.length >= Math.floor(maxLength * 0.9)
  // Mic menggantikan tombol kirim hanya saat benar-benar idle: ada teks atau
  // lampiran → kirim; sedang mengirim → kirim (loading).
  const showMic = !!onMicPress && value.trim().length === 0 && attachments.length === 0 && !sending

  /** Muatan kiriman terakhir + waktunya — pagar dobel-kirim (lihat konstanta). */
  const lastSendRef = useRef<{ key: string; at: number } | null>(null)
  // Induk selesai mengirim → buka pagar (pesan berikutnya boleh dikirim).
  useEffect(() => {
    if (!sending) lastSendRef.current = null
  }, [sending])

  const submit = useCallback(() => {
    if (!ready) return
    const payload = {
      content: value.trim(),
      attachments: attachments.map(({ localId: _l, status: _s, progress: _p, ...a }) => a),
      replyToId: replyTo?.id,
    }
    // Sidik muatan: isi + lampiran + kutipan. Teks kosong (hanya lampiran)
    // tetap punya sidik yang stabil lewat daftar lampirannya.
    const key = JSON.stringify([
      payload.content,
      payload.attachments.map((a) => a.fileUrl),
      payload.replyToId ?? null,
    ])
    const now = Date.now()
    const last = lastSendRef.current
    if (last && last.key === key && now - last.at < SEND_DUPLICATE_WINDOW_MS) return
    // `sending` menangkap ketukan "kenapa tidak muncul-muncul?" saat koneksi
    // lambat: muatan sama yang dikirim ulang saat kiriman pertama masih di
    // perjalanan akan menghasilkan pesan kedua yang asli di server.
    if (last && last.key === key && sending) return
    lastSendRef.current = { key, at: now }
    onSend(payload)
  }, [ready, onSend, value, attachments, replyTo, sending])

  // Web: Enter kirim, Shift+Enter baris baru; hormati komposisi IME CJK.
  const onKeyPress = useCallback(
    (e: NativeSyntheticEvent<{ key: string }>) => {
      if (Platform.OS !== "web") return
      const native = e.nativeEvent as { key: string } & {
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

  // UX-SPA-001/002: tanpa border-t/px-4 di root — dua dari tiga pemakaian
  // (chat-room, dispute-detail) duduk di slot footer <Screen> yang sudah
  // dibungkus <FooterBar> (divider + px-5 + safe-area). Pemakaian manual
  // (live-support) menambahkan chrome-nya sendiri di wrapper.
  return (
    <View
      className={cn("relative w-full gap-2 bg-background pb-2 pt-2", className)}
      accessibilityRole="toolbar"
      {...rest}
    >
      {quickReplyActive ? (
        <QuickReplyPicker
          query={quickReplyQuery}
          onSelect={(text) => onChangeText(text)}
          // Menutup picker melepas pemicu "/" supaya user bisa melanjutkan
          // mengetik tanpa picker muncul lagi di ketikan berikutnya.
          onClose={() => onChangeText(value.replace(/^\//, ""))}
        />
      ) : null}
      {replyTo ? (
        <View className="flex-row items-center gap-3 rounded-sm border-l-2 border-border-focus bg-surface py-2 pl-3 pr-1">
          <View className="flex-1">
            <Text ellipsizeMode="tail" variant="caption" weight={600} tone="primary" numberOfLines={1}>
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
              onCancel={onCancelAttachment ? () => onCancelAttachment(a.localId) : undefined}
            />
          ))}
        </ScrollView>
      ) : null}

      {/* Batch 43: toolbar format teks (B/I/mono/underline/spoiler/tautan). */}
      {formatBar && !disabled ? <ChatFormatBar onFormat={handleFormat} /> : null}

      {/* (2026-10-05, revisi produk: input card kaca seperti header —
          background #F3F4F6/64, tanpa border/separator.) */}
      <View
        className={cn(
          "min-h-12 w-full flex-row items-end rounded-full pl-1 pr-1 py-1",
          disabled && "opacity-disabled",
        )}
        style={[
          {
            backgroundColor: mode === "light" ? "rgba(243,244,246,0.64)" : "rgba(26,26,26,0.64)",
          },
          Platform.OS === "web"
            ? ({ backdropFilter: "blur(48px)", WebkitBackdropFilter: "blur(48px)" } as object)
            : null,
        ]}
      >
        {onAttach ? (
          <IconButton
            icon={Plus}
            variant="ghost"
            size="md"
            shape="pill"
            accessibilityLabel={t.attach}
            onPress={onAttach}
            disabled={disabled || sending}
          />
        ) : null}

        <TextInput
          value={value}
          onChangeText={(next) => onChangeText(next.slice(0, maxLength))}
          multiline
          editable={!disabled && !sending}
          placeholder={translateProp(t.placeholder)}
          placeholderTextColor={palette.textSecondary}
          selectionColor={palette.primary}
          cursorColor={palette.primary}
          maxFontSizeMultiplier={2}
          onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
          selection={selection}
          onKeyPress={onKeyPress}
          blurOnSubmit={false}
          accessibilityLabel={translateProp(t.placeholder)}
          className={cn(
            "flex-1 py-[11px] pl-2 font-sans-400 text-bodyLarge text-text-primary",
            Platform.OS === "web" && "outline-none",
          )}
          style={[{ maxHeight: maxInputHeight + tokens.space[3] * 2 }, Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null]}
          {...inputProps}
        />
        {showCount ? (
          <View className="pb-3 pl-1">
            <Text variant="caption" tone={value.length >= maxLength ? "danger" : "secondary"} className="tabular-nums">
              {value.length}/{maxLength}
            </Text>
          </View>
        ) : null}

        {showMic ? (
          <IconButton
            icon={Microphone}
            variant="ghost"
            size="md"
            shape="pill"
            accessibilityLabel={micLabel}
            onPress={onMicPress}
            disabled={disabled}
          />
        ) : (
          /* (2026-10-05, revisi produk: tombol kirim lingkaran kaca seperti header.) */
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={translateProp(t.send) ?? t.send}
            haptic="light"
            onPress={submit}
            disabled={!ready}
            className="h-12 w-12 items-center justify-center"
          >
            <View
              style={[
                {
                  borderRadius: 999,
                  backgroundColor: mode === "light" ? "rgba(243,244,246,0.64)" : "rgba(26,26,26,0.64)",
                  height: 48,
                  width: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: !ready ? 0.5 : 1,
                },
                Platform.OS === "web"
                  ? ({ backdropFilter: "blur(48px)", WebkitBackdropFilter: "blur(48px)" } as object)
                  : null,
              ]}
            >
              <Icon
                icon={PaperPlaneRight}
                size="md"
                weight="fill"
                color={mode === "light" ? "#000000" : "#FFFFFF"}
              />
            </View>
          </PressableScale>
        )}
      </View>
    </View>
  )
}