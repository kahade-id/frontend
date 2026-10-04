/**
 * Kahade — kartu polling di chat (batch 43 FE-CHAT, 2026-09-28).
 *
 * Merender satu `ChatPoll`: pertanyaan, opsi + bar hasil, status pilihan
 * saya, tenggat, tombol "Tutup polling" (hanya pembuat, bila belum tutup).
 * Voting didelegasikan ke parent/sheet lewat `onVote` — kartu ini murni
 * tampilan + seleksi lokal.
 */
import { memo, useEffect, useMemo, useState } from "react"
import { View } from "react-native"

import type { ChatPoll } from "@/lib/api/chat"
import { formatDateTimeWIB } from "@/lib/format"

import { serverNow } from "@/lib/server-time"

import { Text } from "@/components/ui/text"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Button } from "@/components/ui/button"
import { ChartBar, CheckCircle, Clock, Lock } from "phosphor-react-native"

export type ChatPollCardProps = {
  poll: ChatPoll
  /** Voting berlangsung (nonaktifkan opsi). */
  voting?: boolean
  /** User menekan "Pilih" dengan indeks terpilih. */
  onVote: (pollId: string, optionIndexes: number[]) => void
  /** Pembuat menutup polling. */
  onClose?: (pollId: string) => void
  /** True bila saya pembuat polling ini. */
  isCreator?: boolean
  closing?: boolean
}

export const ChatPollCard = memo(function ChatPollCard({
  poll,
  voting = false,
  onVote,
  onClose,
  isCreator = false,
  closing = false,
}: ChatPollCardProps) {
  // 2026-10-02 (Bug 1): guard defensif — poll malformed (mis. dari response
  // API yang tidak terduga) tidak boleh crash seluruh aplikasi. Render null
  // daripada force close.
  //
  // Guard DIPINDAH ke bawah semua hook: `rules-of-hooks` melarang hook setelah
  // early return (urutan hook harus identik di setiap render). Keputusan render
  // tetap sama; semua pembacaan `poll` di atas guard memakai optional chaining
  // supaya data malformed tidak melempar sebelum guard tercapai.
  const malformed = !poll || typeof poll !== "object" || !Array.isArray(poll.options)
  const [picked, setPicked] = useState<number[]>(
    poll && Array.isArray(poll.myVotes) ? poll.myVotes : [],
  )
  // P2 (2026-10-03): sinkronkan saat prop berubah — useState initializer hanya
  // jalan sekali (mount). Tanpa ini, myVotes dari server (vote perangkat lain /
  // refresh) tidak tercermin di UI.
  useEffect(() => {
    setPicked(poll && Array.isArray(poll.myVotes) ? poll.myVotes : [])
  }, [poll?.myVotes])
  const closed = poll?.isClosed
  const expired = !closed && !!poll?.deadline && Date.parse(poll.deadline) <= serverNow()
  const locked = closed || expired

  const toggle = (index: number) => {
    if (locked || voting) return
    setPicked((prev) =>
      poll.allowMultiple
        ? prev.includes(index)
          ? prev.filter((i) => i !== index)
          : [...prev, index]
        : [index],
    )
  }

  const maxVotes = useMemo(
    () => Math.max(1, ...(poll && Array.isArray(poll.options) ? poll.options.map((o) => o.votes) : [])),
    [poll?.options],
  )

  // Guard defensif (Bug 1) — ditempatkan setelah semua hook, lihat catatan di atas.
  if (malformed) return null

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`Polling: ${poll.question}`}
      className="gap-2 rounded-md border border-border bg-surface p-3"
    >
      <View className="flex-row items-start gap-2">
        <Icon icon={ChartBar} size={18} tone="accent" />
        <View className="flex-1">
          <Text variant="body" weight={700} tone="primary">
            {poll.question}
          </Text>
          <Text variant="caption" tone="secondary">
            {poll.totalVotes} suara
            {poll.allowMultiple ? " • boleh pilih lebih dari satu" : ""}
            {poll.createdBy.fullName ? ` • oleh ${poll.createdBy.fullName}` : ""}
          </Text>
        </View>
      </View>

      <View className="gap-1.5">
        {poll.options.map((opt) => {
          const selected = picked.includes(opt.index)
          const pct = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0
          return (
            // UX-TCH-011: PressableScale (feedback scale saat ditekan);
            // sebelumnya Pressable polos tanpa feedback.
            <PressableScale
              key={opt.index}
              onPress={() => toggle(opt.index)}
              disabled={locked || voting}
              accessibilityRole={poll.allowMultiple ? "checkbox" : "radio"}
              accessibilityState={{ checked: selected, disabled: locked || voting }}
              accessibilityLabel={`${opt.text}, ${opt.votes} suara`}
              /* P2-16 (audit non-escrow 2026-10-03): hitSlop agar target
                 sentuh ≥44px (baris ±36px). */
              hitSlop={{ top: 4, bottom: 4 }}
              className={`overflow-hidden rounded-sm border ${
                selected ? "border-primary bg-primary/10" : "border-border bg-background"
              }`}
            >
              <View
                className="absolute inset-y-0 left-0 bg-primary/15"
                style={{ width: `${(opt.votes / maxVotes) * 100}%` }}
              />
              <View className="flex-row items-center gap-2 px-2.5 py-2">
                {selected ? (
                  <Icon icon={CheckCircle} size={16} tone="active" weight="fill" />
                ) : (
                  <View
                    className={`h-4 w-4 rounded-full border ${
                      poll.allowMultiple ? "rounded-sm" : "rounded-full"
                    } border-border-control`}
                  />
                )}
                <Text variant="body" tone="primary" className="flex-1">
                  {opt.text}
                </Text>
                <Text variant="caption" tone="secondary" className="tabular-nums">
                  {opt.votes} ({pct}%)
                </Text>
              </View>
            </PressableScale>
          )
        })}
      </View>

      {locked ? (
        <View className="flex-row items-center gap-1.5">
          <Icon icon={Lock} size={14} tone="default" />
          <Text variant="caption" tone="secondary">
            {closed ? "Polling ditutup." : "Tenggat polling lewat."}
          </Text>
        </View>
      ) : (
        <View className="gap-1.5">
          {poll.deadline ? (
            <View className="flex-row items-center gap-1">
              <Icon icon={Clock} size={12} tone="default" />
              <Text variant="caption" tone="secondary">
                Tenggat: {formatDateTimeWIB(poll.deadline)}
              </Text>
            </View>
          ) : null}
          <Button
            onPress={() => onVote(poll.id, picked)}
            disabled={voting || picked.length === 0}
            size="sm"
          >
            {voting ? "Mengirim…" : poll.myVotes.length > 0 ? "Ubah pilihan" : "Pilih"}
          </Button>
          {isCreator && onClose ? (
            <Button
              onPress={() => onClose(poll.id)}
              disabled={closing}
              variant="secondary"
              size="sm"
            >
              {closing ? "Menutup…" : "Tutup polling"}
            </Button>
          ) : null}
        </View>
      )}
    </View>
  )
})
