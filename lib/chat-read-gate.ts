/**
 * Kahade — gate "boleh menandai dibaca" (audit Pesan 2026-10-10, #9a).
 *
 * `markChatRoomRead` memberi lawan bicara centang ganda. Dulu dipicu setiap
 * pesan masuk saat pembaca "di dasar thread" — termasuk ketika layar ruang
 * masih ter-mount tetapi TIDAK terlihat: aplikasi di latar (push masuk, socket
 * masih hidup) atau pengguna sedang di layar lain di atasnya (profil lawan
 * bicara, viewer media). Lawan bicara melihat "dibaca" padahal pesannya
 * belum pernah tampil di layar — centang palsu.
 *
 * Aturan murni: dibaca hanya bila layar FOKUS, aplikasi AKTIF, dan viewport
 * di DASAR thread. Yang tertahan dicatat (deferred) dan dilunasi begitu
 * ketiganya terpenuhi lagi.
 */

export type ReadGateInput = {
  /** Layar ruang chat adalah layar yang terlihat (useIsFocused). */
  focused: boolean
  /** AppState === "active". */
  appActive: boolean
  /** Viewport di dasar thread (pesan terbaru terlihat). */
  atBottom: boolean
}

export function canMarkRead(input: ReadGateInput): boolean {
  return input.focused && input.appActive && input.atBottom
}

/**
 * Keputusan saat pesan baru dari lawan bicara tiba (merge poll/realtime):
 *   - "mark"  → tandai dibaca sekarang;
 *   - "defer" → ada pesan yang belum "dilihat"; tandai nanti saat gate terbuka;
 *   - "none"  → tidak ada yang perlu ditandai.
 */
export function readActionForIncoming(input: {
  added: number
  freshFromOther: boolean
  gate: ReadGateInput
}): "mark" | "defer" | "none" {
  if (input.added <= 0 || !input.freshFromOther) return "none"
  return canMarkRead(input.gate) ? "mark" : "defer"
}
