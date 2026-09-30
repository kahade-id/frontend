/**
 * Kahade — sheet polling ruang chat (batch 43 FE-CHAT, 2026-09-28).
 *
 * Daftar polling (GET /v1/chat/rooms/{id}/polls) + buat baru + vote + tutup.
 * Seluruh state API hidup di sini; layar hanya membuka sheet dengan roomId.
 *
 * Batas backend (divalidasi juga di sini agar gagal cepat):
 * pertanyaan ≤300 char, opsi 2–10 @ ≤120 char, tenggat = preset opsional.
 */
import { useCallback, useEffect, useState } from "react"
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
import { logWarn } from "@/lib/telemetry"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { ChatPollCard } from "@/components/ui/chat-poll-card"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
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
   * NCC-006: pemicu refresh eksternal (event realtime `chat.poll_created` /
   * `chat.poll_updated` / `chat.poll_closed`). Sheet me-reload daftar bila
   * nilai ini berubah saat sheet terbuka.
   */
  refreshKey?: number
}

const DEADLINE_PRESETS = [
  { key: "none", label: "Tanpa tenggat", hours: 0 },
  { key: "1d", label: "1 hari", hours: 24 },
  { key: "3d", label: "3 hari", hours: 72 },
  { key: "7d", label: "7 hari", hours: 168 },
] as const

export function ChatPollsSheet({ visible, roomId, myUserId, onRequestClose, refreshKey }: ChatPollsSheetProps) {
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
        title: "Gagal memuat polling",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
      setPolls([])
    } finally {
      setLoading(false)
    }
  }, [roomId, toast])

  useEffect(() => {
    if (visible) {
      setPolls(null)
      setCreating(false)
      setQuestion("")
      setOptions(["", ""])
      setAllowMultiple(false)
      setDeadlineKey("none")
      void load()
    }
  }, [visible, load])

  // NCC-006: event realtime polling (dibuat/diubah/ditutup) dari layar room
  // tiba sebagai perubahan refreshKey — reload daftar bila sheet terbuka.
  useEffect(() => {
    if (visible && refreshKey !== undefined && polls !== null) {
      void load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

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
        title: "Gagal menyimpan pilihan",
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
      toast.show({ title: "Polling ditutup", tone: "success", duration: 2500 })
    } catch (err) {
      logWarn("chat:poll-close", err)
      toast.show({
        title: "Gagal menutup polling",
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
      toast.show({ title: "Polling dibuat", tone: "success", duration: 2500 })
    } catch (err) {
      logWarn("chat:poll-create", err)
      toast.show({
        title: "Gagal membuat polling",
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
                  <Pressable
                    onPress={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                    accessibilityRole="button"
                    accessibilityLabel={`Hapus opsi ${i + 1}`}
                    className="p-2"
                  >
                    <Icon icon={Trash} size={16} tone="danger" />
                  </Pressable>
                ) : null}
              </View>
            ))}
            {options.length < CHAT_POLL_MAX_OPTIONS ? (
              <Pressable
                onPress={() => setOptions((prev) => [...prev, ""])}
                accessibilityRole="button"
                accessibilityLabel="Tambah opsi"
                className="flex-row items-center gap-1.5 py-1"
              >
                <Icon icon={Plus} size={14} tone="active" />
                <Text variant="caption" weight={600} tone="primary">
                  Tambah opsi
                </Text>
              </Pressable>
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
            Buat polling baru
          </Button>
          {loading || polls === null ? (
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
