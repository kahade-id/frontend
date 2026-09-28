/**
 * Kahade — uji deteksi root/jailbreak (M-1 audit ronde-2).
 *
 * - Perangkat bersih → pemeriksaan lolos, aksi finansial boleh lanjut.
 * - Perangkat rooted → `assertDeviceNotCompromised()` menampilkan Alert
 *   "Perangkat tidak aman" dan mengembalikan false (pemanggil membatalkan
 *   aksi finansial).
 * - Pemeriksaan gagal (unknown) → fail-open: tidak memblokir (proteksi
 *   utama tetap di server; deteksi ini best-effort).
 * - Hasil di-cache per sesi: native check hanya dipanggil sekali.
 * - Web: deteksi tidak didukung → selalu lolos tanpa memanggil native.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const rnHoisted = vi.hoisted(() => ({
  os: "android",
  alert: vi.fn(),
}))

// `lib/device-integrity` mengimpor "react-native" yang di-alias ke stub;
// mock langsung file stub-nya agar Platform.OS & Alert bisa dikendalikan.
vi.mock("@/tests/stubs/react-native", () => ({
  Platform: {
    get OS() {
      return rnHoisted.os
    },
    select: <T,>(specific: { web?: T; default?: T }) => specific.default ?? specific.web,
  },
  Alert: { alert: rnHoisted.alert },
}))

import { __device } from "@/tests/stubs/expo"
import {
  __resetDeviceIntegrityCache,
  assertDeviceNotCompromised,
  checkDeviceIntegrity,
} from "@/lib/device-integrity"

beforeEach(() => {
  __device.reset()
  __resetDeviceIntegrityCache()
  rnHoisted.os = "android"
  rnHoisted.alert.mockClear()
})

describe("checkDeviceIntegrity", () => {
  it("perangkat bersih → checked & tidak compromised", async () => {
    __device.rooted = false
    const res = await checkDeviceIntegrity()
    expect(res).toEqual({ checked: true, compromised: false })
  })

  it("perangkat rooted → compromised true", async () => {
    __device.rooted = true
    const res = await checkDeviceIntegrity()
    expect(res).toEqual({ checked: true, compromised: true })
  })

  it("native check gagal → unknown (checked false), bukan compromised", async () => {
    __device.failCheck = true
    const res = await checkDeviceIntegrity()
    expect(res.checked).toBe(false)
    expect(res.compromised).toBe(false)
    expect(res.error).toBeTruthy()
  })

  it("hasil di-cache: native check hanya sekali per sesi", async () => {
    await checkDeviceIntegrity()
    await checkDeviceIntegrity()
    expect(__device.checks).toBe(1)
  })
})

describe("assertDeviceNotCompromised", () => {
  it("perangkat bersih → true, tanpa Alert", async () => {
    __device.rooted = false
    await expect(assertDeviceNotCompromised()).resolves.toBe(true)
    expect(rnHoisted.alert).not.toHaveBeenCalled()
  })

  it("perangkat rooted → false + Alert 'Perangkat tidak aman'", async () => {
    __device.rooted = true
    await expect(assertDeviceNotCompromised()).resolves.toBe(false)
    expect(rnHoisted.alert).toHaveBeenCalledTimes(1)
    const [title, message] = rnHoisted.alert.mock.calls[0] as [string, string]
    expect(title).toBe("Perangkat tidak aman")
    expect(message).toMatch(/root|jailbreak/i)
    expect(message).toMatch(/diblokir/i)
  })

  it("unknown (check gagal) → fail-open: true tanpa Alert", async () => {
    __device.failCheck = true
    await expect(assertDeviceNotCompromised()).resolves.toBe(true)
    expect(rnHoisted.alert).not.toHaveBeenCalled()
  })

  it("web → selalu true tanpa memanggil native check", async () => {
    rnHoisted.os = "web"
    __device.rooted = true
    await expect(assertDeviceNotCompromised()).resolves.toBe(true)
    expect(__device.checks).toBe(0)
    expect(rnHoisted.alert).not.toHaveBeenCalled()
  })
})
