/**
 * Log crash lokal (Bug 1, 2026-10-08) — lib/crash-log.
 *
 * Yang dikunci: hanya kejadian ERROR yang disimpan; batas 50 entri (yang
 * terlama dibuang); berkas rusak tidak melempar; kejadian yang datang sebelum
 * berkas siap dimuat dan ikut tertulis; `global-fatal` ditulis sinkron; dan
 * penulisan async selalu menyerialisasi isi TERBARU.
 */
import { describe, expect, it } from "vitest"

import {
  CRASH_LOG_MAX_ENTRIES,
  appendCrashEntry,
  createCrashLogRecorder,
  isCrashWorthy,
  parseCrashLog,
  serializeCrashLog,
  type CrashLogStore,
} from "@/lib/crash-log"
import type { TelemetryEvent } from "@/lib/telemetry"

const event = (over: Partial<TelemetryEvent> = {}): TelemetryEvent => ({
  level: "error",
  scope: "chat:row-render",
  message: "boom",
  at: 1_700_000_000_000,
  platform: "android",
  ...over,
})

/** Penyimpanan memori: mencatat setiap tulis (untuk memeriksa urutan & isi). */
function memoryStore(initial: string | null = null) {
  const state = { content: initial, syncWrites: [] as string[], asyncWrites: [] as string[] }
  const store: CrashLogStore = {
    async read() {
      return state.content
    },
    async write(content) {
      await Promise.resolve()
      state.asyncWrites.push(content)
      state.content = content
    },
    writeSync(content) {
      state.syncWrites.push(content)
      state.content = content
    },
  }
  return { store, state }
}

describe("aturan penyimpanan", () => {
  it("hanya level error yang layak disimpan (warn diabaikan)", () => {
    expect(isCrashWorthy(event({ level: "error" }))).toBe(true)
    expect(isCrashWorthy(event({ level: "warn" }))).toBe(false)
  })

  it("batas 50 entri: yang terlama dibuang, yang terbaru dipertahankan", () => {
    let entries: TelemetryEvent[] = []
    for (let i = 0; i < CRASH_LOG_MAX_ENTRIES + 7; i++) {
      entries = appendCrashEntry(entries, event({ message: `m${i}`, at: i }))
    }
    expect(entries).toHaveLength(CRASH_LOG_MAX_ENTRIES)
    expect(entries[0].message).toBe("m7")
    expect(entries.at(-1)?.message).toBe(`m${CRASH_LOG_MAX_ENTRIES + 6}`)
  })

  it("berkas rusak / bentuk tak dikenal → daftar kosong, tidak melempar", () => {
    expect(parseCrashLog("{ bukan json")).toEqual([])
    expect(parseCrashLog('{"entries":"bukan-array"}')).toEqual([])
    expect(parseCrashLog(null)).toEqual([])
    // Entri yang cacat dibuang, yang sah tetap dibaca.
    const mixed = JSON.stringify({
      version: 1,
      entries: [{ nope: true }, event({ message: "sah" })],
    })
    expect(parseCrashLog(mixed).map((e) => e.message)).toEqual(["sah"])
  })

  it("serialisasi → parse adalah identitas untuk entri yang sah", () => {
    const entries = [event({ message: "a" }), event({ level: "error", scope: "global-fatal", message: "b", apiCode: "NETWORK", status: 503 })]
    expect(parseCrashLog(serializeCrashLog(entries))).toEqual(entries)
  })
})

describe("createCrashLogRecorder", () => {
  it("kejadian warn tidak pernah menyentuh berkas", async () => {
    const { store, state } = memoryStore()
    const rec = createCrashLogRecorder()
    await rec.attach(store)
    rec.record(event({ level: "warn", scope: "chat:poll" }))
    await new Promise((r) => setTimeout(r, 0))
    expect(state.asyncWrites).toEqual([])
    expect(state.syncWrites).toEqual([])
    expect(rec.entries()).toEqual([])
  })

  it("error biasa ditulis async; isi berkas memuat entri itu", async () => {
    const { store, state } = memoryStore()
    const rec = createCrashLogRecorder()
    await rec.attach(store)
    rec.record(event({ message: "render gagal" }))
    await new Promise((r) => setTimeout(r, 5))
    expect(parseCrashLog(state.content).map((e) => e.message)).toEqual(["render gagal"])
  })

  it("global-fatal ditulis SINKRON (sebelum proses bisa mati)", async () => {
    const { store, state } = memoryStore()
    const rec = createCrashLogRecorder()
    await rec.attach(store)
    rec.record(event({ scope: "global-fatal", message: "Tried to synchronously call a Remote Function" }))
    // Tanpa menunggu apa pun: harus sudah ada di sync writes.
    expect(state.syncWrites).toHaveLength(1)
    expect(parseCrashLog(state.syncWrites[0]).at(-1)?.message).toContain("Remote Function")
  })

  it("kejadian sebelum attach ikut tertulis begitu berkas siap, digabung dengan isi lama", async () => {
    const previous = serializeCrashLog([event({ message: "sesi-lalu" })])
    const { store, state } = memoryStore(previous)
    const rec = createCrashLogRecorder()
    rec.record(event({ message: "sebelum-siap" }))
    await rec.attach(store)
    await new Promise((r) => setTimeout(r, 5))
    expect(parseCrashLog(state.content).map((e) => e.message)).toEqual(["sesi-lalu", "sebelum-siap"])
  })

  it("penulisan async tertunda tidak menimpa entri fatal yang lebih baru", async () => {
    const { store, state } = memoryStore()
    const rec = createCrashLogRecorder()
    await rec.attach(store)
    rec.record(event({ message: "pertama" })) // async, tertunda
    rec.record(event({ scope: "global-fatal", message: "fatal" })) // sinkron
    await new Promise((r) => setTimeout(r, 10))
    const last = parseCrashLog(state.content).map((e) => e.message)
    expect(last).toEqual(["pertama", "fatal"])
  })

  it("kegagalan tulis tidak melempar ke pemanggil (log crash tidak boleh jadi sumber crash)", async () => {
    const failing: CrashLogStore = {
      async read() {
        throw new Error("io")
      },
      async write() {
        throw new Error("io")
      },
      writeSync() {
        throw new Error("io")
      },
    }
    const rec = createCrashLogRecorder()
    await expect(rec.attach(failing)).resolves.toBeUndefined()
    expect(() => rec.record(event({ scope: "global-fatal" }))).not.toThrow()
    expect(() => rec.record(event())).not.toThrow()
  })
})
