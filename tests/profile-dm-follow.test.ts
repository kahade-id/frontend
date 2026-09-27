/**
 * PRF-002/PRF-003 (audit 2026-09-27):
 * - `resolveFollowStatus` — status follow dibaca LANGSUNG dari payload
 *   profil (satu-satunya sumber kebenaran), bukan dari daftar followers.
 * - `getOrCreateDm` — POST /v1/chat/dm dengan username, tanpa pesan pertama.
 *
 * Dijalankan sebagai unit test node via `npm test` (vitest).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { resolveFollowStatus } from "@/lib/api/users"
import { getOrCreateDm } from "@/lib/api/chat"
import { setAccessToken, clearSession } from "@/lib/api/session"

// ------------------------------------------------------------------
// resolveFollowStatus
// ------------------------------------------------------------------

describe("resolveFollowStatus", () => {
  it("mengutamakan social.isFollowing dari backend", () => {
    const profile: any = { username: "toko", social: { isFollowing: true, followersCount: 5 } }
    expect(resolveFollowStatus(profile)).toBe(true)
  })

  it("fallback ke alias top-level isFollowing", () => {
    const profile: any = { username: "toko", social: {}, isFollowing: false }
    expect(resolveFollowStatus(profile)).toBe(false)
  })

  it("null bila backend tidak mengirim status (profil tak dikenal)", () => {
    expect(resolveFollowStatus({ username: "toko" } as any)).toBe(null)
    expect(resolveFollowStatus(null)).toBe(null)
  })

  it("TIDAK menyentuh daftar followers — pola lama yang bikin tombol Ikuti balik sendiri", () => {
    // Pola lama: GET followers?search=<me> lalu bandingkan user.id === me.id.
    // Daftar followers TIDAK menyertakan id internal (R1), jadi hasilnya
    // selalu false. Helper ini tidak boleh menerima input semacam itu.
    const followersWithoutIds: any[] = [
      { username: "aku", fullName: "Aku" },
      { username: "budi", fullName: "Budi" },
    ]
    const profile: any = { username: "toko", social: { isFollowing: true }, followers: followersWithoutIds }
    expect(resolveFollowStatus(profile)).toBe(true)
  })
})

// ------------------------------------------------------------------
// getOrCreateDm
// ------------------------------------------------------------------

describe("getOrCreateDm", () => {
  const jsonHeaders = { "content-type": "application/json" }

  beforeEach(async () => {
    await setAccessToken("access-token-test")
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    await clearSession()
  })

  it("POST /v1/chat/dm dengan username, tanpa pesan pertama", async () => {
    const seen: { url: string; init: RequestInit }[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        seen.push({ url, init })
        return new Response(
          JSON.stringify({ room: { id: "room-dm-1", type: "INQUIRY", status: "ACTIVE" } }),
          { status: 200, headers: jsonHeaders },
        )
      }),
    )

    const room = await getOrCreateDm("PenjualHebat")

    expect(seen).toHaveLength(1)
    expect(seen[0].url).toMatch(/\/v1\/chat\/dm$/)
    expect(seen[0].init.method).toBe("POST")
    expect(JSON.parse(String(seen[0].init.body))).toEqual({ username: "PenjualHebat" })
    expect(room.id).toBe("room-dm-1")
    expect((room as { type?: string }).type).toBe("INQUIRY")
  })

  it("melempar ApiError bila backend menolak (mis. blokir)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ code: "FORBIDDEN", message: "Cannot send messages — one party has blocked the other" }), {
          status: 403,
          headers: jsonHeaders,
        }),
      ),
    )
    await expect(getOrCreateDm("jahat")).rejects.toThrow()
  })
})
