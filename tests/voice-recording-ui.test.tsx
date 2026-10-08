/**
 * Audit chat C7 — tampilan voice note tahan-untuk-merekam:
 * bar rekaman (menahan / terkunci), tombol mic, dan penggantian kolom ketik
 * di composer. Logika gestur ada di use-voice-hold.test.tsx / voice-note-gesture.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { ChatComposer } from "@/components/ui/chat-composer"
import { VoiceHoldMic } from "@/components/ui/voice-hold-mic"
import { VoiceRecordingBar } from "@/components/ui/voice-recording-bar"
import type { VoiceHoldController } from "@/lib/use-voice-hold"
import type { VoicePhase } from "@/lib/voice-note-gesture"

afterEach(cleanup)

function inTheme(ui: ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

const shared = (value = 0) => ({ value }) as never

function controller(over: Partial<VoiceHoldController> = {}): VoiceHoldController {
  return {
    phase: "idle" as VoicePhase,
    durationMs: 0,
    cancelArmed: false,
    lockProgress: shared(),
    cancelProgress: shared(),
    handleBegin: vi.fn(),
    handleHoldStart: vi.fn(),
    handleDrag: vi.fn(),
    handleRelease: vi.fn(),
    send: vi.fn(),
    discard: vi.fn(),
    handleDuration: vi.fn(),
    ...over,
  }
}

describe("<VoiceRecordingBar>", () => {
  it("menahan: timer + petunjuk 'Geser untuk batal', tanpa tombol buang", () => {
    inTheme(
      <VoiceRecordingBar
        phase="holding"
        durationMs={7_000}
        cancelProgress={shared()}
        cancelArmed={false}
        onDiscard={() => undefined}
      />,
    )
    expect(screen.getByText("0:07")).toBeTruthy()
    expect(screen.getByText("Geser untuk batal")).toBeTruthy()
    expect(screen.queryByLabelText("Buang rekaman")).toBeNull()
    expect(screen.queryByText("Rekaman terkunci")).toBeNull()
  })

  it("melewati ambang batal: petunjuk berubah jadi 'Lepas untuk membatalkan'", () => {
    inTheme(
      <VoiceRecordingBar
        phase="holding"
        durationMs={3_000}
        cancelProgress={shared(1)}
        cancelArmed
        onDiscard={() => undefined}
      />,
    )
    expect(screen.getByText("Lepas untuk membatalkan")).toBeTruthy()
    expect(screen.queryByText("Geser untuk batal")).toBeNull()
  })

  it("terkunci: tombol Buang + 'Rekaman terkunci'; timer dibacakan per 5 detik", () => {
    const onDiscard = vi.fn()
    inTheme(
      <VoiceRecordingBar
        phase="locked"
        durationMs={23_400}
        cancelProgress={shared()}
        cancelArmed={false}
        onDiscard={onDiscard}
      />,
    )
    expect(screen.getByText("0:23")).toBeTruthy()
    expect(screen.getByText("Rekaman terkunci")).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Buang rekaman"))
    expect(onDiscard).toHaveBeenCalledTimes(1)
    // Live region tidak membacakan tiap 250 ms: 23,4 dtk → "0:20".
    expect(screen.getByLabelText("Merekam 0:20")).toBeTruthy()
    expect(screen.queryByText("Geser untuk batal")).toBeNull()
  })
})

describe("<VoiceHoldMic>", () => {
  it("idle: tombol 'Rekam pesan suara' dengan petunjuk tahan/geser", () => {
    inTheme(<VoiceHoldMic voice={controller()} label="Rekam pesan suara" />)
    expect(screen.getByLabelText("Rekam pesan suara")).toBeTruthy()
    // Kapsul kunci hanya muncul saat menahan.
    expect(screen.queryByLabelText("Kirim pesan suara")).toBeNull()
  })

  it("terkunci: tombol berubah menjadi 'Kirim pesan suara'", () => {
    inTheme(<VoiceHoldMic voice={controller({ phase: "locked" })} label="Rekam pesan suara" />)
    expect(screen.getByLabelText("Kirim pesan suara")).toBeTruthy()
    expect(screen.queryByLabelText("Rekam pesan suara")).toBeNull()
  })
})

describe("<ChatComposer> dengan voice", () => {
  const base = {
    value: "",
    onChangeText: () => undefined,
    onSend: () => undefined,
    onMicPress: () => undefined,
  }

  it("idle: kolom ketik tampil, tidak ada bar rekaman", () => {
    inTheme(<ChatComposer {...base} voice={controller()} />)
    expect(screen.getByRole("textbox")).toBeTruthy()
    expect(screen.queryByText("Geser untuk batal")).toBeNull()
  })

  it("menahan: bar rekaman MENGGANTIKAN kolom ketik; mic tetap di tempatnya", () => {
    inTheme(<ChatComposer {...base} voice={controller({ phase: "holding", durationMs: 2_000 })} />)
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(screen.getByText("Geser untuk batal")).toBeTruthy()
    expect(screen.getByLabelText("Rekam pesan suara")).toBeTruthy()
  })

  it("terkunci: bar + tombol Buang; tombol aksi jadi 'Kirim pesan suara'", () => {
    const discard = vi.fn()
    inTheme(
      <ChatComposer
        {...base}
        voice={controller({ phase: "locked", durationMs: 9_000 })}
        onVoiceDiscard={discard}
      />,
    )
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(screen.getByLabelText("Kirim pesan suara")).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Buang rekaman"))
    expect(discard).toHaveBeenCalledTimes(1)
  })

  it("tanpa `voice` (live-support/sengketa) perilaku mic lama tidak berubah", () => {
    const onMicPress = vi.fn()
    inTheme(<ChatComposer {...base} onMicPress={onMicPress} />)
    fireEvent.click(screen.getByLabelText("Rekam pesan suara"))
    expect(onMicPress).toHaveBeenCalledTimes(1)
  })

  it("ada teks → tombol Kirim menggantikan mic walau voice tersedia", () => {
    inTheme(<ChatComposer {...base} value="halo" voice={controller()} />)
    expect(screen.getByLabelText("Kirim pesan")).toBeTruthy()
    expect(screen.queryByLabelText("Rekam pesan suara")).toBeNull()
  })
})
