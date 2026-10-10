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
import { translate, useLanguage } from "@/lib/i18n"
import { pollLockState, pollOptionPercent } from "@/lib/chat-poll"
import { useClockTick } from "@/lib/use-clock-tick"
import { summarize } from "@/lib/a11y"
import { hitSlopToReach } from "@/lib/hit-slop"
import { tokens } from "@/lib/tokens"

import { serverNow } from "@/lib/server-time"

import { Text } from "@/components/ui/text"
import { CardSummary } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Button } from "@/components/ui/button"
import { ChartBar, CheckCircle, Clock, Lock } from "phosphor-react-native"

/** Tinggi visual baris opsi: body 24 + py-2 (2 × space[2]) = 40 → slop vertikal 2px ke target 44. */
const POLL_OPTION_HEIGHT = tokens.typography.body.lineHeight + 2 * tokens.space[2]

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
  useLanguage()
  const malformed = !poll || typeof poll !== "object" || !Array.isArray(poll.options)
  const myVotes = poll && Array.isArray(poll.myVotes) ? poll.myVotes : []
  const [picked, setPicked] = useState<number[]>(myVotes)
  // P2 (2026-10-03): sinkronkan saat prop berubah — useState initializer hanya
  // jalan sekali (mount). Bug #8 (2026-10-10, media #16): deps memakai ISI
  // (string), bukan referensi array — refetch poll (suara orang lain) dulu
  // membuat array baru tiap kali dan menghapus pilihan yang sedang disusun.
  const myVotesKey = myVotes.join(",")
  useEffect(() => {
    setPicked(myVotesKey ? myVotesKey.split(",").map(Number) : [])
  }, [myVotesKey])
  // Media #30: tenggat dicek ulang tiap menit selama kartu tampil & belum terkunci.
  const hasDeadline = !!poll?.deadline && !poll?.isClosed
  useClockTick(hasDeadline)
  const lock = poll ? pollLockState(poll, serverNow()) : "open"
  const closed = lock === "closed"
  const locked = lock !== "open"

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

  const totalVotes = typeof poll?.totalVotes === "number" ? poll.totalVotes : 0
  const summary = useMemo(() => {
    const parts = [translate("{x} suara", { x: totalVotes })]
    if (poll?.allowMultiple) parts.push(translate("boleh pilih lebih dari satu"))
    const author = poll?.createdBy?.fullName
    if (author) parts.push(translate("oleh {x}", { x: author }))
    return parts.join(" • ")
  }, [totalVotes, poll?.allowMultiple, poll?.createdBy?.fullName])

  // Guard defensif (Bug 1) — ditempatkan setelah semua hook, lihat catatan di atas.
  if (malformed) return null

  return (
    <View className="gap-2 rounded-md border border-border bg-surface p-3">
      {/* Kepala polling = satu grup SR; opsi & tombol di bawahnya tetap fokusable (audit #4). */}
      <CardSummary
        label={summarize([translate("Polling: {x}", { x: poll.question }), summary])}
        className="flex-row items-start gap-2"
      >
        <Icon icon={ChartBar} size={18} tone="accent" />
        <View className="flex-1">
          <Text variant="body" weight={700} tone="primary">
            {poll.question}
          </Text>
          <Text variant="caption" tone="secondary">
            {summary}
          </Text>
        </View>
      </CardSummary>

      <View className="gap-1.5">
        {poll.options.map((opt) => {
          const selected = picked.includes(opt.index)
          // Media #17: bar DAN angka memakai persen dari total yang sama.
          const pct = pollOptionPercent(opt.votes, totalVotes)
          return (
            // UX-TCH-011: PressableScale (feedback scale saat ditekan);
            // sebelumnya Pressable polos tanpa feedback.
            <PressableScale
              key={opt.index}
              onPress={() => toggle(opt.index)}
              disabled={locked || voting}
              accessibilityRole={poll.allowMultiple ? "checkbox" : "radio"}
              accessibilityState={{ checked: selected, disabled: locked || voting }}
              accessibilityLabel={translate("{x}, {y} suara", { x: opt.text, y: opt.votes })}
              /* P2-16 (audit non-escrow 2026-10-03): slop VERTIKAL saja agar target
                 sentuh ≥44px tanpa menumpuk dengan opsi tetangga (gap-1.5). */
              hitSlop={hitSlopToReach(tokens.a11y.minHitTarget, POLL_OPTION_HEIGHT)}
              className={`overflow-hidden rounded-sm border ${
                selected ? "border-primary bg-primary/10" : "border-border bg-background"
              }`}
            >
              <View
                className="absolute inset-y-0 left-0 bg-primary/15"
                style={{ width: `${pct}%` }}
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
            {closed ? translate("Polling ditutup.") : translate("Tenggat polling lewat.")}
          </Text>
        </View>
      ) : (
        <View className="gap-1.5">
          {poll.deadline ? (
            <View className="flex-row items-center gap-1">
              <Icon icon={Clock} size={12} tone="default" />
              <Text variant="caption" tone="secondary">
                {translate("Tenggat: {x}", { x: formatDateTimeWIB(poll.deadline) })}
              </Text>
            </View>
          ) : null}
          <Button
            onPress={() => onVote(poll.id, picked)}
            disabled={voting || picked.length === 0}
            size="sm"
          >
            {voting
              ? translate("Mengirim…")
              : myVotes.length > 0
                ? translate("Ubah pilihan")
                : translate("Pilih")}
          </Button>
          {isCreator && onClose ? (
            <Button
              onPress={() => onClose(poll.id)}
              disabled={closing}
              variant="secondary"
              size="sm"
            >
              {closing ? translate("Menutup…") : translate("Tutup polling")}
            </Button>
          ) : null}
        </View>
      )}
    </View>
  )
})
