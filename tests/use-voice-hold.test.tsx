/**
 * Audit chat C7 — mesin status "tahan untuk merekam" (lib/use-voice-hold).
 *
 * Perekam asli (expo-audio) diganti sesi palsu; yang dikunci adalah urutan
 * keputusannya, terutama balapan yang tidak bisa dites di perangkat secara
 * andal:
 *   - jari diangkat SEBELUM perekaman benar-benar mulai,
 *   - dialog izin mikrofon memutus gestur,
 *   - menekan tombol "Kirim" setelah terkunci vs. melepas jari yang mengunci,
 *   - batas durasi, buang, dan penolakan izin.
 */
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useVoiceHold, type VoiceSessionApi, type VoiceSessionStart } from "@/lib/use-voice-hold"
import {
  VOICE_CANCEL_DISTANCE_PX,
  VOICE_LOCK_DISTANCE_PX,
} from "@/lib/voice-note-gesture"
import { VOICE_NOTE_MAX_DURATION_MS, type VoiceNoteFile } from "@/lib/voice-note"

const FILE: VoiceNoteFile = {
  uri: "file:///vn.m4a",
  name: "vn-1.m4a",
  mimeType: "audio/mp4",
  size: 1234,
  durationMs: 4000,
}

function fakeSession(start: VoiceSessionStart | Promise<VoiceSessionStart> = { status: "started", prompted: false }) {
  const api = {
    start: vi.fn(() => Promise.resolve(start)),
    stop: vi.fn(async () => FILE as VoiceNoteFile | null),
    cancel: vi.fn(async () => undefined),
  } satisfies VoiceSessionApi
  return api
}

function setup(session: VoiceSessionApi | null, overrides: { disabled?: boolean } = {}) {
  const onRecorded = vi.fn()
  const onIssue = vi.fn()
  const onLimitReached = vi.fn()
  const hook = renderHook(() =>
    useVoiceHold({
      getSession: () => session,
      onRecorded,
      onIssue,
      onLimitReached,
      disabled: overrides.disabled,
    }),
  )
  return { ...hook, onRecorded, onIssue, onLimitReached }
}

/** Jari turun + tahan sampai rekaman benar-benar berjalan. */
async function hold(h: ReturnType<typeof setup>) {
  act(() => h.result.current.handleBegin())
  await act(async () => {
    h.result.current.handleHoldStart()
  })
}

describe("tahan lalu lepas", () => {
  it("lepas = kirim: berhenti, serahkan berkas, kembali idle", async () => {
    const session = fakeSession()
    const h = setup(session)
    expect(h.result.current.phase).toBe("idle")
    act(() => h.result.current.handleBegin())
    expect(h.result.current.phase).toBe("arming")
    await act(async () => {
      h.result.current.handleHoldStart()
    })
    expect(h.result.current.phase).toBe("holding")
    expect(session.start).toHaveBeenCalledTimes(1)

    await act(async () => {
      h.result.current.handleRelease()
    })
    expect(session.stop).toHaveBeenCalledTimes(1)
    expect(h.onRecorded).toHaveBeenCalledWith(FILE)
    expect(h.result.current.phase).toBe("idle")
  })

  it("tap cepat (tidak pernah menahan) tidak menyentuh perekam", async () => {
    const session = fakeSession()
    const h = setup(session)
    act(() => h.result.current.handleBegin())
    await act(async () => {
      h.result.current.handleRelease()
    })
    expect(h.result.current.phase).toBe("idle")
    expect(session.start).not.toHaveBeenCalled()
    expect(h.onRecorded).not.toHaveBeenCalled()
  })

  it("dinonaktifkan: ketukan jari tidak memulai apa pun", () => {
    const h = setup(fakeSession(), { disabled: true })
    act(() => h.result.current.handleBegin())
    expect(h.result.current.phase).toBe("idle")
  })
})

