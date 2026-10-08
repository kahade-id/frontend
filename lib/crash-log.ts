/**
 * Kahade — log crash lokal (Bug 1, 2026-10-08).
 *
 * Masalah: saat app mati karena error, perangkat tidak menyisakan jejak.
 * Telemetri hanya ring buffer di memori (hilang bersama proses) dan sink remote
 * yang opsional. Modul ini menyimpan kejadian LEVEL ERROR — crash render,
 * global fatal, unhandled rejection, fallback worklet — ke berkas JSON lokal
 * (50 entri terakhir) di `Paths.document`, supaya bisa dibaca setelah app
 * dibuka ulang.
 *
 * Keputusan non-obvious:
 *   - Hanya `error`. `logWarn` (kegagalan yang sengaja diredam) terlalu sering;
 *     menyimpannya akan menggerus 50 slot dengan noise jaringan.
 *   - Yang disimpan = `TelemetryEvent` yang SUDAH diredaksi di `dispatch()`.
 *     Tidak ada body permintaan, token, atau PII tambahan.
 *   - `global-fatal` ditulis SINKRON: handler fatal bawaan RN bisa menutup
 *     proses sebelum penulisan async selesai. Kejadian lain ditulis async lewat
 *     antrean berurutan.
 *   - Setiap penulisan menyerialisasi daftar di MEMORI saat penulisan itu
 *     dijalankan. Penulisan async yang tertunda tidak bisa menimpa entri fatal
 *     yang lebih baru dengan isi lama.
 *   - Gagal baca/tulis tidak boleh melempar: log crash tidak boleh menjadi
 *     sumber crash.
 *   - Kejadian yang terjadi SEBELUM berkas siap dibaca disimpan di memori dan
 *     ditulis begitu siap. Kejadian fatal dalam jendela itu (milidetik setelah
 *     boot) tidak tertulis; ini batas yang diterima.
 *   - Native saja: di web `installCrashLog` tidak melakukan apa pun.
 *   - Batas: exception di UI thread Reanimated yang TIDAK lewat handler JS tidak
 *     tercatat di sini. Karena itu sumbernya diperbaiki (lib/use-safe-animated-style
 *     dan updater yang tidak memanggil fungsi JS).
 */
import { Platform } from "react-native"

import { addTelemetrySink, type TelemetryEvent } from "@/lib/telemetry"

export const CRASH_LOG_FILE_NAME = "kahade-crash-log.json"
/** Batas jumlah entri yang disimpan (yang terlama dibuang). */
export const CRASH_LOG_MAX_ENTRIES = 50
const FORMAT_VERSION = 1

export type CrashLogEntry = TelemetryEvent

/** Hanya kejadian level `error` yang layak disimpan. */
export function isCrashWorthy(event: TelemetryEvent): boolean {
  return event.level === "error"
}

/** Handler fatal global RN (`ErrorUtils`) — harus tertulis sebelum proses mati. */
export function isFatalEvent(event: TelemetryEvent): boolean {
  return event.scope === "global-fatal"
}

/** Tambahkan satu entri; yang terlama dibuang bila melebihi batas. */
export function appendCrashEntry(
  entries: readonly CrashLogEntry[],
  entry: CrashLogEntry,
): CrashLogEntry[] {
  const next = [...entries, entry]
  return next.length > CRASH_LOG_MAX_ENTRIES
    ? next.slice(next.length - CRASH_LOG_MAX_ENTRIES)
    : next
}

function isEntry(value: unknown): value is CrashLogEntry {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    (v.level === "warn" || v.level === "error") &&
    typeof v.scope === "string" &&
    typeof v.message === "string" &&
    typeof v.at === "number"
  )
}

/** Baca isi berkas. Apa pun yang rusak → daftar kosong (tidak melempar). */
export function parseCrashLog(text: string | null | undefined): CrashLogEntry[] {
  if (!text) return []
  try {
    const data: unknown = JSON.parse(text)
    const list =
      typeof data === "object" && data !== null && Array.isArray((data as { entries?: unknown }).entries)
        ? ((data as { entries: unknown[] }).entries)
        : []
    return list.filter(isEntry).slice(-CRASH_LOG_MAX_ENTRIES)
  } catch {
    return []
  }
}

