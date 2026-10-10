/**
 * CR-05 (audit etalase 2026-10-10): `clearSession()` harus menghapus data
 * milik AKUN yang tersimpan di perangkat — termasuk draf "Buat etalase" dan
 * daftar lokal "Baru dihapus". Komentar kuncinya sudah lama mengklaim
 * "dihapus clearSession() saat logout", tetapi keduanya tidak pernah masuk
 * daftar: akun berikutnya di perangkat yang sama melihat draf & judul etalase
 * akun sebelumnya.
 *
 * Environment sama dengan tests/secure-storage-web.test.ts (stub Platform.OS
 * = "web", localStorage dipalsukan) — jalur memori/persisten yang sama.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { clearSession, deleteSecureItem, getSecureItem, SecureKeys, setSecureItem } from "@/lib/secure-storage"

function createFakeStorage() {
  const store = new Map<string, string>()
  return {
    store,
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key)
    }),
    clear: vi.fn(() => store.clear()),
    key: vi.fn(() => null),
    get length() {
      return store.size
    },
  }
}

beforeEach(() => {
  ;(globalThis as { window?: unknown }).window = { localStorage: createFakeStorage() }
})

afterEach(async () => {
  for (const key of Object.values(SecureKeys)) await deleteSecureItem(key)
  delete (globalThis as { window?: unknown }).window
})

describe("CR-05 clearSession — data akun etalase", () => {
  it("menghapus draf etalase & daftar lokal 'Baru dihapus', mempertahankan deviceId", async () => {
    await setSecureItem(SecureKeys.showcaseDraft, JSON.stringify({ title: "Draf akun A" }))
    await setSecureItem(SecureKeys.deletedShowcaseItems, JSON.stringify([{ id: "x", deletedAt: "2026-10-01T00:00:00.000Z" }]))
    await setSecureItem(SecureKeys.deviceId, "device-1")

    await clearSession()

    expect(await getSecureItem(SecureKeys.showcaseDraft)).toBeNull()
    expect(await getSecureItem(SecureKeys.deletedShowcaseItems)).toBeNull()
    // Identitas perangkat bukan data akun — tetap ada (daftar perangkat §9).
    expect(await getSecureItem(SecureKeys.deviceId)).toBe("device-1")
  })
})