describe("geser untuk batal", () => {
  it("melewati ambang kiri lalu lepas = rekaman dibuang", async () => {
    const session = fakeSession()
    const h = setup(session)
    await hold(h)
    act(() => h.result.current.handleDrag(-VOICE_CANCEL_DISTANCE_PX, 0))
    expect(h.result.current.cancelArmed).toBe(true)
    await act(async () => {
      h.result.current.handleRelease()
    })
    expect(session.cancel).toHaveBeenCalledTimes(1)
    expect(session.stop).not.toHaveBeenCalled()
    expect(h.onRecorded).not.toHaveBeenCalled()
    expect(h.result.current.phase).toBe("idle")
  })

  it("jari kembali ke tengah sebelum lepas menyelamatkan rekaman", async () => {
    const session = fakeSession()
    const h = setup(session)
    await hold(h)
    act(() => h.result.current.handleDrag(-VOICE_CANCEL_DISTANCE_PX, 0))
    expect(h.result.current.cancelArmed).toBe(true)
    act(() => h.result.current.handleDrag(-4, 0))
    expect(h.result.current.cancelArmed).toBe(false)
    await act(async () => {
      h.result.current.handleRelease()
    })
    expect(h.onRecorded).toHaveBeenCalledWith(FILE)
    expect(session.cancel).not.toHaveBeenCalled()
  })
})

describe("geser untuk mengunci", () => {
  it("geser ke atas melewati ambang → terkunci; melepas jari tidak mengirim", async () => {
    const session = fakeSession()
    const h = setup(session)
    await hold(h)
    act(() => h.result.current.handleDrag(0, -VOICE_LOCK_DISTANCE_PX))
    expect(h.result.current.phase).toBe("locked")
    await act(async () => {
      h.result.current.handleRelease()
    })
    expect(h.result.current.phase).toBe("locked")
    expect(session.stop).not.toHaveBeenCalled()
    expect(session.cancel).not.toHaveBeenCalled()
    expect(h.onRecorded).not.toHaveBeenCalled()
  })

  it("terkunci → tombol Kirim mengirim", async () => {
    const session = fakeSession()
    const h = setup(session)
    await hold(h)
    act(() => h.result.current.handleDrag(0, -VOICE_LOCK_DISTANCE_PX))
    await act(async () => {
      h.result.current.send()
    })
    expect(session.stop).toHaveBeenCalledTimes(1)
    expect(h.onRecorded).toHaveBeenCalledWith(FILE)
    expect(h.result.current.phase).toBe("idle")
  })

  it("terkunci → menekan tombol (jari BARU) lalu melepas = kirim; jari yang mengunci tidak", async () => {
    const session = fakeSession()
    const h = setup(session)
    await hold(h)
    act(() => h.result.current.handleDrag(0, -VOICE_LOCK_DISTANCE_PX))
    // Jari pengunci diangkat: aman.
    await act(async () => {
      h.result.current.handleRelease()
    })
    expect(h.onRecorded).not.toHaveBeenCalled()
    // Jari baru menekan tombol Kirim.
    act(() => h.result.current.handleBegin())
    await act(async () => {
      h.result.current.handleRelease()
    })
    expect(h.onRecorded).toHaveBeenCalledTimes(1)
    expect(h.result.current.phase).toBe("idle")
  })

  it("terkunci → Buang membatalkan rekaman", async () => {
    const session = fakeSession()
    const h = setup(session)
    await hold(h)
    act(() => h.result.current.handleDrag(0, -VOICE_LOCK_DISTANCE_PX))
    await act(async () => {
      h.result.current.discard()
    })
    expect(session.cancel).toHaveBeenCalledTimes(1)
    expect(h.onRecorded).not.toHaveBeenCalled()
    expect(h.result.current.phase).toBe("idle")
  })

  it("setelah terkunci, gerakan jari berikutnya diabaikan", async () => {
    const h = setup(fakeSession())
    await hold(h)
    act(() => h.result.current.handleDrag(0, -VOICE_LOCK_DISTANCE_PX))
    act(() => h.result.current.handleDrag(-VOICE_CANCEL_DISTANCE_PX * 2, 0))
    expect(h.result.current.phase).toBe("locked")
    expect(h.result.current.cancelArmed).toBe(false)
  })
})

