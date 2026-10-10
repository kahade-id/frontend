/**
 * Kahade — hook pemutaran audio BERSAMA bubble voice note + audio viewer.
 *
 * Diekstrak dari logika <VoiceNotePlayer> (expo-audio SDK 58) supaya perilaku
 * IDENTIK di dua permukaan: bubble chat (ringkas) dan halaman media viewer
 * `type=audio` (layar penuh). Tambahan dari versi bubble lama: SEEK (lompat ke
 * posisi) dan 3 kecepatan (1x/1.5x/2x).
 *
 * Keputusan non-obvious (diwarisi dari VoiceNotePlayer):
 *   - Player dibuat TANPA sumber (`useAudioPlayer(null)`) — sumber dipasang
 *     saat pertama kali diputar (`replace`) supaya daftar chat tidak memuat
 *     semua audio sebelum diminta (pemuatan malas).
 *   - SATU suara dalam satu waktu: registry level modul menghentikan pemutar
 *     LAIN saat yang baru mulai (owner dibandingkan — jangan stop diri sendiri).
 *   - Signed URL kedaluwarsa (TTL 5 mnt) → `onRefreshUrl` dicoba SEKALI lalu
 *     jatuh ke error yang jujur + bisa retry.
 *   - `setRate` memakai `shouldCorrectPitch` (nada tidak melengking); platform
 *     yang menolak → kembali ke 1x diam-diam (tombol tidak macet).
 */
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio"
import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Audit Pesan 2026-10-10 (media #7): mode audio untuk PEMUTARAN — iOS
 * dengan sakelar dering di "silent" membisukan pemutar kecuali
 * `playsInSilentMode`. Dulu mode ini hanya disetel oleh perekam, jadi pesan
 * suara yang DITERIMA tidak bersuara sampai pengguna pernah merekam di sesi
 * itu. Disetel sekali per proses (idempoten, best-effort).
 */
let playbackModeReady: Promise<void> | null = null
function ensurePlaybackAudioMode(): Promise<void> {
  if (!playbackModeReady) {
    playbackModeReady = setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(
      () => {
        playbackModeReady = null
      },
    )
  }
  return playbackModeReady
}

export type AudioPlaybackPhase = "idle" | "loading" | "ready" | "error"

/** Kecepatan putar voice note: 1x → 1.5x → 2x → 1x. */
export const VOICE_PLAYBACK_RATES = [1, 1.5, 2] as const
export type VoicePlaybackRate = (typeof VOICE_PLAYBACK_RATES)[number]

/**
 * Registry pemutar aktif: satu suara dalam satu waktu. `owner` membedakan
 * "pemutar lain" dari diri sendiri — toggle tidak boleh menghentikan diri
 * sendiri (P0 2026-10-03 di VoiceNotePlayer).
 */
let activeAudio: { owner: object; stop: () => void } | null = null

/** Hentikan semua audio (dipakai saat keluar layar / buka viewer lain). */
export function stopAllAudio(): void {
  activeAudio?.stop()
  activeAudio = null
}

export type UseAudioPlaybackOptions = {
  uri: string
  /** Refresh signed URL kedaluwarsa — dipanggil MAKSIMAL sekali per URI. */
  onRefreshUrl?: () => Promise<string | null>
}

export type UseAudioPlayback = {
  phase: AudioPlaybackPhase
  playing: boolean
  loading: boolean
  failed: boolean
  positionMs: number
  durationMs: number
  remainingMs: number
  progress: number
  rate: VoicePlaybackRate
  toggle: () => void
  seekToFraction: (fraction: number) => void
  seekByMs: (deltaMs: number) => void
  cycleRate: () => void
  retry: () => void
}

export function useAudioPlayback({ uri: initialUri, onRefreshUrl }: UseAudioPlaybackOptions): UseAudioPlayback {
  const [phase, setPhase] = useState<AudioPlaybackPhase>("idle")
  const [playing, setPlaying] = useState(false)
  const [positionMs, setPositionMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)
  const [rate, setRate] = useState<VoicePlaybackRate>(1)

  const [uri, setUri] = useState(initialUri)
  const urlRefreshTried = useRef(false)

  const aliveRef = useRef(true)
  const ownerRef = useRef<object>({})
  const loadedRef = useRef(false)

  const player = useAudioPlayer(null, { updateInterval: 250 })
  const status = useAudioPlayerStatus(player)

  const unload = useCallback(() => {
    loadedRef.current = false
    try {
      player.pause()
      player.replace(null)
    } catch {
      // Player sudah dilepas — abaikan.
    }
  }, [player])

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      if (activeAudio?.owner === ownerRef.current) activeAudio = null
      unload()
    }
  }, [unload])

  // URI prop berganti (reuse baris FlatList / pesan di-sign ulang) → reset.
  useEffect(() => {
    setUri(initialUri)
    urlRefreshTried.current = false
    unload()
    setPhase("idle")
    setPositionMs(0)
    setDurationMs(0)
    setRate(1)
    // Media #38: label kembali "1x" → pemutar native juga harus 1x.
    try {
      player.playbackRate = 1
    } catch {
      // Player sudah dilepas — abaikan.
    }
  }, [initialUri, unload, player])

  // Status player → state UI.
  useEffect(() => {
    if (!aliveRef.current) return
    if (status.isLoaded && !loadedRef.current) {
      loadedRef.current = true
      setPhase("ready")
    }
    if (status.isLoaded) {
      setDurationMs(Math.round((status.duration ?? 0) * 1000))
    }
    setPositionMs(Math.round((status.currentTime ?? 0) * 1000))
    setPlaying(status.playing)
    if (status.didJustFinish) {
      // Kembali ke awal ala WhatsApp — siap diputar ulang.
      void player.seekTo(0).catch(() => {})
    }
  }, [status, player])

  // Pemuatan gagal (mis. signed URL kedaluwarsa → 403) → refresh SEKALI.
  useEffect(() => {
    if (!aliveRef.current || !status.error) return
    if (urlRefreshTried.current || !onRefreshUrl) {
      setPhase("error")
      return
    }
    urlRefreshTried.current = true
    void (async () => {
      try {
        const fresh = await onRefreshUrl()
        if (fresh && fresh !== uri && aliveRef.current) {
          setUri(fresh)
          player.replace({ uri: fresh })
          player.play()
          return
        }
      } catch {
        // Jatuh ke error di bawah.
      }
      if (aliveRef.current) setPhase("error")
    })()
  }, [status.error, onRefreshUrl, uri, player])

  const claimActive = useCallback(() => {
    if (activeAudio && activeAudio.owner !== ownerRef.current) activeAudio.stop()
    activeAudio = {
      owner: ownerRef.current,
      stop: () => {
        try {
          player.pause()
        } catch {
          // Player sudah dilepas — abaikan.
        }
      },
    }
  }, [player])

  const toggle = useCallback(() => {
    claimActive()
    try {
      if (status.playing) {
        player.pause()
        return
      }
      if (!loadedRef.current) {
        setPhase("loading")
        player.replace({ uri })
      }
      // Media #7: pastikan mode pemutaran (silent switch iOS) sebelum play.
      // Perekam menyetel `allowsRecording: true` dan tidak pernah
      // mengembalikannya (media #25) — di sini dikembalikan ke mode putar.
      void ensurePlaybackAudioMode().finally(() => {
        try {
          if (aliveRef.current) player.play()
        } catch {
          if (aliveRef.current) setPhase("error")
        }
      })
    } catch {
      if (aliveRef.current) setPhase("error")
    }
  }, [claimActive, player, status.playing, uri])

  const retry = useCallback(() => {
    // Retry = paksa muat ulang dari awal (URL lama); bila masih gagal dan
    // refresh tersedia, effect error di atas yang menangani refresh.
    loadedRef.current = false
    setPhase("loading")
    try {
      player.replace({ uri })
      player.play()
    } catch {
      if (aliveRef.current) setPhase("error")
    }
  }, [player, uri])

  const seekToFraction = useCallback(
    (fraction: number) => {
      if (!loadedRef.current || durationMs <= 0) return
      const clamped = Math.min(1, Math.max(0, fraction))
      const targetSeconds = (clamped * durationMs) / 1000
      setPositionMs(Math.round(clamped * durationMs))
      void player.seekTo(targetSeconds).catch(() => {})
    },
    [player, durationMs],
  )

  const seekByMs = useCallback(
    (deltaMs: number) => {
      if (!loadedRef.current || durationMs <= 0) return
      const target = Math.min(durationMs, Math.max(0, positionMs + deltaMs))
      setPositionMs(target)
      void player.seekTo(target / 1000).catch(() => {})
    },
    [player, durationMs, positionMs],
  )

  const cycleRate = useCallback(() => {
    const idx = VOICE_PLAYBACK_RATES.indexOf(rate)
    const next = VOICE_PLAYBACK_RATES[(idx + 1) % VOICE_PLAYBACK_RATES.length]
    setRate(next)
    try {
      player.shouldCorrectPitch = true
      player.playbackRate = next
    } catch {
      setRate(1)
    }
  }, [rate, player])

  const remainingMs = Math.max(0, durationMs - positionMs)
  const progress = durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0

  return {
    phase,
    playing,
    loading: phase === "loading",
    failed: phase === "error",
    positionMs,
    durationMs,
    remainingMs,
    progress,
    rate,
    toggle,
    seekToFraction,
    seekByMs,
    cycleRate,
    retry,
  }
}
