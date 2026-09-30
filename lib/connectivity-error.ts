/**
 * Kahade — klasifikasi error konektivitas (logika murni, tanpa import UI).
 *
 * Dipakai SectionErrorBoundary untuk membedakan "error karena jaringan"
 * (tampilkan UI offline + tombol coba lagi) dari "error kode" (tampilkan
 * error state standar). Dipisah dari komponen agar bisa di-unit-test
 * tanpa menarik rantai import React Native.
 */

/** Pola pesan error pemuatan chunk JS (web) — selalu berarti jaringan. */
const CHUNK_LOAD_PATTERNS = [
  "Failed to fetch dynamically imported module",
  "Importing a module script failed",
  "ChunkLoadError",
  "Loading chunk",
  "Loading CSS chunk",
]

/** Pola error jaringan generik. */
const NETWORK_PATTERNS = [
  "Network request failed",
  "Failed to fetch",
  "Load failed",
  "NetworkError",
]

function messageOf(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error ?? "")
}

function matchesAny(message: string, patterns: string[]): boolean {
  const lower = message.toLowerCase()
  return patterns.some((p) => lower.includes(p.toLowerCase()))
}

/** True bila error ini hampir pasti disebabkan koneksi (bukan bug kode). */
export function isConnectivityError(error: unknown): boolean {
  const message = messageOf(error)
  return matchesAny(message, CHUNK_LOAD_PATTERNS) || matchesAny(message, NETWORK_PATTERNS)
}
