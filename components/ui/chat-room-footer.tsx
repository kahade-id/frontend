/**
 * Kahade — footer ruang chat: tombol "gulir ke pesan terbaru" + salah satu
 * dari dua keadaan dasar ruang (composer, atau panel "transaksi selesai").
 *
 * Dipecah dari `app/chat/[roomId].tsx` (2026-09-26) karena layar itu
 * menyentuh plafon G-11 (god component): blok ini hanya menyusun tiga
 * komponen yang sudah ada dan tidak memakai state layar sedikit pun selain
 * yang dilewatkan sebagai prop.
 *
 * Kenapa composer dan panel selesai bercabang DI SINI (bukan di layar):
 * keduanya menempati slot yang sama di dasar layar dan saling eksklusif —
 * ruang yang sudah selesai tidak boleh punya kotak tulis. Menjaga cabang
 * ini di dalam footer membuat layar cukup berkata "apa keadaan ruangnya".
 */
import { CheckCircle, Clock, EyeSlash, X } from "phosphor-react-native"
import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react"
import { View } from "react-native"

import { Button } from "@/components/ui/button"
import { ChatComposer, type ChatComposerPayload, type ComposerAttachment, type ComposerReplyTarget } from "@/components/ui/chat-composer"
import { Dialog } from "@/components/ui/modal"
import { useToast } from "@/components/ui/toast"
import { VoiceNoteSession } from "@/components/ui/voice-note-session"
import { useOverlayDismissKeys } from "@/components/ui/backdrop"
import { translate } from "@/lib/i18n"
import { useVoiceHold, type VoiceIssue, type VoiceSessionApi } from "@/lib/use-voice-hold"
import { needsDiscardConfirm } from "@/lib/voice-note-gesture"
import type { VoiceNoteFile } from "@/lib/voice-note"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { ScrollToEndButton } from "@/components/ui/scroll-to-end-button"
import { Text } from "@/components/ui/text"

export type ChatRoomFooterProps = {
  /** Tombol lompat ke bawah hanya berguna saat pembaca sudah meninggalkan dasar. */
  showJumpToLatest: boolean
  onJumpToLatest: () => void
  /** B03: jumlah pesan baru masuk saat pembaca di atas → badge di tombol. */
  newMessageCount?: number
  /** Ruang sudah selesai → composer diganti panel informasi. */
  completed: boolean
  /** Kalimat penutup ruang (lihat `chatRoomClosedNotice`). */
  closedNotice: string
  /** Ada pesanan terkait → tampilkan jalan pintas detail transaksi. */
  orderId?: string | null | undefined
  onOpenOrder: (orderId: string) => void
  // ── Composer (diabaikan bila `completed`) ──
  /**
   * R1-001 (2026-09-29, audit render-perf): draft ketikan DIKURUNG di sini
   * (pola DebouncedSearchField) — bukan di state layar. Tiap keystroke dulu
   * me-render ulang seluruh layar room (~2700 baris) + kontainer FlatList.
   * Nilai awal asinkron dari `loadChatDraft` (layar) — tidak menimpa
   * ketikan yang sudah ada.
   */
  initialDraft?: string
  /** Sinyal dari layar: naikkan angkanya agar draft dikosongkan (setelah kirim). */
  draftResetKey?: number
  /**
   * Notifikasi per ketikan — BUKAN pengatur state layar. Dipakai layar
   * untuk typing indicator + persist draft (murah, tanpa render ulang).
   */
  onDraftChange: (value: string) => void
  /** Audit chat G17: kolom ketik kehilangan fokus → berhenti "mengetik…". */
  onComposerBlur?: () => void
  onSend: (payload: ChatComposerPayload) => void
  attachments: ComposerAttachment[]
  onAttach: () => void
  /** Mic ala WhatsApp di composer (opsional) — buka perekam voice note. */
  onMicPress?: () => void
  /**
   * Audit chat C7: tahan-untuk-merekam + geser-untuk-kunci. Footer yang
   * MENGHOSTING state-nya (fase, timer 250 ms) — bukan layar room, supaya
   * tick timer tidak me-render ulang seluruh layar + list. Berkas rekaman
   * valid diserahkan ke sini; layar mengunggah dan mengirimnya otomatis.
   */
  onVoiceNote?: (file: VoiceNoteFile) => void
  onRemoveAttachment: (localId: string) => void
  onRetryAttachment: (localId: string) => void
  /** B04: batalkan unggahan yang sedang berjalan. */
  onCancelAttachment?: (localId: string) => void
  sending: boolean
  disabled: boolean
  /** Target balasan — strip "Membalas …" di atas composer (permintaan produk 2026-09-28). */
  replyTo?: ComposerReplyTarget
  onCancelReply?: () => void
  // ── Batch 43 FE-CHAT ──────────────────────────────────────────────
  /** Label mode pesan sementara aktif (null = mati), mis. "1 hari". */
  ephemeralLabel?: string | null
  /** Mode sekali-lihat aktif untuk pesan berikutnya. */
  viewOnceActive?: boolean
  /** Buka sheet pengaturan pesan sementara/sekali-lihat. */
  onOpenEphemeral?: () => void
  /** Matikan kedua mode. */
  onClearEphemeral?: () => void
  /** Tampilkan toolbar format teks di atas composer. */
  formatBar?: boolean
}

