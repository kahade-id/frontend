/**
 * Native, account-scoped persistence for the GET query cache.
 *
 * `query-cache.ts` remains the fast in-memory layer. This module stores a
 * bounded snapshot in Expo's app-private cache directory so an app restart
 * does not turn an offline screen into a blank/error state. Web deliberately
 * stays memory-only: the existing web secure-storage allowlist does not
 * permit arbitrary API payloads in localStorage.
 *
 * The cache is disposable (never a source of truth): it is versioned, capped,
 * age-limited, scoped to a random SecureStore identifier per login session,
 * and deleted/invalidated alongside the in-memory cache. No native module or
 * app configuration changes are needed.
 */
import { Platform } from "react-native"

import { getAccessToken, getSessionRevision } from "@/lib/api/session"
import { getSecureItem, SecureKeys, setSecureItem } from "@/lib/secure-storage"

const FILE_NAME = "kahade-query-cache-v1.json"
const STORE_VERSION = 1
const MAX_ENTRIES = 200
const MAX_BYTES = 2_000_000
const MAX_ENTRY_AGE_MS = 30 * 24 * 60 * 60 * 1_000
const ACCOUNT_SCOPE_PREFIX = "account:"
const INDEX_SEPARATOR = "\u0000"

type PersistedEntry = {
  scope: string
  key: string
  at: number
  data: unknown
}

type PersistedStore = {
  version: number
  entries: PersistedEntry[]
}

let entries = new Map<string, PersistedEntry>()
let hydrated = false
let hydrationPromise: Promise<void> | null = null
let storeGeneration = 0
let ioQueue: Promise<void> = Promise.resolve()
let scopePromise: Promise<string | null> | null = null
let scopeRevision = -1
const pendingPersistWrites = new Set<Promise<void>>()

function indexOf(scope: string, key: string): string {
  return `${scope}${INDEX_SEPARATOR}${key}`
}

function isValidEntry(value: unknown): value is PersistedEntry {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<PersistedEntry>
  return (
    typeof candidate.scope === "string" &&
    typeof candidate.key === "string" &&
    typeof candidate.at === "number" &&
    Number.isFinite(candidate.at) &&
    "data" in candidate
  )
}

