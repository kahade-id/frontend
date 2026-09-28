/**
 * Kahade — riwayat pindaian QR per perangkat (FE-IMP-4 item 21).
 *
 * Penyimpanan mengikuti pola `lib/chat-pinned-rooms.ts` — `SecureStore` via
 * `lib/secure-storage` (repo ini tidak memakai AsyncStorage), memory-first +
 * persist async. Di web persist jatuh ke memory proses (tidak masuk
 * localStorage), konsisten dengan draft chat.
 *
 * Bukan data sensitif (hanya string yang pernah dipindai) — riwayat bisa
 * dihapus per item atau seluruhnya dari layar Pindai.
 */
import { deleteRawItem, getRawItem, setRawItem } from "@/lib/secure-storage"
import { logWarn } from "@/lib/telemetry"
import type { QrTargetType } from "@/lib/qr-parse"

export type ScanHistoryItem = {
  id: string
  /** String mentah hasil pindaian. */
  raw: string
  type: QrTargetType
  label: string
  detail: string
  /** ISO timestamp. */
  scannedAt: string
}

const STORAGE_KEY = "scan.history.v1"
const MAX_ITEMS = 30

let memory: ScanHistoryItem[] = []
let hydratePromise: Promise<void> | null = null
let idCounter = 0

function parse(raw: string | null): ScanHistoryItem[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is ScanHistoryItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as ScanHistoryItem).id === "string" &&
        typeof (item as ScanHistoryItem).raw === "string" &&
        typeof (item as ScanHistoryItem).scannedAt === "string",
    )
  } catch (err: unknown) {
    logWarn("scan:history-parse", err)
    return []
  }
}

async function ensureHydrated(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = getRawItem(STORAGE_KEY)
      .then((raw) => {
        memory = parse(raw)
      })
      .catch((err: unknown) => {
        logWarn("scan:history-hydrate", err)
      })
  }
  await hydratePromise
}

async function persist(): Promise<void> {
  try {
    if (memory.length === 0) await deleteRawItem(STORAGE_KEY)
    else await setRawItem(STORAGE_KEY, JSON.stringify(memory))
  } catch (err: unknown) {
    logWarn("scan:history-persist", err)
  }
}

function makeId(): string {
  idCounter += 1
  return `${Date.now().toString(36)}-${idCounter.toString(36)}`
}

export async function getScanHistory(): Promise<ScanHistoryItem[]> {
  await ensureHydrated()
  return [...memory]
}

/**
 * Tambah hasil pindaian ke riwayat. Pindaian beruntun dengan string yang sama
 * tidak diduplikasi (mencegah spam dari kamera yang membaca kode sama
 * berkali-kali).
 */
export async function addScanHistory(
  entry: Pick<ScanHistoryItem, "raw" | "type" | "label" | "detail">,
): Promise<ScanHistoryItem[]> {
  await ensureHydrated()
  if (memory[0]?.raw === entry.raw) return [...memory]
  const item: ScanHistoryItem = {
    ...entry,
    id: makeId(),
    scannedAt: new Date().toISOString(),
  }
  memory = [item, ...memory.filter((m) => m.raw !== entry.raw)].slice(0, MAX_ITEMS)
  await persist()
  return [...memory]
}

export async function removeScanHistory(id: string): Promise<ScanHistoryItem[]> {
  await ensureHydrated()
  memory = memory.filter((m) => m.id !== id)
  await persist()
  return [...memory]
}

export async function clearScanHistory(): Promise<ScanHistoryItem[]> {
  await ensureHydrated()
  memory = []
  await persist()
  return []
}
