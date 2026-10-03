/**
 * P1-3 (audit perf/UX 2026-10-03): draft lokal form "Buat Transaksi".
 *
 * Skenario yang dikunci (persis verifikasi audit): isi 3 field → layar
 * ter-unmount → mount kembali → isian terpulihkan. Di lapisan ini bentuknya
 * save → load round-trip; layarnya menggerakkan modul ini dengan debounce
 * 1 detik + flush saat unmount.
 *
 * Aturan tambahan yang diuji:
 *   - draft BASI (> 24 jam), kosong, atau `savedAt` tidak masuk akal TIDAK
 *     pernah ditawarkan (fail-closed: lebih baik form kosong daripada angka
 *     lama yang tidak jelas umurnya),
 *   - nilai dari storage divalidasi ulang (enum dikenal, angka >= 0, panjang
 *     string dibatasi) — isi storage bisa rusak/diubah,
 *   - tenggat yang sudah lewat tidak dipulihkan (validasi "Pilih tanggal"
 *     akan menahan Lanjut tanpa penjelasan).
 */
import { beforeEach, describe, expect, it } from "vitest"

import {
  clearTransactionDraft,
  isMeaningfulTransactionDraft,
  isTransactionDraftFresh,
  loadTransactionDraft,
  saveTransactionDraft,
  shouldOfferTransactionDraftRestore,
  transactionDraftDeadline,
  transactionDraftFingerprint,
  transactionDraftStep,
  TRANSACTION_DRAFT_MAX_AGE_MS,
  type TransactionDraft,
} from "@/lib/transaction-draft"
import { SecureKeys, setSecureItem } from "@/lib/secure-storage"
import { __store } from "./stubs/expo"

const base = {
  mode: "direct" as const,
  role: "BUYER" as const,
  counterpart: "penjual",
  title: "Sepatu bekas",
  description: "Ukuran 42, kondisi mulus.",
  orderType: "PHYSICAL_GOODS" as const,
  orderValue: 250_000,
  deadlineIso: null,
  feeResponsibility: "SPLIT" as const,
}

beforeEach(async () => {
  __store.reset()
  // secure-storage web punya memori modulnya sendiri (bukan stub expo);
  // bersihkan agar tidak ada draft yang bocor antar-test.
  await clearTransactionDraft()
})

describe("P1-3: round-trip draft", () => {
  it("save → load mengembalikan isian yang sama + savedAt", async () => {
    await saveTransactionDraft(base)

    const loaded = await loadTransactionDraft()
    expect(loaded).not.toBeNull()
    expect(loaded).toMatchObject(base)
    expect(Date.parse(loaded!.savedAt)).not.toBeNaN()
  })

  it("isi 3 field → 'unmount' → mount kembali → terpulihkan", async () => {
    // Skenario audit dalam bentuk paling kecil: 3 field terisi, layar hilang.
    await saveTransactionDraft({
      ...base,
      counterpart: "",
      title: "Kamera",
      description: "Lensa kit",
      orderValue: 0,
      deadlineIso: null,
      orderType: "DIGITAL_GOODS",
    })

    const loaded = await loadTransactionDraft()
    expect(shouldOfferTransactionDraftRestore(loaded)).toBe(true)
    expect(loaded?.title).toBe("Kamera")
    expect(loaded?.description).toBe("Lensa kit")
    expect(loaded?.orderType).toBe("DIGITAL_GOODS")
  })

  it("clear menghapus draft dari storage", async () => {
    await saveTransactionDraft(base)
    await clearTransactionDraft()
    expect(await loadTransactionDraft()).toBeNull()
  })

  it("tidak ada draft → null (bukan objek kosong)", async () => {
    expect(await loadTransactionDraft()).toBeNull()
  })
})

describe("P1-3: validasi isi storage (fail-closed)", () => {
  it("enum tak dikenal jatuh ke default, bukan diteruskan apa adanya", async () => {
    await setSecureItem(
      SecureKeys.transactionDraft,
      JSON.stringify({
        ...base,
        mode: "transfer",
        role: "ADMIN",
        orderType: "MAGIC",
        feeResponsibility: "NOBODY",
        orderValue: -5,
      }),
    )

    const loaded = await loadTransactionDraft()
    expect(loaded).toMatchObject({
      mode: "direct",
      role: "BUYER",
      orderType: "SERVICE",
      feeResponsibility: "SPLIT",
      orderValue: 0,
    })
  })

  it("nominal non-finite / string ditolak", async () => {
    await setSecureItem(
      SecureKeys.transactionDraft,
      JSON.stringify({ ...base, orderValue: "Rp250.000" }),
    )
    expect((await loadTransactionDraft())?.orderValue).toBe(0)
  })

  it("string panjang dipotong, deadline tidak valid jadi null", async () => {
    await setSecureItem(
      SecureKeys.transactionDraft,
      JSON.stringify({
        ...base,
        title: "a".repeat(500),
        description: "b".repeat(9000),
        counterpart: "c".repeat(100),
        deadlineIso: "bukan-tanggal",
      }),
    )

    const loaded = await loadTransactionDraft()
    expect(loaded?.title.length).toBe(200)
    expect(loaded?.description.length).toBe(4000)
    expect(loaded?.counterpart.length).toBe(40)
    expect(loaded?.deadlineIso).toBeNull()
  })

  it("JSON rusak → null (tidak melempar ke layar)", async () => {
    await setSecureItem(SecureKeys.transactionDraft, "{bukan json")
    expect(await loadTransactionDraft()).toBeNull()
  })

})

