/**
 * 2026-10-05 — area gesture baris chat (ala WhatsApp): tekan lama & swipe
 * berlaku di SELURUH baris, umpan balik tetap di bubble.
 *
 * Kontrak yang dikunci:
 *  a. `resolveChatRowGesturePlan` — gerbang tunggal gesture baris (mode pilih,
 *     pesan terhapus, pesan sistem),
 *  b. `measureBubbleAnchor` — jangkar = node BUBBLE, fallback titik sentuh,
 *  c. permukaan tekan-lama baris memanggil handler YANG SAMA dengan tekan lama
 *     di bubble, dan hanya SATU yang terpanggil (responder terdalam menang) —
 *     tidak ada dobel-tembak antara baris & bubble,
 *  d. label aksesibilitas bubble tidak tertelan permukaan baris.
 */
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { useSharedValue } from "react-native-reanimated"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import { ChatMessageRow } from "@/components/ui/chat-message-row"
import type { ChatMessage } from "@/lib/api/chat"
import {
  SWIPE_REPLY_MAX_PX,
  SWIPE_REPLY_THRESHOLD_PX,
  measureBubbleAnchor,
  resolveChatRowGesturePlan,
} from "@/lib/chat-bubble"
import { useSwipeReplyPan } from "@/lib/use-swipe-reply-pan"

vi.mock("@/components/ui/voice-note-player", () => ({ VoiceNotePlayer: () => null }))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function renderInTheme(ui: ReactElement) {
  return render(
    <ThemeProvider>
      <PortalProvider>
        {ui}
        <PortalHost />
      </PortalProvider>
    </ThemeProvider>,
  )
}

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    messageType: "TEXT",
    fromUser: false,
    text: "Halo",
    createdAt: new Date(2026, 9, 5, 10, 0, 0).toISOString(),
    ...overrides,
  } as ChatMessage
}

const baseHandlers = {
  selecting: false,
  selected: false,
  readByCounterpart: false,
  onPress: () => undefined,
  onLongPress: () => undefined,
  onAttachmentPress: () => undefined,
}

describe("resolveChatRowGesturePlan — gerbang gesture tingkat baris", () => {
  it("pesan normal: swipe + tekan lama hidup", () => {
    expect(
      resolveChatRowGesturePlan({
        selecting: false,
        hasSwipeReply: true,
        hasLongPress: true,
      }),
    ).toEqual({ swipeReply: true, longPress: true })
  })

  it("mode pilih: swipe MATI (bentrok dengan toggle pilihan), tekan lama TETAP hidup", () => {
    expect(
      resolveChatRowGesturePlan({
        selecting: true,
        hasSwipeReply: true,
        hasLongPress: true,
      }),
    ).toEqual({ swipeReply: false, longPress: true })
  })

  it("pesan terhapus: kedua gesture MATI (tidak ada handler sama sekali)", () => {
    expect(
      resolveChatRowGesturePlan({
        selecting: false,
        isDeleted: true,
        hasSwipeReply: true,
        hasLongPress: true,
      }),
    ).toEqual({ swipeReply: false, longPress: false })
  })

  it("pesan sistem: kedua gesture MATI (kartu sistem bukan pesan yang bisa dibalas)", () => {
    expect(
      resolveChatRowGesturePlan({
        selecting: false,
        isSystem: true,
        hasSwipeReply: true,
        hasLongPress: true,
      }),
    ).toEqual({ swipeReply: false, longPress: false })
  })

  it("tanpa handler dari pemanggil: gesture tidak dipasang", () => {
    expect(
      resolveChatRowGesturePlan({
        selecting: false,
        hasSwipeReply: false,
        hasLongPress: false,
      }),
    ).toEqual({ swipeReply: false, longPress: false })
  })
})

