/**
 * Test checklist onboarding (lib/onboarding-checklist.ts).
 *
 * Logika murni: progres 3 item (KYC → rekening → etalase) dan flag
 * persisten "selesai permanen".
 */
import { afterEach, describe, expect, it } from "vitest"

import {
  computeChecklistProgress,
  hasCompletedOnboardingChecklist,
  markOnboardingChecklistDone,
} from "@/lib/onboarding-checklist"
import { deleteSecureItem, SecureKeys } from "@/lib/secure-storage"

afterEach(async () => {
  await deleteSecureItem(SecureKeys.onboardingChecklistDone)
})

describe("computeChecklistProgress", () => {
  it("semua false → 0/3, belum selesai", () => {
    const p = computeChecklistProgress({ kycDone: false, bankAccountDone: false, firstShowcaseDone: false })
    expect(p.doneCount).toBe(0)
    expect(p.total).toBe(3)
    expect(p.fraction).toBe(0)
    expect(p.allDone).toBe(false)
    expect(p.items.map((i) => i.id)).toEqual(["kyc", "bankAccount", "firstShowcase"])
  })

  it("sebagian → fraction proporsional", () => {
    const p = computeChecklistProgress({ kycDone: true, bankAccountDone: false, firstShowcaseDone: true })
    expect(p.doneCount).toBe(2)
    expect(p.fraction).toBeCloseTo(2 / 3)
    expect(p.allDone).toBe(false)
  })

  it("semua true → allDone", () => {
    const p = computeChecklistProgress({ kycDone: true, bankAccountDone: true, firstShowcaseDone: true })
    expect(p.doneCount).toBe(3)
    expect(p.fraction).toBe(1)
    expect(p.allDone).toBe(true)
  })
})

describe("flag checklist selesai", () => {
  it("awal false; setelah mark → true dan bertahan", async () => {
    expect(await hasCompletedOnboardingChecklist()).toBe(false)
    await markOnboardingChecklistDone()
    expect(await hasCompletedOnboardingChecklist()).toBe(true)
  })
})
