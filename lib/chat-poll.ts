/**
 * Kahade — logika murni kartu polling chat (audit Pesan 2026-10-10, bug #8).
 *
 * Dipakai layar ruang chat (voting OPTIMISTIS + rollback) dan kartu polling
 * (keadaan terkunci). Tanpa React/RN supaya bisa diuji di Node.
 *
 * Kontrak backend (chat.service.ts `votePoll`): pilihan tunggal MENGGANTI
 * suara lama; pilihan ganda MENAMBAH (idempoten per opsi). `totalVotes` =
 * jumlah baris suara (bukan jumlah pemilih) — rumus di sini mengikuti itu
 * supaya angka optimistis sama dengan angka yang kemudian dikirim server.
 */
import type { ChatPoll } from "@/lib/api/chat"

/**
 * Terapkan suara saya ke `poll` secara lokal — bentuk yang sama dengan hasil
 * `votePoll` server, sehingga kartu langsung menampilkan pilihan + angka
 * baru tanpa menunggu jaringan. Indeks di luar jangkauan diabaikan.
 */
export function applyOptimisticVote(poll: ChatPoll, optionIndexes: readonly number[]): ChatPoll {
  const valid = [...new Set(optionIndexes)].filter(
    (i) => Number.isInteger(i) && i >= 0 && i < poll.options.length,
  )
  const previous = new Set(poll.myVotes)
  const next = poll.allowMultiple ? new Set([...previous, ...valid]) : new Set(valid.slice(0, 1))
  const options = poll.options.map((opt) => {
    const had = previous.has(opt.index)
    const has = next.has(opt.index)
    const delta = had === has ? 0 : has ? 1 : -1
    return delta === 0 ? opt : { ...opt, votes: Math.max(0, opt.votes + delta) }
  })
  const totalVotes = options.reduce((acc, o) => acc + o.votes, 0)
  return { ...poll, options, totalVotes, myVotes: [...next].sort((a, b) => a - b) }
}

export type PollLockState = "open" | "closed" | "expired"

/** Terkunci bila ditutup pembuat ATAU tenggat lewat (dibanding waktu server). */
export function pollLockState(
  poll: Pick<ChatPoll, "isClosed" | "deadline">,
  nowMs: number,
): PollLockState {
  if (poll.isClosed) return "closed"
  if (poll.deadline) {
    const t = Date.parse(poll.deadline)
    if (Number.isFinite(t) && t <= nowMs) return "expired"
  }
  return "open"
}

/** Persentase suara per opsi (0–100, dibulatkan) relatif terhadap total. */
export function pollOptionPercent(votes: number, totalVotes: number): number {
  if (!Number.isFinite(votes) || !Number.isFinite(totalVotes) || totalVotes <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((votes / totalVotes) * 100)))
}