describe("P1-3: umur draft (24 jam)", () => {
  const draftAt = (savedAt: string): TransactionDraft => ({ ...base, savedAt })
  const now = Date.parse("2026-10-03T12:00:00.000Z")
  const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString()

  it("draft 23 jam masih segar, 24 jam + 1 detik sudah basi", () => {
    expect(isTransactionDraftFresh(draftAt(iso(-23 * 3600_000)), now)).toBe(true)
    expect(
      isTransactionDraftFresh(draftAt(iso(-(TRANSACTION_DRAFT_MAX_AGE_MS + 1000))), now),
    ).toBe(false)
  })

  it("savedAt di masa depan / tidak valid → basi (jam perangkat bergeser)", () => {
    expect(isTransactionDraftFresh(draftAt(iso(60_000)), now)).toBe(false)
    expect(isTransactionDraftFresh(draftAt(""), now)).toBe(false)
    expect(isTransactionDraftFresh(draftAt("bukan-tanggal"), now)).toBe(false)
  })

  it("shouldOffer menolak null, kosong, dan basi", () => {
    expect(shouldOfferTransactionDraftRestore(null, now)).toBe(false)
    const empty: TransactionDraft = { ...base, counterpart: "", title: "", description: "", orderValue: 0, savedAt: iso(0) }
    expect(shouldOfferTransactionDraftRestore(empty, now)).toBe(false)
    expect(
      shouldOfferTransactionDraftRestore(
        draftAt(iso(-(TRANSACTION_DRAFT_MAX_AGE_MS + 1))),
        now,
      ),
    ).toBe(false)
    expect(shouldOfferTransactionDraftRestore(draftAt(iso(-1000)), now)).toBe(true)
  })
})

describe("P1-3: helper pemulihan", () => {
  it("isMeaningful = ada isian pengguna", () => {
    expect(isMeaningfulTransactionDraft({ ...base, savedAt: "" })).toBe(true)
    expect(
      isMeaningfulTransactionDraft({
        ...base,
        counterpart: "  ",
        title: "",
        description: "",
        orderValue: 0,
        deadlineIso: null,
        savedAt: "",
      }),
    ).toBe(false)
    expect(
      isMeaningfulTransactionDraft({ ...base, title: "", description: "", counterpart: "", orderValue: 1, savedAt: "" }),
    ).toBe(true)
  })

  it("tenggat masa lalu TIDAK dipulihkan", () => {
    const past = new Date("2026-10-01T00:00:00.000Z")
    const now = new Date("2026-10-03T12:00:00.000Z")
    expect(
      transactionDraftDeadline({ ...base, deadlineIso: past.toISOString(), savedAt: "" }, now),
    ).toBeNull()
    const future = new Date("2026-10-05T00:00:00.000Z")
    expect(
      transactionDraftDeadline({ ...base, deadlineIso: future.toISOString(), savedAt: "" }, now)?.getTime(),
    ).toBe(future.getTime())
  })

  it("langkah setelah pemulihan mengikuti kelengkapan isi", () => {
    expect(transactionDraftStep({ ...base, savedAt: "" })).toBe(2)
    expect(
      transactionDraftStep({ ...base, title: "", description: "", orderValue: 0, savedAt: "" }),
    ).toBe(1)
    expect(
      transactionDraftStep({
        ...base,
        counterpart: "",
        title: "",
        description: "",
        orderValue: 0,
        savedAt: "",
      }),
    ).toBe(0)
  })

  it("sidik jari mengabaikan savedAt & merapikan spasi (prefill vs isian)", () => {
    const a: TransactionDraft = { ...base, savedAt: "2026-10-03T00:00:00.000Z" }
    const b = { ...base, savedAt: "2026-10-03T09:00:00.000Z", title: `  ${base.title}  ` }
    expect(transactionDraftFingerprint(a)).toBe(transactionDraftFingerprint(b))
    expect(transactionDraftFingerprint(a)).not.toBe(
      transactionDraftFingerprint({ ...b, orderValue: base.orderValue + 1 }),
    )
  })
})
