/**
 * Kahade — checklist onboarding (KYC, tambah rekening, etalase pertama).
 *
 * Kartu progres yang muncul SEKALI sampai ketiga item selesai, lalu hilang
 * permanen (flag `SecureKeys.onboardingChecklistDone`). Tiap item deep-link
 * ke layar yang relevan. Status dibaca dari query yang SUDAH ADA (cache
 * `useApiQuery` yang sama dengan layar KYC / Rekening / Kelola Etalase) —
 * tidak ada endpoint baru.
 *
 * Modul ini murni (tipe + logika progres + flag persist); pengambilan data
 * hidup di `lib/use-onboarding-checklist.ts`, UI di
 * `components/ui/onboarding-checklist.tsx`.
 */
import { getSecureItem, SecureKeys, setSecureItem } from "@/lib/secure-storage"

export type ChecklistItemId = "kyc" | "bankAccount" | "firstShowcase"

export type ChecklistItemStatus = {
  id: ChecklistItemId
  /** Selesai — item dicentang. */
  done: boolean
}

export type ChecklistProgress = {
  items: ChecklistItemStatus[]
  doneCount: number
  total: number
  /** 0..1 untuk progress bar. */
  fraction: number
  allDone: boolean
}

/**
 * Hitung progres dari status mentah. Urutan item TETAP: kyc → rekening →
 * etalase (urutan funnel onboarding produk).
 */
export function computeChecklistProgress(status: {
  kycDone: boolean
  bankAccountDone: boolean
  firstShowcaseDone: boolean
}): ChecklistProgress {
  const items: ChecklistItemStatus[] = [
    { id: "kyc", done: status.kycDone },
    { id: "bankAccount", done: status.bankAccountDone },
    { id: "firstShowcase", done: status.firstShowcaseDone },
  ]
  const doneCount = items.filter((i) => i.done).length
  const total = items.length
  return {
    items,
    doneCount,
    total,
    fraction: total === 0 ? 0 : doneCount / total,
    allDone: doneCount === total,
  }
}

/** Flag "checklist selesai permanen" sudah diset? */
export async function hasCompletedOnboardingChecklist(): Promise<boolean> {
  try {
    return (await getSecureItem(SecureKeys.onboardingChecklistDone)) === "1"
  } catch {
    return false
  }
}

/** Tandai checklist selesai — kartu tidak akan tampil lagi. */
export async function markOnboardingChecklistDone(): Promise<void> {
  try {
    await setSecureItem(SecureKeys.onboardingChecklistDone, "1")
  } catch {
    // Gagal menyimpan flag bukan fatal — konsekuensinya kartu tampil lagi
    // sekali, bukan data hilang.
  }
}
