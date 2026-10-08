/**
 * Kahade — mesin status voice note "tahan untuk merekam" ala WhatsApp
 * (audit chat C7).
 *
 * Alur:   idle ─(jari turun)→ arming ─(tahan ≥ VOICE_HOLD_MS)→ holding
 *         holding ─(geser ke atas melewati ambang)→ locked
 *         holding ─(lepas)→ kirim | (lepas setelah geser kiri jauh)→ batal
 *         locked  ─(tombol kirim)→ kirim | (tombol buang)→ batal
 *
 * Hook ini TIDAK menyentuh audio: perekam (expo-audio) dipegang `getSession()`
 * — komponen headless yang di-mount hanya selama ada interaksi. Pemisahan itu
 * membuat urutan yang rawan balapan bisa diuji dengan sesi palsu:
 *
 *   - Jari diangkat SEBELUM `start()` selesai (izin/persiapan perekam butuh
 *     ratusan ms): lepasan dicatat dan diproses begitu perekaman benar-benar
 *     berjalan — bukan dibuang, bukan dibiarkan merekam tanpa ujung.
 *   - Gestur DIBATALKAN OS oleh dialog izin mikrofon pertama kali: rekaman yang
 *     baru jalan tidak boleh dikirim sebagai pesan 0 detik; pengguna diminta
 *     menahan lagi (`onIssue("retry")`).
 *   - Aplikasi masuk latar belakang: rekaman dibuang (tidak ada mikrofon yang
 *     menyala tanpa sepengetahuan pengguna).
 *   - Batas durasi (5 menit): kirim otomatis + pemberitahuan.
 *
 * Callback gestur berjalan di thread JS (`runOnJS(true)` di komponen) dan
 * semua handler stabil (hanya membaca ref) — gestur tidak dibuat ulang di
 * tengah rekaman.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { AppState } from "react-native"
import { useSharedValue, type SharedValue } from "react-native-reanimated"

import { haptic } from "@/lib/haptics"
import {
  resolveVoiceDrag,
  resolveVoiceRelease,
  type VoiceDragAxis,
  type VoiceDragResult,
  type VoicePhase,
} from "@/lib/voice-note-gesture"
import { VOICE_NOTE_MAX_DURATION_MS, type VoiceNoteFile } from "@/lib/voice-note"

export type VoiceSessionStart = {
  status: "started" | "denied" | "unsupported"
  /** Dialog izin sistem MUNCUL pada panggilan ini (gestur pasti terputus OS). */
  prompted: boolean
}

/** Antarmuka sesi perekam — diimplementasikan <VoiceNoteSession>. */
export type VoiceSessionApi = {
  start: () => Promise<VoiceSessionStart>
  /** Hentikan lalu kembalikan berkas; `null` bila tak ada rekaman valid. */
  stop: () => Promise<VoiceNoteFile | null>
  /** Hentikan dan buang. */
  cancel: () => Promise<void>
}

export type VoiceIssue = "denied" | "unsupported" | "retry"

export type VoiceHoldOptions = {
  /** Sesi perekam saat ini (null bila belum ter-mount). */
  getSession: () => VoiceSessionApi | null
  /** Rekaman selesai → serahkan ke pemanggil (validasi durasi/ukuran di sana). */
  onRecorded: (file: VoiceNoteFile) => void
  onIssue: (issue: VoiceIssue) => void
  /** Batas durasi tercapai (rekaman otomatis dikirim). */
  onLimitReached?: () => void
  disabled?: boolean
}

export type VoiceHoldController = {
  phase: VoicePhase
  durationMs: number
  /** Jari sudah melewati ambang batal — dilepas sekarang = rekaman dibuang. */
  cancelArmed: boolean
  lockProgress: SharedValue<number>
  cancelProgress: SharedValue<number>
  handleBegin: () => void
  handleHoldStart: () => void
  handleDrag: (dx: number, dy: number) => void
  handleRelease: () => void
  /** Dari tombol kirim (mode terkunci). */
  send: () => void
  /** Dari tombol buang (mode terkunci). */
  discard: () => void
  /** Dari sesi: durasi rekaman terkini (ms). */
  handleDuration: (ms: number) => void
}

