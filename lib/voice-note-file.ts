/**
 * Kahade — membaca ukuran berkas rekaman voice note (native saja).
 *
 * Dipakai lembar perekam (<VoiceNoteRecorder>) dan sesi tahan-untuk-merekam
 * (<VoiceNoteSession>) agar keduanya melaporkan ukuran dengan cara yang sama.
 *
 * Ukuran dibaca dari berkasnya (expo-file-system), bukan dari status rekaman:
 * `RecorderState.fileSize` baru final setelah `stop()`. Gagal membaca = 0
 * ("platform tidak melaporkan") — validasi meloloskan dan server tetap menjadi
 * gerbang terakhir.
 */
export async function readRecordedFileSize(uri: string): Promise<number> {
  try {
    const { File } = await import("expo-file-system")
    const reported = (new File(uri) as unknown as { size?: number }).size
    return typeof reported === "number" ? reported : 0
  } catch {
    return 0
  }
}