describe("balapan dengan perekam", () => {
  it("jari diangkat SEBELUM start() selesai: lepasan diproses setelah rekaman mulai", async () => {
    let finishStart!: (v: VoiceSessionStart) => void
    const startPromise = new Promise<VoiceSessionStart>((resolve) => {
      finishStart = resolve
    })
    const session = fakeSession(startPromise)
    const h = setup(session)
    act(() => h.result.current.handleBegin())
    await act(async () => {
      h.result.current.handleHoldStart()
    })
    // Lepas selagi perekam masih bersiap.
    await act(async () => {
      h.result.current.handleRelease()
    })
    expect(session.stop).not.toHaveBeenCalled()
    expect(h.onRecorded).not.toHaveBeenCalled()
    // Perekam siap → lepasan yang tertunda dijalankan.
    await act(async () => {
      finishStart({ status: "started", prompted: false })
      await startPromise
    })
    expect(session.stop).toHaveBeenCalledTimes(1)
    expect(h.onRecorded).toHaveBeenCalledWith(FILE)
    expect(h.result.current.phase).toBe("idle")
  })

  it("izin ditolak: pemberitahuan 'denied', kembali idle, tidak ada rekaman", async () => {
    const session = fakeSession({ status: "denied", prompted: true })
    const h = setup(session)
    await hold(h)
    expect(h.onIssue).toHaveBeenCalledWith("denied")
    expect(h.result.current.phase).toBe("idle")
    expect(h.onRecorded).not.toHaveBeenCalled()
  })

  it("tidak didukung (mis. web): pemberitahuan 'unsupported'", async () => {
    const h = setup(fakeSession({ status: "unsupported", prompted: false }))
    await hold(h)
    expect(h.onIssue).toHaveBeenCalledWith("unsupported")
    expect(h.result.current.phase).toBe("idle")
  })

  it("dialog izin pertama kali memutus gestur: rekaman 0 detik DIBUANG, pengguna diminta menahan lagi", async () => {
    const session = fakeSession({ status: "started", prompted: true })
    const h = setup(session)
    await hold(h)
    expect(session.cancel).toHaveBeenCalledTimes(1)
    expect(h.onIssue).toHaveBeenCalledWith("retry")
    expect(h.onRecorded).not.toHaveBeenCalled()
    expect(h.result.current.phase).toBe("idle")
  })

  it("sesi tidak pernah tersedia: gagal dengan 'unsupported', bukan menggantung", async () => {
    vi.useFakeTimers()
    try {
      const h = setup(null)
      act(() => h.result.current.handleBegin())
      const done = act(async () => {
        h.result.current.handleHoldStart()
        await vi.advanceTimersByTimeAsync(1000)
      })
      await done
      expect(h.onIssue).toHaveBeenCalledWith("unsupported")
      expect(h.result.current.phase).toBe("idle")
    } finally {
      vi.useRealTimers()
    }
  })

  it("stop() gagal (tanpa berkas): kembali idle tanpa mengirim apa pun", async () => {
    const session = fakeSession()
    session.stop.mockResolvedValueOnce(null)
    const h = setup(session)
    await hold(h)
    await act(async () => {
      h.result.current.handleRelease()
    })
    expect(h.onRecorded).not.toHaveBeenCalled()
    expect(h.result.current.phase).toBe("idle")
  })
})

describe("durasi", () => {
  it("handleDuration memperbarui timer", async () => {
    const h = setup(fakeSession())
    await hold(h)
    act(() => h.result.current.handleDuration(4200))
    expect(h.result.current.durationMs).toBe(4200)
  })

  it("batas durasi tercapai: pemberitahuan + kirim otomatis", async () => {
    const session = fakeSession()
    const h = setup(session)
    await hold(h)
    await act(async () => {
      h.result.current.handleDuration(VOICE_NOTE_MAX_DURATION_MS)
    })
    expect(h.onLimitReached).toHaveBeenCalledTimes(1)
    expect(session.stop).toHaveBeenCalledTimes(1)
    expect(h.onRecorded).toHaveBeenCalledWith(FILE)
  })

  it("durasi yang datang saat idle diabaikan (tick terlambat dari sesi yang sudah dibongkar)", () => {
    const h = setup(fakeSession())
    act(() => h.result.current.handleDuration(9999))
    expect(h.result.current.durationMs).toBe(0)
  })
})
