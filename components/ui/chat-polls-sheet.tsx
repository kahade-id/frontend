/**
 * Kahade — sheet polling ruang chat (batch 43 FE-CHAT, 2026-09-28).
 *
 * Daftar polling (GET /v1/chat/rooms/{id}/polls) + buat baru + vote + tutup.
 * Seluruh state API hidup di sini; layar hanya membuka sheet dengan roomId.
 *
 * Batas backend (divalidasi juga di sini agar gagal cepat):
 * pertanyaan ≤300 char, opsi 2–10 @ ≤120 char, tenggat = preset opsional.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { Pressable, View } from "react-native"

import {
  closePoll,
  createPoll,
  listPolls,
  votePoll,
  CHAT_POLL_MAX_OPTIONS,
  CHAT_POLL_MIN_OPTIONS,
  CHAT_POLL_QUESTION_MAX,
  type ChatPoll,
} from "@/lib/api/chat"
import { isApiError, userMessage } from "@/lib/api"
import { translate } from "@/lib/i18n/translate"
import { logWarn } from "@/lib/telemetry"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { ChatPollCard } from "@/components/ui/chat-poll-card"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"
import { EmptyState } from "@/components/ui/empty-state"
import { useToast } from "@/components/ui/toast"
import { ChartBar, Plus, Trash } from "phosphor-react-native"

export type ChatPollsSheetProps = {
  visible: boolean
  roomId: string | null
  /** userId saya — untuk tombol "Tutup polling" (hanya pembuat). */
  myUserId?: string
  onRequestClose: () => void
  /**
  /**
   * BFI-119/NCC-006: pemicu refresh eksternal (event realtime
   * `chat.poll_created` / `chat.poll_updated` / `chat.poll_closed`). Sheet
   * me-reload daftar bila salah satunya berubah saat sheet terbuka.
   * Kedua nama didukung (gabungan dua sisi audit); layar room mengirim
   * keduanya, cukup salah satu berubah untuk memicu reload.
   */
  refreshSignal?: number
  refreshKey?: number
  /**
   * Bug #8 (2026-10-10): polling berhasil dibuat → layar menutup sheet dan
   * mengambil pesan POLL baru ke thread sekarang juga.
   */
  onCreated?: (poll: ChatPoll) => void
}

const DEADLINE_PRESETS = [
  { key: "none", label: "Tanpa tenggat", hours: 0 },
  { key: "1d", label: "1 hari", hours: 24 },
  { key: "3d", label: "3 hari", hours: 72 },
  { key: "7d", label: "7 hari", hours: 168 },
] as const