/** PERF-FIX (TIM1-P1): di-memo seperti ChatPinnedBar (FE-059) — footer
 * composer tidak ikut render ulang saat state layar chat yang tidak terkait
 * input berubah. */
export const ChatRoomFooter = memo(function ChatRoomFooter({
  showJumpToLatest,
  onJumpToLatest,
  newMessageCount = 0,
  completed,
  closedNotice,
  orderId,
  onOpenOrder,
  initialDraft = "",
  draftResetKey = 0,
  onDraftChange,
  onComposerBlur,
  onSend,
  attachments,
  onAttach,
  onMicPress,
  onVoiceNote,
  onRemoveAttachment,
  onRetryAttachment,
  onCancelAttachment,
  sending,
  disabled,
  replyTo,
  onCancelReply,
  ephemeralLabel = null,
  viewOnceActive = false,
  onOpenEphemeral,
  onClearEphemeral,
  formatBar = false,
}: ChatRoomFooterProps) {
  const ephemeralActive = ephemeralLabel != null || viewOnceActive

  // R1-001: state draft milik footer — keystroke hanya me-render ulang
  // subtree ini, bukan layar room.
  const [draft, setDraft] = useState(initialDraft)
  // Ref pola DebouncedSearchField: identitas handler layar boleh berubah
  // tanpa membuat ulang handler lokal ini.
  const onDraftChangeRef = useRef(onDraftChange)
  onDraftChangeRef.current = onDraftChange
  // Restore draft tersimpan: jangan timpa ketikan yang sudah ada.
  useEffect(() => {
    if (initialDraft) setDraft((prev) => (prev ? prev : initialDraft))
  }, [initialDraft])
  // Layar menaikkan draftResetKey setelah pesan terkirim → kosongkan.
  useEffect(() => {
    if (draftResetKey > 0) setDraft("")
  }, [draftResetKey])
  const handleLocalDraftChange = useCallback((text: string) => {
    setDraft(text)
    onDraftChangeRef.current(text)
  }, [])

  // Audit chat G17: blur kolom ketik diteruskan (stabil — memo footer tetap hit).
  const composerInputProps = useMemo(
    () => (onComposerBlur ? { onBlur: onComposerBlur } : undefined),
    [onComposerBlur],
  )

  // ── Voice note tahan-untuk-merekam (audit chat C7) ──────────────────────
  const toast = useToast()
  const voiceSessionRef = useRef<VoiceSessionApi | null>(null)
  const onVoiceNoteRef = useRef(onVoiceNote)
  onVoiceNoteRef.current = onVoiceNote
  const handleVoiceIssue = useCallback(
    (issue: VoiceIssue) => {
      if (issue === "denied") {
        toast.show({
          title: translate("Akses mikrofon ditolak"),
          description: translate(
            "Buka Pengaturan perangkat → Kahade → Mikrofon untuk mengaktifkan pesan suara.",
          ),
          tone: "danger",
        })
      } else if (issue === "retry") {
        // Dialog izin pertama kali memutus gestur — bukan kesalahan pengguna.
        toast.show({
          title: translate("Izin mikrofon diberikan"),
          description: translate("Tahan tombol mikrofon lagi untuk merekam."),
          tone: "info",
        })
      } else {
        toast.show({
          title: translate("Perekaman suara tidak didukung di perangkat ini."),
          tone: "danger",
        })
      }
    },
    [toast],
  )
  const handleVoiceLimit = useCallback(() => {
    toast.show({
      title: translate("Batas rekaman tercapai"),
      description: translate("Pesan suara dikirim otomatis."),
      tone: "info",
    })
  }, [toast])
  const voice = useVoiceHold({
    getSession: () => voiceSessionRef.current,
    onRecorded: (file) => onVoiceNoteRef.current?.(file),
    onIssue: handleVoiceIssue,
    onLimitReached: handleVoiceLimit,
    disabled: disabled || completed || !onVoiceNote,
  })
  // Membuang rekaman terkunci yang berarti meminta konfirmasi dulu (B3O-22).
  const [voiceDiscardOpen, setVoiceDiscardOpen] = useState(false)
  const requestVoiceDiscard = useCallback(() => {
    if (needsDiscardConfirm(voice.durationMs)) setVoiceDiscardOpen(true)
    else voice.discard()
  }, [voice])
  // Tombol kembali Android pada rekaman terkunci = buang (dengan konfirmasi).
  useOverlayDismissKeys(voice.phase === "locked", requestVoiceDiscard)
  return (
    <View>
      {/* Kembali ke dasar thread — muncul hanya saat pembaca
          meninggalkan bawah (deteksi di onScroll).
          2026-10-02: posisi absolute floating di atas input (bukan di dalam
          flow) — sebelumnya di dalam View footer sehingga terasa "di dalam input". */}
      {/* 2026-10-08: pembungkus SELALU ter-mount supaya tombol bisa memudar
          masuk/keluar (<ScrollToEndButton> mengelola mount-nya sendiri dan
          melepas diri setelah animasi keluar). `box-none`: area kosong di
          sekitar tombol tetap meneruskan sentuhan ke thread. */}
      <View className="absolute -top-14 right-5 z-10" style={styles.jumpToLatestWrap}>
        <ScrollToEndButton
          visible={showJumpToLatest}
          onPress={onJumpToLatest}
          label="Gulir ke pesan terbaru"
          count={newMessageCount}
        />
      </View>

      {completed ? (
        // UX-SPA-001: dipakai di slot footer <Screen> — divider border-t,
        // px, dan bottom safe-area sudah disediakan <FooterBar>.
        <View className="bg-surface py-3">
          <View className="items-center justify-center gap-1.5 rounded-lg bg-surface-elevated px-4 py-3">
            <View className="flex-row items-center gap-2">
              <Icon icon={CheckCircle} size="sm" tone="default" />
              <Text variant="caption" tone="secondary" weight={500} className="text-center">
                {closedNotice}
              </Text>
            </View>
            {orderId ? (
              <Button variant="ghost" size="sm" onPress={() => onOpenOrder(orderId)}>
                Lihat detail transaksi
              </Button>
            ) : null}
          </View>
        </View>
      ) : (
        <View>
          {/* Batch 43: strip mode pesan sementara / sekali-lihat aktif. */}
          {ephemeralActive ? (
            // UX-SPA-001: tanpa border-t/px-4 — <FooterBar> sudah memberi
            // divider + px-5; strip ini banner di dalam footer.
            <View className="flex-row items-center gap-2 bg-surface py-1.5">
              <Icon icon={ephemeralLabel != null ? Clock : EyeSlash} size="sm" tone="warning" />
              <Text variant="caption" tone="secondary" className="flex-1" numberOfLines={1}>
                {ephemeralLabel != null
                  ? viewOnceActive
                    ? translate("Pesan sementara aktif ({x}) · sekali-lihat", { x: ephemeralLabel })
                    : translate("Pesan sementara aktif ({x})", { x: ephemeralLabel })
                  : translate("Sekali-lihat aktif untuk pesan berikutnya")}
              </Text>
              <Button
                fullWidth={false}
                variant="ghost"
                size="sm"
                accessibilityLabel="Ubah pengaturan pesan sementara"
                onPress={onOpenEphemeral}
              >
                Ubah
              </Button>
              <IconButton
                icon={X}
                size="sm"
                variant="ghost"
                accessibilityLabel="Matikan mode pesan sementara"
                onPress={() => onClearEphemeral?.()}
              />
            </View>
          ) : null}
          <ChatComposer
            value={draft}
            onChangeText={handleLocalDraftChange}
            onSend={onSend}
            attachments={attachments}
            onAttach={onAttach}
            onMicPress={onMicPress}
            voice={onVoiceNote ? voice : undefined}
            onVoiceDiscard={requestVoiceDiscard}
            inputProps={composerInputProps}
            onRemoveAttachment={onRemoveAttachment}
            onRetryAttachment={onRetryAttachment}
            onCancelAttachment={onCancelAttachment}
            replyTo={replyTo}
            onCancelReply={onCancelReply}
            sending={sending}
            disabled={disabled}
            formatBar={formatBar}
          />
        </View>
      )}
      {/* Perekam voice note: di-mount hanya selama ada interaksi tahan/kunci. */}
      {voice.phase !== "idle" ? (
        <VoiceNoteSession apiRef={voiceSessionRef} onDuration={voice.handleDuration} />
      ) : null}
      <Dialog
        visible={voiceDiscardOpen}
        title={translate("Buang rekaman?")}
        description={translate("Rekaman pesan suara ini akan dihapus dan tidak bisa dikembalikan.")}
        confirmLabel={translate("Buang")}
        cancelLabel={translate("Lanjutkan")}
        destructive
        onConfirm={() => {
          setVoiceDiscardOpen(false)
          voice.discard()
        }}
        onRequestClose={() => setVoiceDiscardOpen(false)}
      />
    </View>
  )
})

const styles = {
  jumpToLatestWrap: { pointerEvents: "box-none" as const },
}
