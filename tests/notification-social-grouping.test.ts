/**
 * Agregasi tampilan notifikasi sosial (2026-09-28).
 *
 * Invarian yang dikunci:
 *  - Hanya tipe allowlist (SHOWCASE_LIKE, USER_FOLLOW) yang digabung;
 *    tipe transaksi/keuangan (ORDER_*, WALLET_*, MILESTONE_*, …) TIDAK
 *    PERNAH digabung — tiap transaksi tetap baris sendiri.
 *  - Syarat gabung: berurutan, tipe sama, target referensi sama, selisih
 *    ≤ 24 jam, semua belum dibaca, minimal 2 item.
 *  - Label grup: "Budi dan 12 lainnya menyukai karya Anda"; fallback
 *    generik bila template judul tak dikenal (tidak mengarang nama).
 *  - Murni agregasi tampilan: id & urutan item tidak berubah.
 */
import { afterEach, describe, expect, it } from "vitest"

import {
  describeSocialGroup,
  groupSocialNotifications,
  notificationRowId,
  type NotificationRow,
} from "@/lib/notification-social-grouping"
import type { AppNotification } from "@/lib/api/notifications"
import { applyLanguage } from "@/lib/i18n/store"

afterEach(() => {
  applyLanguage("id")
})

function notif(over: Partial<AppNotification> & { id: string }): AppNotification {
  return {
    title: "Judul",
    body: "",
    category: "INFORMASI",
    type: null,
    isRead: false,
    createdAt: new Date(2026, 8, 28, 12, 0, 0).toISOString(),
    ...over,
  }
}

const like = (id: string, title: string, createdAt: string, refId = "post-1") =>
  notif({
    id,
    title,
    type: "SHOWCASE_LIKE",
    referenceType: "showcase",
    referenceId: refId,
    createdAt,
  })

const T = (h: number) => new Date(2026, 8, 28, 12 - h, 0, 0).toISOString()

describe("groupSocialNotifications", () => {
  it("menggabung 13 like berurutan jadi satu grup", () => {
    const items = Array.from({ length: 13 }, (_, i) =>
      like(`n${i}`, `User${i} menyukai karya Anda`, T(i)),
    )
    const rows = groupSocialNotifications(items)
    expect(rows).toHaveLength(1)
    expect(rows[0].kind).toBe("group")
    if (rows[0].kind === "group") expect(rows[0].items).toHaveLength(13)
  })

  it("tidak menggabung tipe transaksi/keuangan (zero tolerance)", () => {
    const items = ["n1", "n2", "n3"].map((id, i) =>
      notif({ id, type: "ORDER_PAYMENT_RECEIVED", title: "Pembayaran diterima", createdAt: T(i) }),
    )
    const rows = groupSocialNotifications(items)
    expect(rows).toHaveLength(3)
    expect(rows.every((r) => r.kind === "single")).toBe(true)
  })

  it("tidak menggabung tipe tak dikenal (allowlist eksplisit)", () => {
    const items = ["n1", "n2"].map((id, i) =>
      notif({ id, type: "SHOWCASE_COMMENT", title: "Komentar baru", createdAt: T(i) }),
    )
    expect(groupSocialNotifications(items).every((r) => r.kind === "single")).toBe(true)
  })

  it("tidak menggabung yang sudah dibaca", () => {
    const items = [
      like("n1", "Budi menyukai karya Anda", T(0)),
      { ...like("n2", "Ani menyukai karya Anda", T(1)), isRead: true },
      like("n3", "Cici menyukai karya Anda", T(2)),
    ]
    const rows = groupSocialNotifications(items)
    expect(rows).toHaveLength(3)
  })

  it("memisahkan grup bila target referensi berbeda", () => {
    const items = [
      like("n1", "Budi menyukai karya Anda", T(0), "post-1"),
      like("n2", "Ani menyukai karya Anda", T(1), "post-2"),
    ]
    expect(groupSocialNotifications(items)).toHaveLength(2)
  })

  it("memisahkan grup bila selisih > 24 jam", () => {
    const items = [
      like("n1", "Budi menyukai karya Anda", T(0)),
      like("n2", "Ani menyukai karya Anda", T(30)),
    ]
    expect(groupSocialNotifications(items)).toHaveLength(2)
  })

  it("satu item groupable = baris tunggal (minimal 2 untuk grup)", () => {
    const rows = groupSocialNotifications([like("n1", "Budi menyukai karya Anda", T(0))])
    expect(rows).toHaveLength(1)
    expect(rows[0].kind).toBe("single")
  })

  it("campuran: grup like + baris transaksi di antaranya tetap terpisah", () => {
    const items = [
      like("n1", "Budi menyukai karya Anda", T(0)),
      notif({ id: "tx", type: "WALLET_TRANSFER_RECEIVED", title: "Dana masuk", createdAt: T(1) }),
      like("n2", "Ani menyukai karya Anda", T(2)),
      like("n3", "Cici menyukai karya Anda", T(3)),
    ]
    const rows = groupSocialNotifications(items)
    expect(rows.map((r) => r.kind)).toEqual(["single", "single", "group"])
  })

  it("id baris stabil untuk keyExtractor", () => {
    const single: NotificationRow = { kind: "single", id: "n1", item: like("n1", "x", T(0)) }
    const group: NotificationRow = {
      kind: "group",
      id: "group:n1",
      items: [like("n1", "x", T(0)), like("n2", "y", T(1))],
    }
    expect(notificationRowId(single)).toBe("n1")
    expect(notificationRowId(group)).toBe("group:n1")
  })
})

describe("describeSocialGroup", () => {
  it('"Budi dan 12 lainnya menyukai karya Anda"', () => {
    const items = Array.from({ length: 13 }, (_, i) =>
      like(`n${i}`, i === 0 ? "Budi menyukai karya Anda" : `User${i} menyukai karya Anda`, T(i)),
    )
    expect(describeSocialGroup("SHOWCASE_LIKE", items)).toBe(
      "Budi dan 12 lainnya menyukai karya Anda",
    )
  })

  it("memakai sufiks template yang cocok (etalase)", () => {
    const items = [
      like("n1", "Budi menyukai etalase Anda", T(0)),
      like("n2", "Ani menyukai etalase Anda", T(1)),
    ]
    expect(describeSocialGroup("SHOWCASE_LIKE", items)).toBe(
      "Budi dan 1 lainnya menyukai etalase Anda",
    )
  })

  it("follow: \"Budi dan 1 lainnya mulai mengikuti Anda\"", () => {
    const items = ["n1", "n2"].map((id, i) =>
      notif({
        id,
        type: "USER_FOLLOW",
        title: i === 0 ? "Budi mulai mengikuti Anda" : "Ani mulai mengikuti Anda",
        createdAt: T(i),
      }),
    )
    expect(describeSocialGroup("USER_FOLLOW", items)).toBe(
      "Budi dan 1 lainnya mulai mengikuti Anda",
    )
  })

  it("fallback generik bila template tak dikenal (tidak mengarang nama)", () => {
    const items = [
      like("n1", "Seseorang berinteraksi dengan karya", T(0)),
      like("n2", "Interaksi lain", T(1)),
    ]
    expect(describeSocialGroup("SHOWCASE_LIKE", items)).toBe("2 suka baru di karya Anda")
  })

  it("tipe asing = judul item pertama apa adanya", () => {
    const items = [notif({ id: "n1", title: "Info", createdAt: T(0) })]
    expect(describeSocialGroup("SYSTEM_ANNOUNCEMENT", items)).toBe("Info")
  })
})
