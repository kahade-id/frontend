/**
 * Kahade — hook status checklist onboarding.
 *
 * Membaca tiga status dari query yang SUDAH ADA (kunci cache kanonis yang
 * sama dengan layar KYC / Rekening / Kelola Etalase) — tidak ada endpoint
 * baru, tidak ada request ganda bila layar-layar itu sudah dikunjungi
 * (cache `useApiQuery` dipakai ulang):
 *
 *   - "kyc"             → GET /v1/kyc/status (+ riwayat) — selesai bila VERIFIED
 *   - "bank-accounts"   → GET daftar rekening — selesai bila ≥ 1 rekening
 *   - "my-showcase:{rev}" → GET etalase milik sendiri — selesai bila ≥ 1 item
 *
 * Bentuk fetcher DIJAGA identik dengan layar pemilik kunci (aturan C-02:
 * satu kunci = satu bentuk respons; proyeksi via `select`).
 */
import { useEffect, useMemo, useState } from "react"

import { api } from "@/lib/api"
import type { BankAccount } from "@/lib/api/bank-accounts"
import type { KycHistoryEntry, KycState } from "@/lib/api/kyc"
import type { ShowcaseItem } from "@/lib/api/users"
import { useHasSession, useSessionRevision } from "@/lib/guest-gate"
import { useApiQuery } from "@/lib/use-api-query"
import {
  computeChecklistProgress,
  hasCompletedOnboardingChecklist,
  markOnboardingChecklistDone,
  type ChecklistProgress,
} from "@/lib/onboarding-checklist"

export type OnboardingChecklistState = {
  /** Flag permanen "selesai" sudah diset (kartu tidak tampil lagi). */
  dismissed: boolean
  /** Salah satu query masih memuat dan belum ada data cache. */
  loading: boolean
  progress: ChecklistProgress
  /** Panggil ulang ketiga query (mis. setelah kembali dari deep link). */
  refresh: () => void
}

export function useOnboardingChecklist(): OnboardingChecklistState {
  const hasSession = useHasSession()
  const revision = useSessionRevision()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void hasCompletedOnboardingChecklist().then((done) => {
      if (!cancelled) setDismissed(done)
    })
    return () => {
      cancelled = true
    }
  }, [hasSession])

  // Kunci + fetcher identik dengan app/kyc.tsx (C-02).
  const kycQuery = useApiQuery<{ state: KycState; history: KycHistoryEntry[] }, KycState>(
    "kyc",
    async (signal) => {
      const [s, h] = await Promise.all([
        api.kyc.getKycStatus(signal),
        api.kyc.getKycHistory({ page: 1, limit: 20 }, signal).catch(() => []),
      ])
      return { state: s, history: h ?? [] }
    },
    hasSession && !dismissed,
    { select: (raw) => raw.state },
  )

  // Kunci + fetcher identik dengan app/bank-accounts.tsx (C-02). `banks`
  // hanya dibawa agar bentuk cache sama; checklist hanya memakai `accounts`.
  const bankQuery = useApiQuery<
    { accounts: BankAccount[]; banks: Array<{ code: string; name: string; logo?: string; kind: "bank" }> },
    BankAccount[]
  >(
    "bank-accounts",
    async (signal) => {
      const [accountList, bankList] = await Promise.all([
        api.bankAccounts.listBankAccounts(signal),
        api.public.getBanks(signal),
      ])
      return {
        accounts: accountList ?? [],
        banks: (bankList ?? []).map((b) => ({
          code: b.code,
          name: b.name,
          logo: b.logoUrl ?? undefined,
          kind: "bank" as const,
        })),
      }
    },
    hasSession && !dismissed,
    { select: (raw) => raw.accounts },
  )

  // Kunci + fetcher identik dengan app/showcase-management.tsx (C-02);
  // `useCache: true` supaya tidak refetch bila cache masih segar.
  const showcaseQuery = useApiQuery<ShowcaseItem[], ShowcaseItem[]>(
    `my-showcase:${revision}`,
    async (signal) => (await api.users.getMyShowcase(signal)) ?? [],
    hasSession && !dismissed,
    { useCache: true },
  )

  const progress = useMemo(
    () =>
      computeChecklistProgress({
        // ESI-005 (audit integrasi 2026-09-30): backend mengirim "APPROVED",
        // bukan "VERIFIED" (VERIFIED tidak ada di enum backend `KycStatus`).
        kycDone: kycQuery.data?.status === "APPROVED",
        bankAccountDone: (bankQuery.data?.length ?? 0) > 0,
        firstShowcaseDone: (showcaseQuery.data?.length ?? 0) > 0,
      }),
    [kycQuery.data, bankQuery.data, showcaseQuery.data],
  )

  // Semua selesai → tandai permanen, kartu hilang (tidak menunggu unmount).
  useEffect(() => {
    if (!hasSession || dismissed || !progress.allDone) return
    // Pastikan bukan hasil loading kosong: ketiga query sudah punya data.
    if (!kycQuery.data || !bankQuery.data || !showcaseQuery.data) return
    void markOnboardingChecklistDone().then(() => setDismissed(true))
  }, [hasSession, dismissed, progress.allDone, kycQuery.data, bankQuery.data, showcaseQuery.data])

  return {
    dismissed,
    loading:
      hasSession &&
      !dismissed &&
      (kycQuery.loading || bankQuery.loading || showcaseQuery.loading),
    progress,
    refresh: () => {
      kycQuery.refresh()
      bankQuery.refresh()
      showcaseQuery.refresh()
    },
  }
}
