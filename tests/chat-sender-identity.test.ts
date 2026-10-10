/**
 * Audit Pesan 2026-10-10 (#1) — identitas gelembung masuk dari PENGIRIM.
 *
 * Bug: di ruang transaksi/sengketa, pesan admin Kahade tampil dengan nama +
 * foto + seal lawan bicara (baris chat selalu memasang `counterpart`).
 * Pembaca mengira instruksi admin datang dari penjual — celah penipuan.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

import type { ChatMessage } from "@/lib/api/chat"
import { isSenderCounterpart, resolveIncomingSenderIdentity } from "@/lib/chat-sender-identity"

const counterpart = {
  id: "USR-SELLER",
  name: "Toko Budi",
  avatarUrl: "https://cdn.kahade.id/a/budi.jpg",
  sealTier: "gold" as const,
}

const incoming = (extra: Partial<ChatMessage> = {}): Pick<ChatMessage, "fromUser" | "messageType" | "sender"> => ({
  fromUser: false,
  messageType: "TEXT",
  ...extra,
})

describe("resolveIncomingSenderIdentity", () => {
  it("pesan admin (sender ≠ lawan bicara) memakai nama + foto admin, TANPA seal penjual", () => {
    const id = resolveIncomingSenderIdentity(
      incoming({
        sender: { id: "c_admin", userId: "USR-ADMIN", fullName: "Admin Kahade", avatarUrl: "https://cdn.kahade.id/a/admin.jpg" },
      }),
      counterpart,
      true,
    )
    expect(id).toEqual({
      name: "Admin Kahade",
      avatarUrl: "https://cdn.kahade.id/a/admin.jpg",
      sealTier: null,
    })
  })

  it("pesan lawan bicara (sender cocok) tetap membawa seal verifikasinya", () => {
    const id = resolveIncomingSenderIdentity(
      incoming({ sender: { userId: "USR-SELLER", fullName: "Toko Budi", avatarUrl: null } }),
      counterpart,
      true,
    )
    expect(id?.name).toBe("Toko Budi")
    expect(id?.sealTier).toBe("gold")
    // Foto dari sender (null) — bukan menimpa dengan foto lawan bicara.
    expect(id?.avatarUrl).toBeNull()
  })

  it("payload tanpa sender (lama/optimistis) → jatuh ke lawan bicara (perilaku lama)", () => {
    expect(resolveIncomingSenderIdentity(incoming(), counterpart, true)).toEqual({
      name: "Toko Budi",
      avatarUrl: counterpart.avatarUrl,
      sealTier: "gold",
    })
    // Nama sender kosong = tidak ada sender.
    expect(
      resolveIncomingSenderIdentity(incoming({ sender: { fullName: "   " } }), counterpart, true)?.name,
    ).toBe("Toko Budi")
  })

  it("DM 1:1 (identitas disembunyikan), pesan keluar, dan pesan sistem → null", () => {
    expect(resolveIncomingSenderIdentity(incoming(), counterpart, false)).toBeNull()
    expect(resolveIncomingSenderIdentity(incoming({ fromUser: true }), counterpart, true)).toBeNull()
    expect(
      resolveIncomingSenderIdentity(incoming({ messageType: "SYSTEM" }), counterpart, true),
    ).toBeNull()
  })

  it("tanpa data lawan bicara dan tanpa sender → null (tanpa kolom avatar)", () => {
    expect(resolveIncomingSenderIdentity(incoming(), undefined, true)).toBeNull()
  })
})

describe("isSenderCounterpart", () => {
  it("cocok lewat userId publik ATAU id internal", () => {
    expect(isSenderCounterpart({ userId: "USR-1" }, "USR-1")).toBe(true)
    expect(isSenderCounterpart({ id: "c_1" }, "c_1")).toBe(true)
    expect(isSenderCounterpart({ userId: "USR-2", id: "c_2" }, "USR-1")).toBe(false)
  })
  it("fail-closed bila salah satu kosong", () => {
    expect(isSenderCounterpart(null, "USR-1")).toBe(false)
    expect(isSenderCounterpart({ userId: "USR-1" }, "")).toBe(false)
    expect(isSenderCounterpart({ userId: "USR-1" }, undefined)).toBe(false)
  })
})

describe("baris chat memakai resolver (bukan counterpart langsung)", () => {
  const row = readFileSync(resolve(__dirname, "..", "components/ui/chat-message-row.tsx"), "utf8")
  it("prop bubble diisi dari senderIdentity", () => {
    expect(row).toContain("resolveIncomingSenderIdentity(message, counterpart, showSenderIdentity)")
    expect(row).toContain("senderName={senderIdentity?.name}")
    expect(row).not.toMatch(/senderName=\{!showSenderIdentity \|\| message\.fromUser/)
  })
  it("layar meneruskan id lawan bicara untuk pencocokan sender", () => {
    const screen = readFileSync(resolve(__dirname, "..", "components/screens/chat-room-screen.tsx"), "utf8")
    expect(screen).toMatch(/counterpartInfo = useMemo\([\s\S]*?id: room\?\.counterpart\?\.id \?\? null/)
  })
})