export function serializeCrashLog(entries: readonly CrashLogEntry[]): string {
  return JSON.stringify({ version: FORMAT_VERSION, entries: entries.slice(-CRASH_LOG_MAX_ENTRIES) })
}

/** Penyimpanan berkas (diinjeksi: tes memakai memori, produksi memakai expo-file-system). */
export type CrashLogStore = {
  read(): Promise<string | null>
  write(content: string): Promise<void>
  writeSync(content: string): void
}

export type CrashLogRecorder = {
  /** Catat satu kejadian (non-error diabaikan). Tidak pernah melempar. */
  record(event: TelemetryEvent): void
  /** Muat berkas yang sudah ada lalu aktifkan penulisan. */
  attach(store: CrashLogStore): Promise<void>
  /** Salinan entri yang diingat saat ini (paling lama di awal). */
  entries(): readonly CrashLogEntry[]
}

export function createCrashLogRecorder(): CrashLogRecorder {
  let entries: CrashLogEntry[] = []
  let store: CrashLogStore | null = null
  /** Ada perubahan yang belum tertulis karena berkas belum siap. */
  let dirty = false
  let queue: Promise<void> = Promise.resolve()

  const flushAsync = (target: CrashLogStore) => {
    // Isi diserialisasi SAAT tulis dijalankan, bukan saat dijadwalkan.
    queue = queue
      .then(() => target.write(serializeCrashLog(entries)))
      .catch(() => undefined)
  }

  return {
    record(event) {
      try {
        if (!isCrashWorthy(event)) return
        entries = appendCrashEntry(entries, event)
        if (!store) {
          dirty = true
          return
        }
        if (isFatalEvent(event)) {
          store.writeSync(serializeCrashLog(entries))
          return
        }
        flushAsync(store)
      } catch {
        /* log crash tidak boleh menjadi sumber crash */
      }
    },
    async attach(target) {
      let existing: CrashLogEntry[] = []
      try {
        existing = parseCrashLog(await target.read())
      } catch {
        existing = []
      }
      // Entri dari berkas di depan; yang terkumpul sebelum berkas siap di belakang.
      entries = [...existing, ...entries].slice(-CRASH_LOG_MAX_ENTRIES)
      store = target
      if (dirty) {
        dirty = false
        flushAsync(target)
      }
    },
    entries() {
      return entries
    },
  }
}

/** Adapter `expo-file-system` (API File/Paths, sama dengan lib/query-cache-persistence). */
async function openExpoCrashLogStore(): Promise<CrashLogStore> {
  const { File, Paths } = await import("expo-file-system")
  const file = new File(Paths.document, CRASH_LOG_FILE_NAME)
  const ensureFile = () => {
    if (!file.exists) file.create({ intermediates: true })
  }
  return {
    async read() {
      return file.exists ? await file.text() : null
    },
    async write(content) {
      ensureFile()
      await file.write(content)
    },
    writeSync(content) {
      ensureFile()
      file.writeSync(content)
    },
  }
}

let recorder: CrashLogRecorder | null = null

/**
 * Pasang sink telemetri yang menyimpan kejadian error ke berkas lokal.
 * Idempoten; dipanggil sekali dari root layout setelah `installTelemetry()`.
 */
export function installCrashLog(): void {
  if (recorder || Platform.OS === "web") return
  const active = createCrashLogRecorder()
  recorder = active
  addTelemetrySink((event) => active.record(event))
  void openExpoCrashLogStore()
    .then((store) => active.attach(store))
    .catch(() => undefined)
}

/** Entri yang diingat sesi ini (untuk layar dukungan / debug). */
export function getCrashLogEntries(): readonly CrashLogEntry[] {
  return recorder?.entries() ?? []
}