function serializedSize(value: unknown): number {
  try {
    return JSON.stringify(value).length
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

function enqueueIo<T>(operation: () => Promise<T>): Promise<T> {
  const next = ioQueue.then(operation, operation)
  ioQueue = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}

async function getFile() {
  // Dynamic import is important: the browser never loads a native-only
  // filesystem binding, and the dependency already ships with the app.
  const { File, Paths } = await import("expo-file-system")
  return new File(Paths.cache, FILE_NAME)
}

function createScopeId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`
}

async function resolveScope(revision: number): Promise<string | null> {
  if (Platform.OS === "web") return null
  try {
    const accessToken = await getAccessToken()
    if (revision !== getSessionRevision()) return null
    // Query keys do not annotate public/private endpoints, so fail closed:
    // never persist an unscoped response after logout or before auth resolves.
    if (!accessToken) return null

    let scopeId = await getSecureItem(SecureKeys.offlineQueryCacheScope)
    if (!scopeId) {
      scopeId = createScopeId()
      await setSecureItem(SecureKeys.offlineQueryCacheScope, scopeId)
    }
    if (revision !== getSessionRevision()) return null
    return `${ACCOUNT_SCOPE_PREFIX}${scopeId}`
  } catch {
    // Persistence is opportunistic. A SecureStore/filesystem issue must not
    // prevent the network request or make the in-memory cache unavailable.
    return null
  }
}

function getScope(): Promise<string | null> {
  const revision = getSessionRevision()
  if (scopePromise && scopeRevision === revision) return scopePromise
  scopeRevision = revision
  scopePromise = resolveScope(revision)
  return scopePromise
}

function parseStore(text: string): PersistedEntry[] {
  try {
    const parsed = JSON.parse(text) as Partial<PersistedStore>
    if (parsed.version !== STORE_VERSION || !Array.isArray(parsed.entries)) return []
    const now = Date.now()
    return parsed.entries.filter(
      (entry): entry is PersistedEntry =>
        isValidEntry(entry) &&
        entry.at <= now + 60_000 &&
        now - entry.at <= MAX_ENTRY_AGE_MS,
    )
  } catch {
    return []
  }
}

async function readFileEntries(): Promise<PersistedEntry[]> {
  if (Platform.OS === "web") return []
  const file = await getFile()
  if (!file.exists) return []
  const text = await file.text()
  if (text.length > MAX_BYTES * 2) return []
  return parseStore(text)
}

function ensureHydrated(): Promise<void> {
  if (hydrated) return Promise.resolve()
  if (hydrationPromise) return hydrationPromise
  const generation = storeGeneration
  const pending = (async () => {
    let stored: PersistedEntry[] = []
    try {
      stored = await enqueueIo(readFileEntries)
    } catch {
      // An unreadable/evicted cache behaves like an empty cache.
    }
    if (generation !== storeGeneration) return
    const next = new Map<string, PersistedEntry>()
    for (const entry of stored) next.set(indexOf(entry.scope, entry.key), entry)
    entries = next
    hydrated = true
  })()
  hydrationPromise = pending
  void pending.finally(() => {
    if (hydrationPromise === pending) hydrationPromise = null
  }).catch(() => undefined)
  return pending
}

function trimEntries(preferredScope?: string): void {
  // A new login must not retain cache entries from a previous account. Keep
  // only the active account, even if another account's file snapshot was left
  // behind by a process killed during logout.
  if (preferredScope) {
    for (const [index, entry] of entries) {
      if (entry.scope !== preferredScope) entries.delete(index)
    }
  }

  const totalBytes = () => serializedSize({ version: STORE_VERSION, entries: [...entries.values()] })
  while (entries.size > MAX_ENTRIES || totalBytes() > MAX_BYTES) {
    let oldestIndex: string | null = null
    let oldestAt = Number.POSITIVE_INFINITY
    for (const [index, entry] of entries) {
      if (entry.at < oldestAt) {
        oldestIndex = index
        oldestAt = entry.at
      }
    }
    if (oldestIndex === null) break
    entries.delete(oldestIndex)
  }
}

function snapshot(): string {
  return JSON.stringify({ version: STORE_VERSION, entries: [...entries.values()] } satisfies PersistedStore)
}

async function writeFileSnapshot(serialized: string | null): Promise<void> {
  if (Platform.OS === "web") return
  const file = await getFile()
  if (serialized === null || serialized === JSON.stringify({ version: STORE_VERSION, entries: [] })) {
    if (file.exists) file.delete()
    return
  }
  if (!file.exists) file.create({ intermediates: true })
  await file.write(serialized, { append: false })
}

function scheduleSnapshotWrite(): Promise<void> {
  const serialized = snapshot()
  return enqueueIo(() => writeFileSnapshot(serialized))
}

/** Save a successful response without delaying the caller's UI/network path. */
async function persistQueryCacheEntryInternal(
  key: string,
  data: unknown,
  at: number,
): Promise<void> {
  if (Platform.OS === "web") return
  const revision = getSessionRevision()
  const generation = storeGeneration
  const scope = await getScope()
  if (!scope || revision !== getSessionRevision() || generation !== storeGeneration) return
  const entry: PersistedEntry = { scope, key, at, data }
  if (serializedSize(entry) > MAX_BYTES) return

  await ensureHydrated()
  if (revision !== getSessionRevision() || generation !== storeGeneration) return
  entries.set(indexOf(scope, key), entry)
  trimEntries(scope)
  try {
    await scheduleSnapshotWrite()
  } catch {
    // The in-memory cache remains useful if the OS evicts or blocks this file.
  }
}

export function persistQueryCacheEntry(key: string, data: unknown, at: number): Promise<void> {
  const pending = persistQueryCacheEntryInternal(key, data, at)
  pendingPersistWrites.add(pending)
  void pending.finally(() => pendingPersistWrites.delete(pending)).catch(() => undefined)
  return pending
}

/** Read a persisted entry for the current login scope, without applying the short memory TTL. */
export async function readPersistedQueryCacheEntry<T>(
  key: string,
): Promise<{ data: T; at: number } | null> {
  if (Platform.OS === "web") return null
  const revision = getSessionRevision()
  const scope = await getScope()
  if (!scope || revision !== getSessionRevision()) return null
  await ensureHydrated()
  if (revision !== getSessionRevision()) return null

  const entry = entries.get(indexOf(scope, key))
  if (!entry) return null
  if (Date.now() - entry.at > MAX_ENTRY_AGE_MS) {
    entries.delete(indexOf(scope, key))
    void scheduleSnapshotWrite().catch(() => undefined)
    return null
  }
  return { data: entry.data as T, at: entry.at }
}

/** Remove one key or a family of keys from every stored account scope. */
export async function invalidatePersistedQueryCache(match?: (key: string) => boolean): Promise<void> {
  if (Platform.OS === "web") return
  if (match === undefined) {
    storeGeneration += 1
    entries = new Map()
    hydrated = true
    hydrationPromise = null
    scopePromise = null
    scopeRevision = -1
    try {
      await enqueueIo(() => writeFileSnapshot(null))
    } catch {
      // The changed session scope still prevents an old account's data reading.
    }
    return
  }

  await ensureHydrated()
  // Fence in-flight writes before removing the selected keys so a response
  // started before the mutation cannot reintroduce invalidated disk data.
  storeGeneration += 1
  let changed = false
  for (const [index, entry] of entries) {
    if (match(entry.key)) {
      entries.delete(index)
      changed = true
    }
  }
  if (changed) {
    try {
      await scheduleSnapshotWrite()
    } catch {
      // Persistence is best-effort; query-cache memory is invalidated already.
    }
  }
}

/** Await queued filesystem work; exported for deterministic tests/maintenance. */
export async function flushPersistedQueryCache(): Promise<void> {
  while (pendingPersistWrites.size > 0) {
    await Promise.allSettled([...pendingPersistWrites])
  }
  await ioQueue
}