const IDLE_DRAG = resolveVoiceDrag(0, 0)

/** Baca fase TERKINI — TS menyempitkan `ref.current` melewati `await` secara keliru. */
function readPhase(ref: { current: VoicePhase }): VoicePhase {
  return ref.current
}
const SESSION_WAIT_MS = 800
const SESSION_POLL_MS = 30
/** Selisih (ms) dari batas sebelum dianggap "mencapai batas". */
const LIMIT_SLACK_MS = 300

export function useVoiceHold(options: VoiceHoldOptions): VoiceHoldController {
  const optionsRef = useRef(options)
  optionsRef.current = options

  const [phase, setPhaseState] = useState<VoicePhase>("idle")
  const phaseRef = useRef<VoicePhase>("idle")
  const [durationMs, setDurationMs] = useState(0)
  const [cancelArmed, setCancelArmed] = useState(false)
  const cancelArmedRef = useRef(false)
  const lockProgress = useSharedValue(0)
  const cancelProgress = useSharedValue(0)

  const axisRef = useRef<VoiceDragAxis>("none")
  const dragRef = useRef<VoiceDragResult>(IDLE_DRAG)
  /** `session.start()` sedang berjalan. */
  const startingRef = useRef(false)
  /** Jari diangkat selagi `start()` berjalan — diproses setelahnya. */
  const pendingReleaseRef = useRef<"send" | "cancel" | null>(null)
  /** `stop()/cancel()` sedang berjalan — cegah selesai ganda. */
  const finishingRef = useRef(false)
  /**
   * Jari BARU turun saat rekaman sudah terkunci (= menekan tombol "Kirim").
   * Dibedakan dari jari yang BARU SAJA menggeser untuk mengunci: melepasnya
   * tidak boleh langsung mengirim.
   */
  const pressWhileLockedRef = useRef(false)

  const setPhase = useCallback((next: VoicePhase) => {
    phaseRef.current = next
    setPhaseState(next)
  }, [])

  const setArmed = useCallback((armed: boolean) => {
    if (cancelArmedRef.current === armed) return
    cancelArmedRef.current = armed
    setCancelArmed(armed)
  }, [])

  const resetUi = useCallback(() => {
    setPhase("idle")
    setDurationMs(0)
    setArmed(false)
    axisRef.current = "none"
    dragRef.current = IDLE_DRAG
    pressWhileLockedRef.current = false
    lockProgress.value = 0
    cancelProgress.value = 0
    startingRef.current = false
    pendingReleaseRef.current = null
  }, [cancelProgress, lockProgress, setArmed, setPhase])

  const finish = useCallback(
    async (action: "send" | "cancel") => {
      if (finishingRef.current) return
      finishingRef.current = true
      try {
        const session = optionsRef.current.getSession()
        if (action === "cancel") {
          await session?.cancel().catch(() => undefined)
          resetUi()
          return
        }
        const file = session ? await session.stop().catch(() => null) : null
        resetUi()
        if (file) optionsRef.current.onRecorded(file)
      } finally {
        finishingRef.current = false
      }
    },
    [resetUi],
  )

  const handleBegin = useCallback(() => {
    if (optionsRef.current.disabled || finishingRef.current) return
    if (phaseRef.current === "locked") {
      pressWhileLockedRef.current = true
      return
    }
    if (phaseRef.current !== "idle") return
    pressWhileLockedRef.current = false
    setPhase("arming")
  }, [setPhase])

  const handleHoldStart = useCallback(async () => {
    if (phaseRef.current !== "arming") return
    setPhase("holding")
    haptic("light")
    startingRef.current = true
    pendingReleaseRef.current = null

    // Sesi di-mount saat "arming" (jari turun) — hampir selalu sudah ada
    // saat tahan terdeteksi; tunggu sebentar bila render belum selesai.
    const waitStart = Date.now()
    let session = optionsRef.current.getSession()
    while (!session && Date.now() - waitStart < SESSION_WAIT_MS) {
      await new Promise((resolve) => setTimeout(resolve, SESSION_POLL_MS))
      session = optionsRef.current.getSession()
    }
    if (!session) {
      resetUi()
      optionsRef.current.onIssue("unsupported")
      return
    }

    const result = await session.start().catch(
      (): VoiceSessionStart => ({ status: "unsupported", prompted: false }),
    )
    startingRef.current = false
    if (result.status !== "started") {
      resetUi()
      optionsRef.current.onIssue(result.status)
      return
    }
    // UI sudah di-reset selagi menunggu (mis. aplikasi ke latar): rekaman yang
    // baru jalan tidak punya pemilik — buang.
    if (readPhase(phaseRef) === "idle") {
      await session.cancel().catch(() => undefined)
      return
    }
    // Dialog izin memutus gestur → pengguna belum merekam apa pun dengan sengaja.
    if (result.prompted) {
      await session.cancel().catch(() => undefined)
      resetUi()
      optionsRef.current.onIssue("retry")
      return
    }
    const pending = pendingReleaseRef.current
    if (pending) {
      pendingReleaseRef.current = null
      await finish(pending)
    }
  }, [finish, resetUi, setPhase])

  /** Pembungkus stabil — gestur tidak boleh dibuat ulang di tengah rekaman. */
  const holdStart = useCallback(() => {
    void handleHoldStart()
  }, [handleHoldStart])

  const handleDrag = useCallback(
    (dx: number, dy: number) => {
      // Setelah terkunci jari bebas bergerak; sebelum menahan belum ada yang dilacak.
      if (phaseRef.current !== "holding") return
      const result = resolveVoiceDrag(dx, dy, axisRef.current)
      axisRef.current = result.axis
      dragRef.current = result
      lockProgress.value = result.lockProgress
      cancelProgress.value = result.cancelProgress
      setArmed(result.cancel)
      if (result.lock) {
        setPhase("locked")
        haptic("select")
        lockProgress.value = 1
        cancelProgress.value = 0
        setArmed(false)
      }
    },
    [cancelProgress, lockProgress, setArmed, setPhase],
  )

  const handleRelease = useCallback(() => {
    const current = phaseRef.current
    if (current === "arming") {
      // Bukan tahan yang sah (tap cepat / gestur batal) — tap ditangani gestur Tap.
      resetUi()
      return
    }
    const action = resolveVoiceRelease(current, dragRef.current)
    if (action === "keep-recording") {
      cancelProgress.value = 0
      // Menekan tombol "Kirim" (jari baru, bukan jari yang mengunci) = kirim.
      if (pressWhileLockedRef.current) {
        pressWhileLockedRef.current = false
        void finish("send")
      }
      return
    }
    if (action !== "send" && action !== "cancel") return
    if (startingRef.current) {
      pendingReleaseRef.current = action
      return
    }
    void finish(action)
  }, [cancelProgress, finish, resetUi])

  const send = useCallback(() => {
    if (phaseRef.current !== "locked") return
    void finish("send")
  }, [finish])

  const discard = useCallback(() => {
    if (phaseRef.current === "idle") return
    void finish("cancel")
  }, [finish])

  const handleDuration = useCallback(
    (ms: number) => {
      if (phaseRef.current === "idle") return
      setDurationMs(ms)
      if (
        ms >= VOICE_NOTE_MAX_DURATION_MS - LIMIT_SLACK_MS &&
        (phaseRef.current === "holding" || phaseRef.current === "locked")
      ) {
        optionsRef.current.onLimitReached?.()
        void finish("send")
      }
    },
    [finish],
  )

  // Aplikasi ke latar belakang → buang rekaman (mikrofon tidak boleh menyala diam-diam).
  const active = phase !== "idle"
  useEffect(() => {
    if (!active) return
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") return
      if (startingRef.current) {
        pendingReleaseRef.current = "cancel"
        return
      }
      void finish("cancel")
    })
    return () => sub.remove()
  }, [active, finish])

  return {
    phase,
    durationMs,
    cancelArmed,
    lockProgress,
    cancelProgress,
    handleBegin,
    handleHoldStart: holdStart,
    handleDrag,
    handleRelease,
    send,
    discard,
    handleDuration,
  }
}