describe("measureBubbleAnchor — jangkar dari node bubble, bukan titik sentuh", () => {
  it("node terukur → rect bubble (lebar/tinggi asli)", () => {
    const onAnchor = vi.fn()
    measureBubbleAnchor(
      { measureInWindow: (cb) => cb(10, 200, 180, 48) },
      { x: 330, y: 220 },
      onAnchor,
    )
    expect(onAnchor).toHaveBeenCalledWith({ x: 10, y: 200, width: 180, height: 48 })
  })

  it("pengukuran melempar → jatuh ke titik sentuh (width/height 0)", () => {
    const onAnchor = vi.fn()
    measureBubbleAnchor(
      {
        measureInWindow: () => {
          throw new Error("node belum siap")
        },
      },
      { x: 330, y: 220 },
      onAnchor,
    )
    expect(onAnchor).toHaveBeenCalledWith({ x: 330, y: 220, width: 0, height: 0 })
  })

  it("node null / tanpa measureInWindow → jatuh ke titik sentuh", () => {
    const onAnchor = vi.fn()
    measureBubbleAnchor(null, { x: 1, y: 2 }, onAnchor)
    measureBubbleAnchor({}, { x: 3, y: 4 }, onAnchor)
    expect(onAnchor).toHaveBeenNthCalledWith(1, { x: 1, y: 2, width: 0, height: 0 })
    expect(onAnchor).toHaveBeenNthCalledWith(2, { x: 3, y: 4, width: 0, height: 0 })
  })
})

/**
 * Stub RNGH mencatat callback gesture di `__handlers` (lihat
 * tests/stubs/react-native-gesture-handler.tsx) — cukup untuk mengunci
 * KONFIGURASI pan (clamp, ambang, fling, mati) tanpa gesture native.
 */
type StubGesture = {
  __kind: string
  __handlers: Record<string, (event: { translationX: number; velocityX: number }) => void>
}

describe("useSwipeReplyPan — satu konfigurasi pan untuk baris & bubble", () => {
  function setup({ enabled, onTrigger }: { enabled: boolean; onTrigger: () => void }) {
    return renderHook(() => {
      const swipeX = useSharedValue(0)
      const gesture = useSwipeReplyPan({ enabled, swipeX, onTrigger }) as unknown as StubGesture
      return { swipeX, gesture }
    })
  }

  it("saat mati: TIDAK ada worklet/closure yang dibuat (pan disabled)", () => {
    const { result } = setup({ enabled: false, onTrigger: vi.fn() })
    expect(result.current.gesture.__kind).toBe("Pan")
    expect(Object.keys(result.current.gesture.__handlers)).toHaveLength(0)
  })

  it("onUpdate: geser kanan dijepit ke +SWIPE_REPLY_MAX_PX", () => {
    const { result } = setup({ enabled: true, onTrigger: vi.fn() })
    act(() => {
      result.current.gesture.__handlers.onUpdate!({ translationX: 200, velocityX: 0 })
    })
    expect(result.current.swipeX.value).toBe(SWIPE_REPLY_MAX_PX)
  })

  // #11: dulu geser kiri DIJEPIT KE 0 — bubble sama sekali tidak bergerak,
  // gesture terasa mati. Kini bubble mengikuti jari ke dua arah.
  it("onUpdate: geser kiri MENGIKUTI jari (bubble bergerak), dijepit -MAX", () => {
    const { result } = setup({ enabled: true, onTrigger: vi.fn() })
    act(() => {
      result.current.gesture.__handlers.onUpdate!({ translationX: -40, velocityX: 0 })
    })
    expect(result.current.swipeX.value).toBe(-40)
    act(() => {
      result.current.gesture.__handlers.onUpdate!({ translationX: -200, velocityX: 0 })
    })
    expect(result.current.swipeX.value).toBe(-SWIPE_REPLY_MAX_PX)
  })

  it("onEnd geser kiri melewati ambang: tetap memicu balas", () => {
    const onTrigger = vi.fn()
    const { result } = setup({ enabled: true, onTrigger })
    act(() => {
      result.current.gesture.__handlers.onUpdate!({ translationX: -SWIPE_REPLY_THRESHOLD_PX, velocityX: 0 })
      result.current.gesture.__handlers.onEnd!({ translationX: -SWIPE_REPLY_THRESHOLD_PX, velocityX: 0 })
    })
    expect(onTrigger).toHaveBeenCalledTimes(1)
    expect(result.current.swipeX.value).toBe(0)
  })

  it("onEnd di bawah ambang: tidak memicu balas, translasi kembali 0", () => {
    const onTrigger = vi.fn()
    const { result } = setup({ enabled: true, onTrigger })
    act(() => {
      result.current.gesture.__handlers.onUpdate!({ translationX: 30, velocityX: 0 })
      result.current.gesture.__handlers.onEnd!({ translationX: 30, velocityX: 0 })
    })
    expect(onTrigger).not.toHaveBeenCalled()
    expect(result.current.swipeX.value).toBe(0)
  })

  it("onEnd melewati ambang translasi: memicu balas SEKALI", () => {
    const onTrigger = vi.fn()
    const { result } = setup({ enabled: true, onTrigger })
    act(() => {
      result.current.gesture.__handlers.onUpdate!({
        translationX: SWIPE_REPLY_THRESHOLD_PX,
        velocityX: 0,
      })
      result.current.gesture.__handlers.onEnd!({
        translationX: SWIPE_REPLY_THRESHOLD_PX,
        velocityX: 0,
      })
    })
    expect(onTrigger).toHaveBeenCalledTimes(1)
    expect(result.current.swipeX.value).toBe(0)
  })

  it("onEnd fling cepat: memicu balas walau translasi kecil", () => {
    const onTrigger = vi.fn()
    const { result } = setup({ enabled: true, onTrigger })
    act(() => {
      result.current.gesture.__handlers.onUpdate!({ translationX: 10, velocityX: 900 })
      result.current.gesture.__handlers.onEnd!({ translationX: 10, velocityX: 900 })
    })
    expect(onTrigger).toHaveBeenCalledTimes(1)
  })
})