export function ChatPollsSheet({ visible, roomId, myUserId, onRequestClose, refreshSignal = 0, refreshKey, onCreated }: ChatPollsSheetProps) {
  const toast = useToast()
  const [polls, setPolls] = useState<ChatPoll[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  /**
   * FE-120: kunci request buat polling — ketuk ganda cepat tidak membuat dua
   * polling identik (bukan `creating`, yang menandai mode form, bukan request).
   */
  const [submittingPoll, setSubmittingPoll] = useState(false)
  const [votingId, setVotingId] = useState<string | null>(null)
  const [closingId, setClosingId] = useState<string | null>(null)

  // Form buat polling
  const [question, setQuestion] = useState("")
  const [options, setOptions] = useState<string[]>(["", ""])
  const [allowMultiple, setAllowMultiple] = useState(false)
  const [deadlineKey, setDeadlineKey] = useState<(typeof DEADLINE_PRESETS)[number]["key"]>("none")

  const load = useCallback(async () => {
    if (!roomId) return
    setLoading(true)
    try {
      setPolls(await listPolls(roomId))
    } catch (err) {
      logWarn("chat:polls-load", err)
      toast.show({
        title: translate("Gagal memuat polling"),
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
      setPolls([])
    } finally {
      setLoading(false)
    }
  }, [roomId, toast])

  // BFI-119/NCC-006: penanda sinyal refresh terakhir yang sudah diproses
  // (lihat dua effect di bawah).
  const lastPollSignalRef = useRef(refreshSignal)
  const lastPollKeyRef = useRef(refreshKey)

  useEffect(() => {
    if (visible) {
      // BFI-119: sinkronkan penanda sinyal — event yang tiba saat sheet
      // tertutup sudah tercakup load() di bawah, jangan reload ganda.
      lastPollSignalRef.current = refreshSignal
      lastPollKeyRef.current = refreshKey
      setPolls(null)
      setCreating(false)
      setQuestion("")
      setOptions(["", ""])
      setAllowMultiple(false)
      setDeadlineKey("none")
      void load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, load])

  // BFI-119/NCC-006: event WS chat.poll_created/updated/closed — muat ulang
  // daftar saat sheet terbuka, TANPA mereset form buat-poll yang sedang diisi.
  useEffect(() => {
    if (!visible) return
    let changed = false
    if (refreshSignal !== lastPollSignalRef.current) {
      lastPollSignalRef.current = refreshSignal
      changed = true
    }
    if (refreshKey !== lastPollKeyRef.current) {
      lastPollKeyRef.current = refreshKey
      changed = true
    }
    if (changed) void load()
  }, [visible, refreshSignal, refreshKey, load])

  const patchPoll = (updated: ChatPoll) =>
    setPolls((prev) => (prev ? prev.map((p) => (p.id === updated.id ? updated : p)) : prev))

  const handleVote = async (pollId: string, optionIndexes: number[]) => {
    if (!roomId || optionIndexes.length === 0) return
    setVotingId(pollId)
    try {
      patchPoll(await votePoll(roomId, pollId, optionIndexes))
    } catch (err) {
      logWarn("chat:poll-vote", err)
      toast.show({
        title: translate("Gagal menyimpan pilihan"),
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setVotingId(null)
    }
  }

  const handleClose = async (pollId: string) => {
    if (!roomId) return
    setClosingId(pollId)
    try {
      patchPoll(await closePoll(roomId, pollId))
      toast.show({ title: translate("Polling ditutup"), tone: "success", duration: 2500 })
    } catch (err) {
      logWarn("chat:poll-close", err)
      toast.show({
        title: translate("Gagal menutup polling"),
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setClosingId(null)
    }
  }

  const validOptions = options.map((o) => o.trim()).filter(Boolean)
  const canCreate =
    question.trim().length > 0 &&
    question.trim().length <= CHAT_POLL_QUESTION_MAX &&
    validOptions.length >= CHAT_POLL_MIN_OPTIONS &&
    validOptions.every((o) => o.length <= 120)

  const handleCreate = async () => {
    if (!roomId || !canCreate || submittingPoll) return
    const preset = DEADLINE_PRESETS.find((p) => p.key === deadlineKey)
    setSubmittingPoll(true)
    try {
      const created = await createPoll(roomId, {
        question: question.trim(),
        options: validOptions.slice(0, CHAT_POLL_MAX_OPTIONS),
        allowMultiple,
        ...(preset && preset.hours > 0
          ? { deadline: new Date(Date.now() + preset.hours * 3600000).toISOString() }
          : {}),
      })
      setPolls((prev) => (prev ? [created, ...prev] : [created]))
      setCreating(false)
      setQuestion("")
      setOptions(["", ""])
      setAllowMultiple(false)
      setDeadlineKey("none")
      toast.show({ title: translate("Polling dibuat"), tone: "success", duration: 2500 })
      onCreated?.(created)
    } catch (err) {
      logWarn("chat:poll-create", err)
      toast.show({
        title: translate("Gagal membuat polling"),
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setSubmittingPoll(false)
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onRequestClose={onRequestClose}
      title="Polling"
      description="Buat voting untuk koordinasi — mis. jadwal COD atau patungan."
      avoidKeyboard
    >
      {creating ? (
        <View className="gap-3">
          <Input
            label="Pertanyaan"
            value={question}
            onChangeText={setQuestion}
            placeholder="Mis. Kapan kita COD?"
            maxLength={CHAT_POLL_QUESTION_MAX}
          />
          <View className="gap-2">
            <Text variant="caption" weight={600} tone="secondary">
              Opsi ({CHAT_POLL_MIN_OPTIONS}–{CHAT_POLL_MAX_OPTIONS})
            </Text>
            {options.map((opt, i) => (
              <View key={i} className="flex-row items-center gap-2">
                <View className="flex-1">
                  <Input
                    value={opt}
                    onChangeText={(v) =>
                      setOptions((prev) => prev.map((p, j) => (j === i ? v : p)))
                    }
                    placeholder={`Opsi ${i + 1}`}
                    maxLength={120}
                  />
                </View>
                {options.length > CHAT_POLL_MIN_OPTIONS ? (
                  // UX-TCH-006: target 44pt (min-h-11/min-w-11) + feedback
                  // scale; sebelumnya Pressable polos 32px tanpa feedback.
                  <PressableScale
                    onPress={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                    accessibilityRole="button"
                    accessibilityLabel={`Hapus opsi ${i + 1}`}
                    containerClassName="min-h-11 min-w-11 items-center justify-center rounded-full"
                  >
                    <Icon icon={Trash} size={16} tone="danger" />
                  </PressableScale>
                ) : null}
              </View>
            ))}
            {options.length < CHAT_POLL_MAX_OPTIONS ? (
              // UX-TCH-016: target 44pt (min-h-11) + feedback scale;
              // sebelumnya Pressable polos ~30px tanpa feedback.
              <PressableScale
                onPress={() => setOptions((prev) => [...prev, ""])}
                accessibilityRole="button"
                accessibilityLabel="Tambah opsi"
                className="flex-row items-center gap-1.5 py-2.5 min-h-11 rounded-sm"
              >
                <Icon icon={Plus} size={14} tone="active" />
                <Text variant="caption" weight={600} tone="primary">
                  Tambah opsi
                </Text>
              </PressableScale>
            ) : null}
          </View>
          <View className="flex-row items-center justify-between">
            <Text variant="body" tone="primary">
              Boleh pilih lebih dari satu
            </Text>
            <Switch value={allowMultiple} onChange={setAllowMultiple} />
          </View>
          <View className="gap-2">
            <Text variant="caption" weight={600} tone="secondary">
              Tenggat (opsional)
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {DEADLINE_PRESETS.map((p) => (
                <Pressable
                  key={p.key}
                  onPress={() => setDeadlineKey(p.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: deadlineKey === p.key }}
                  className={`rounded-full border px-3 py-1.5 ${
                    deadlineKey === p.key ? "border-primary bg-primary/10" : "border-border"
                  }`}
                >
                  <Text
                    variant="caption"
                    weight={600}
                    tone={deadlineKey === p.key ? "primary" : "secondary"}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button variant="secondary" onPress={() => setCreating(false)}>
                Batal
              </Button>
            </View>
            <View className="flex-1">
              <Button onPress={() => void handleCreate()} disabled={!canCreate || submittingPoll} loading={submittingPoll}>
                Buat polling
              </Button>
            </View>
          </View>
        </View>
      ) : (
        <View className="gap-3">
          <Button onPress={() => setCreating(true)} leftIcon={Plus}>
            {translate("Buat polling baru")}
          </Button>
          {/* Media #32: pembaruan live TIDAK mengganti daftar dengan spinner
              (pilihan yang sedang disusun hilang) — cukup indikator kecil. */}
          {loading && polls !== null ? (
            <View className="flex-row items-center gap-2">
              <Spinner size="sm" />
              <Text variant="caption" tone="secondary">
                {translate("Memperbarui polling…")}
              </Text>
            </View>
          ) : null}
          {polls === null ? (
            <View className="items-center py-8">
              <Spinner />
            </View>
          ) : polls.length === 0 ? (
            <EmptyState
              icon={ChartBar}
              title="Belum ada polling"
              description="Buat polling pertama untuk voting bersama di ruang ini."
            />
          ) : (
            polls.map((poll) => (
              <ChatPollCard
                key={poll.id}
                poll={poll}
                voting={votingId === poll.id}
                onVote={(id, idx) => void handleVote(id, idx)}
                isCreator={!!myUserId && poll.createdBy.userId === myUserId}
                closing={closingId === poll.id}
                onClose={(id) => void handleClose(id)}
              />
            ))
          )}
        </View>
      )}
    </BottomSheet>
  )
}
