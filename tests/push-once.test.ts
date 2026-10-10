/**
 * DT-06 (audit etalase 2026-10-10): tap ganda cepat pada tombol navigasi
 * tidak boleh menumpuk dua layar yang sama.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("expo-router", () => ({ router: { push: vi.fn(), canGoBack: () => false, back: vi.fn(), replace: vi.fn() } }))

import { PUSH_ONCE_WINDOW_MS, pushOnce, resetPushOnceForTests } from "@/lib/push-once"

beforeEach(() => resetPushOnceForTests())

describe("pushOnce", () => {
  it("push kedua ke tujuan yang sama dalam jendela singkat dibuang", () => {
    const nav = { push: vi.fn() }
    expect(pushOnce("/create-transaction", nav, 1000)).toBe(true)
    expect(pushOnce("/create-transaction", nav, 1000 + PUSH_ONCE_WINDOW_MS - 1)).toBe(false)
    expect(nav.push).toHaveBeenCalledTimes(1)
  })

  it("setelah jendela lewat, push ke tujuan yang sama berjalan lagi", () => {
    const nav = { push: vi.fn() }
    pushOnce("/create-transaction", nav, 1000)
    expect(pushOnce("/create-transaction", nav, 1000 + PUSH_ONCE_WINDOW_MS)).toBe(true)
    expect(nav.push).toHaveBeenCalledTimes(2)
  })

  it("tujuan berbeda tidak pernah dibuang; href objek dibandingkan per isi", () => {
    const nav = { push: vi.fn() }
    pushOnce("/a", nav, 1000)
    expect(pushOnce("/b", nav, 1001)).toBe(true)
    expect(pushOnce({ pathname: "/p/[id]", params: { id: "1" } }, nav, 1002)).toBe(true)
    expect(pushOnce({ pathname: "/p/[id]", params: { id: "1" } }, nav, 1003)).toBe(false)
    expect(pushOnce({ pathname: "/p/[id]", params: { id: "2" } }, nav, 1004)).toBe(true)
    expect(nav.push).toHaveBeenCalledTimes(4)
  })
})