describe("<ChatMessageRow>: seluruh baris adalah area tekan-lama", () => {
  it("tekan lama di AREA KOSONG baris memanggil onLongPress pesan ini", () => {
    vi.useFakeTimers()
    const onLongPress = vi.fn()
    const msg = message()
    renderInTheme(<ChatMessageRow message={msg} {...baseHandlers} onLongPress={onLongPress} />)

    const surface = screen.getByTestId("chat-message-row-surface")
    fireEvent.mouseDown(surface)
    act(() => {
      vi.advanceTimersByTime(700)
    })
    fireEvent.mouseUp(surface)

    expect(onLongPress).toHaveBeenCalledTimes(1)
    expect(onLongPress.mock.calls[0][0]).toBe(msg)
    expect(onLongPress.mock.calls[0][1]).toEqual(
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    )
  })

  it("tekan lama tepat di bubble TIDAK dobel (responder terdalam menang)", () => {
    vi.useFakeTimers()
    const onLongPress = vi.fn()
    const msg = message()
    renderInTheme(<ChatMessageRow message={msg} {...baseHandlers} onLongPress={onLongPress} />)

    fireEvent.mouseDown(screen.getByLabelText(/Halo/))
    act(() => {
      vi.advanceTimersByTime(700)
    })
    fireEvent.mouseUp(screen.getByLabelText(/Halo/))

    expect(onLongPress).toHaveBeenCalledTimes(1)
    expect(onLongPress.mock.calls[0][0]).toBe(msg)
  })

  it("label aksesibilitas bubble tetap ada (permukaan baris tidak menelannya)", () => {
    renderInTheme(<ChatMessageRow message={message()} {...baseHandlers} />)
    expect(screen.getByTestId("chat-message-row-surface")).toBeTruthy()
    expect(screen.getByLabelText(/Halo/)).toBeTruthy()
  })

  it("pesan terhapus: tekan lama tidak memanggil apa pun", () => {
    vi.useFakeTimers()
    const onLongPress = vi.fn()
    renderInTheme(
      <ChatMessageRow message={message({ isDeleted: true })} {...baseHandlers} onLongPress={onLongPress} />,
    )

    const surface = screen.getByTestId("chat-message-row-surface")
    fireEvent.mouseDown(surface)
    act(() => {
      vi.advanceTimersByTime(700)
    })
    fireEvent.mouseUp(surface)

    expect(onLongPress).not.toHaveBeenCalled()
  })

  it("pesan sistem: tekan lama tidak memanggil apa pun", () => {
    vi.useFakeTimers()
    const onLongPress = vi.fn()
    renderInTheme(
      <ChatMessageRow
        message={message({ messageType: "SYSTEM", text: "Dana ditahan" })}
        {...baseHandlers}
        onLongPress={onLongPress}
      />,
    )

    const surface = screen.getByTestId("chat-message-row-surface")
    fireEvent.mouseDown(surface)
    act(() => {
      vi.advanceTimersByTime(700)
    })
    fireEvent.mouseUp(surface)

    expect(onLongPress).not.toHaveBeenCalled()
    expect(screen.getByText("Dana ditahan")).toBeTruthy()
  })
})
