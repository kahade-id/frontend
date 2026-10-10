/**
 * Kahade — bus kecil "ruang ini baru saja saya baca" (audit Pesan 2026-10-10,
 * daftar chat #4).
 *
 * Masalah: layar ruang menandai terbaca di server (`markChatRoomRead`), tetapi
 * daftar chat tidak tahu apa-apa — ia hanya refetch saat fokus bila datanya
 * lebih tua dari 30 dtk. Kembali ke daftar dalam 30 dtk = badge "5" dan baris
 * tebal masih menempel di ruang yang baru saja dibaca habis.
 *
 * Solusinya bukan refetch lebih sering, melainkan satu sinyal lokal: ruang
 * memancarkan `roomId` setiap kali menandai terbaca, daftar menolkan
 * `unreadCount` baris itu seketika (server sudah 0 juga). Murni, tanpa RN.
 */
type Listener = (roomId: string) => void

const listeners = new Set<Listener>()

/** Dipanggil layar ruang setelah `markChatRoomRead` dikirim. */
export function emitChatRoomRead(roomId: string): void {
  if (!roomId) return
  for (const listener of listeners) {
    try {
      listener(roomId)
    } catch {
      // Pendengar tidak boleh menjatuhkan pemancar.
    }
  }
}

/** Daftar chat berlangganan; mengembalikan fungsi berhenti. */
export function subscribeChatRoomRead(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** @internal — test. */
export function __resetChatRoomReadListenersForTest(): void {
  listeners.clear()
}
