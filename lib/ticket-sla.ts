/**
 * Kahade — SLA tiket dalam bahasa pengguna (batch 139, item F12).
 *
 * Status teknis (OPEN/IN_PROGRESS/WAITING_USER/…) belum menjelaskan kapan
 * pengguna perlu bertindak. Modul ini menerjemahkan status menjadi:
 * tahapan yang bisa dipahami, SIAPA pemilik langkah berikutnya, dan batas
 * respons bila tersedia.
 *
 * Keterbatasan jujur: backend belum mengirim field SLA (`slaDueAt` /
 * `responseDueAt` dibaca toleran bila suatu saat ada); tanpa itu, batas
 * respons ditampilkan sebagai "belum tersedia dari server" — TIDAK ada
 * janji waktu palsu.
 */
import type { SupportTicket } from "@/lib/api/support"

export type TicketSlaStage = {
  /** Label tahap untuk pengguna, mis. "Sedang ditangani". */
  stage: string
  /** Siapa yang memegang langkah berikutnya. */
  nextOwner: "agent" | "user" | "none"
  /** Penjelasan langkah berikutnya dalam bahasa pengguna. */
  nextStep: string
  /** Batas respons (teks siap tampil) — undefined bila tak tersedia. */
  responseDueLabel?: string
}

const NEXT_OWNER_LABEL: Record<TicketSlaStage["nextOwner"], string> = {
  agent: "Tim Kahade",
  user: "Anda",
  none: "—",
}

export function nextOwnerLabel(owner: TicketSlaStage["nextOwner"]): string {
  return NEXT_OWNER_LABEL[owner]
}

function pickSlaDue(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const rec = raw as Record<string, unknown>
  const v = rec.slaDueAt ?? rec.responseDueAt ?? rec.dueAt
  return typeof v === "string" && v ? v : undefined
}

/**
 * TIM 8 (perf, P2): `toLocaleString("id-ID", …)` membangun instance
 * `Intl.DateTimeFormat` di balik layar tiap panggilan `describeTicketSla`.
 * Instance di-cache lazy di module scope — keluarannya identik.
 */
let slaDueFormatter: Intl.DateTimeFormat | null = null

function getSlaDueFormatter(): Intl.DateTimeFormat {
  if (!slaDueFormatter) {
    slaDueFormatter = new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  }
  return slaDueFormatter
}

export function describeTicketSla(ticket: SupportTicket & Record<string, unknown>): TicketSlaStage {
  const dueRaw = pickSlaDue(ticket)
  const responseDueLabel = dueRaw
    ? getSlaDueFormatter().format(new Date(dueRaw))
    : undefined
  switch (ticket.status) {
    case "OPEN":
      return {
        stage: "Tiket diterima",
        nextOwner: "agent",
        nextStep: "Menunggu agen Kahade mengambil tiket ini. Anda tidak perlu melakukan apa pun.",
        responseDueLabel,
      }
    case "IN_PROGRESS":
      return {
        stage: "Sedang ditangani",
        nextOwner: "agent",
        nextStep: "Agen sedang menindaklanjuti. Pantau tiket ini untuk balasan terbaru.",
        responseDueLabel,
      }
    // SYS-A-002: case "WAITING_USER" dihapus — bukan nilai backend
    // (SupportTicketStatus: OPEN|IN_PROGRESS|RESOLVED|CLOSED) sehingga
    // unreachable di sini. Bila derivasi klien ESI-017 ("dihitung dari pesan
    // terakhir") diimplementasikan, teruskan status UI-nya sebagai argumen
    // terpisah, bukan via ticket.status.
    case "RESOLVED":
      return {
        stage: "Diselesaikan",
        nextOwner: "none",
        nextStep: "Masalah ditandai selesai. Bila belum benar-benar selesai, buka kembali tiket ini.",
        responseDueLabel,
      }
    case "CLOSED":
      return {
        stage: "Ditutup",
        nextOwner: "none",
        nextStep: "Tiket sudah ditutup. Buat tiket baru bila kendala muncul lagi.",
        responseDueLabel,
      }
    default:
      return {
        stage: "Diproses",
        nextOwner: "agent",
        nextStep: "Tiket Anda sedang diproses Tim Kahade.",
        responseDueLabel,
      }
  }
}
