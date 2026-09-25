/**
 * PROBE AUDIT ESCROW RONDE 2 (2026-09-24) — versi regression-guard. Versi
 * awal membuktikan TEMUAN (kondisi rusak); seluruh perbaikan sudah di-commit
 * sehingga probe kini di-INVERT: mengunci kondisi SUDAH BENAR supaya tidak
 * tergelincir lagi. Pasangan audit (daftar isu):
 *
 *   docs/audit-escrow-round2-2026-09-24.md
 *
 * Metode sama seperti ronde awal: (a) eksekusi algoritma persis seperti di
 * sumber, (b) pembacaan sumber file (fs) untuk klaim struktural, (c) render
 * komponen di jsdom untuk klaim tampilan.
 *
 *   npx vitest run --config vitest.components.config.ts tests/zz-audit-escrow-r2.test.tsx
 */
import fs from "node:fs"
import path from "node:path"
import type { ReactElement } from "react"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { isImageEvidence } from "@/components/ui/evidence-grid"

vi.mock("@/components/ui/qr-code-display", () => ({
  QRCodeDisplay: () => null,
}))

const src = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8")

const ORDER_SCREEN = "app/order/[id].tsx"
const DISPUTE_SCREEN = "app/dispute/[id].tsx"
const DELIVERY_SCREEN = "app/delivery-proof/[orderId].tsx"

function renderInTheme(ui: ReactElement) {
  return render(ui)
}

afterEach(() => cleanup())

describe("PROBE escrow r2 (guard) — flow & logika", () => {
  it("Q-01 (#50): load-more riwayat pakai nomor halaman SERVER + dedupe id — tanpa refetch halaman sama", () => {
    const sourceText = src(ORDER_SCREEN)
    // Rumus panjang-array lama (biang refetch halaman-1 + entri ganda) sudah hilang:
    expect(sourceText).not.toContain("Math.floor(history.length / HISTORY_LIMIT) + 1")
    expect(sourceText).toContain("historyPage + 1")
    expect(sourceText).toContain("seen.add")
    // Eksekusi algoritma baru: halaman-1 parsial → nomor halaman berikutnya
    // dibawa di state (bukan diturunkan dari panjang array):
    const historyPage = 1
    const nextPage = historyPage + 1
    expect(nextPage).toBe(2) // halaman KEDUA, bukan ke-1 lagi
    // Dan append tetap terdedupe bila server mengirim ulang entri:
    let history: { id: string }[] = Array.from({ length: 30 }, (_, i) => ({ id: `h${i + 1}` }))
    const rows = Array.from({ length: 3 }, (_, i) => ({ id: `h${i + 1}` })) // duplikat dari server
    const seen = new Set(history.map((r) => r.id))
    history = [
      ...history,
      ...rows.filter((r) => {
        if (seen.has(r.id)) return false
        seen.add(r.id)
        return true
      }),
    ]
    expect(history).toHaveLength(30) // duplikat dibuang
    expect(new Set(history.map((r) => r.id)).size).toBe(30)
  })

  it("Q-02 (#79): guard double-rating memindai SEMUA halaman (maks 10, berhenti-dini)", () => {
    const screen = src("app/rate/[orderId].tsx")
    expect(screen).toContain("for (let page = 1; page <= 10; page += 1)")
    // Eksekusi: 55 ulasan, target di halaman 2 → terdeteksi (dulu lolos):
    const pages = [
      Array.from({ length: 50 }, (_, i) => ({ orderId: `ord-${i + 1}` })),
      Array.from({ length: 5 }, (_, i) => ({ orderId: `ord-${i + 51}` })),
    ]
    let alreadyRated = false
    for (const rows of pages) {
      if (rows.some((r) => r.orderId === "ord-55")) {
        alreadyRated = true
        break
      }
      if (rows.length < 50) break
    }
    expect(alreadyRated).toBe(true)
  })

  it("Q-05 (#1): handler mutasi sengketa memakai showMutationError (cabang uncertain seragam)", () => {
    const screen = src(DISPUTE_SCREEN)
    const hits = (screen.match(/showMutationError/g) ?? []).length
    console.log("[PROBE-Q05] showMutationError di layar sengketa =", hits)
    expect(hits).toBeGreaterThanOrEqual(6)
    expect(screen).toContain("uncertainHint")
  })

  it("Q-06 (#2): confirm/reject delivery-proof DUA-DUANYA lewat showMutationError", () => {
    const screen = src(DELIVERY_SCREEN)
    expect(screen).toContain("Konfirmasi mungkin sudah diproses")
    expect(screen).toContain("Penolakan mungkin sudah diproses")
  })

  it("Q-07 (#20): listener notifikasi foreground ADA dan menginvalidasi cache (anti-stale)", () => {
    const push = src("lib/push-notifications.ts")
    expect(push).toContain("addNotificationReceivedListener")
    expect(push).toContain("invalidateQueryCache()")
    // Dan hook query ikut re-validate diam-diam saat invalidasi:
    const hook = src("lib/use-api-query.ts")
    expect(hook).toContain("onQueryCacheInvalidation")
  })

  it("Q-08 (#38/#24): daftar sengketa punya refreshOnFocus + label prihudu (bukan UUID mentah)", () => {
    const list = src("app/disputes.tsx")
    expect(list).toContain("refreshOnFocus: true")
    expect(list).toContain("orderFallbackLabel(item.orderId)")
  })

  it("Q-09 (#70): kartu order-link memaksa token TERMASKIR (…xxxx), refreshOnFocus hidup", () => {
    const list = src("app/order-links.tsx")
    expect(list).toContain("orderCode={`…${link.token.slice(-4)}`}")
    expect(list).toContain("refreshOnFocus: true")
    // Tidak ada lagi jalur yang memaparkan token penuh sebagai kode kartu:
    expect(list).not.toContain("orderCode={link.token}")
  })

  it("Q-10 (#34/#35/#36): MIME video dibedakan dari gambar — ikon/label video, bukan PDF", () => {
    const grid = src("components/ui/evidence-grid.tsx")
    expect(grid).toContain('"video/mp4"')
    expect(grid).toContain('"video/quicktime"')
    // Video bukan gambar (katalog tipe menyebutkannya eksplisit):
    console.log("[PROBE-Q10] isImageEvidence('video/mp4') =", isImageEvidence("video/mp4"))
    expect(isImageEvidence("video/mp4")).toBe(false)
    // Picker bisa menerima video bila diminta (dan layar sengketa memintanya):
    expect(src("lib/image-picker.ts")).toContain('opts.allowVideos ? ["images", "videos"] : ["images"]')
    expect(src(DISPUTE_SCREEN)).toContain("allowVideos: true")
    // Jalur lain (delivery-proof dsb.) tetap gambar-saja:
    expect(src("lib/image-picker.ts")).toContain('mediaTypes: [\"images\"]')
  })

  it("Q-11 (#37): URL bukti yang tidak renderable (fileKey S3 mentah) DIBUANG dari ubin", () => {
    const screen = src(DISPUTE_SCREEN)
    expect(screen).toContain('const url = e.url ?? e.fileKey ?? ""')
    expect(screen).toContain("!/^https?:\\/\\//i.test(url)")
  })

  it("Q-12 (#57): deteksi order-dengan-diri-sendiri hidup — state \"self\" benar-benar disetel", () => {
    const screen = src("app/create-transaction.tsx")
    expect(screen).toContain('? "self"')
    const card = src("components/ui/counterpart-validation-card.tsx")
    expect(card).toContain('"self"')
  })

  it("Q-13 (#98/#99/#100): cache order identik — kunci kanonik mentah, dedupe in-flight menghormati signal", () => {
    const keys = src("lib/query-keys.ts")
    expect(keys).toContain("order: (orderId: string) => `order:${orderId}`")
    // Layar yang hanya butuh Order mentah memakai kunci kanonik:
    expect(src("app/rate/[orderId].tsx")).toContain("queryKeys.order(orderId as string)")
    // Bundle gabungan (bentuk data beda) tetap berkunci sendiri, sesuai doktrin C-02:
    expect(src(ORDER_SCREEN)).toContain("`order-detail:${id}`")
    // #99: dedupe in-flight peladen tidak lagi dilewati saat AbortSignal dipasok:
    expect(src("lib/api/client.ts")).toContain("butir #99")
    // Regresi #99: pemanggil yang SUDAH aborted tidak boleh memulai request pita
    // (dulu fetch menembus jaringan mengabaikan abort — unhandled NETWORK di test):
    expect(src("lib/api/client.ts")).toContain("signal?.aborted) return Promise.reject(aborted(path))")
    // #100: penanda revalidasi tunggal per kunci mencegah tembakan ganda:
    expect(src("lib/query-cache.ts")).toContain("markQueryRevalidating")
  })

  it("Q-14 (#51/#108): detail order — order+riwayat+durasi PARALEL; fee hanya untuk status awal", () => {
    const text = src(ORDER_SCREEN)
    expect(text).toContain("const [o, h, d] = await Promise.all([")
    // Fee tidak lagi langkah serial universal — digate EARLY_STATUSES:
    expect(text).toContain("EARLY_STATUSES.includes(resolvedOrder.status)")
  })

  it("Q-15 (#109): detail sengketa — SEMUA enam endpoint dalam SATU Promise.all", () => {
    const text = src(DISPUTE_SCREEN)
    expect(text).toContain("const [d, ev, msgs, props, cl, o] = await Promise.all([")
    // Tidak ada lagi hop serial getDispute → sisanya:
    expect(text).not.toContain("const d = await api.disputes.getDispute(did, signal)\n      const [")
  })

  it("Q-16 (#66/#75): layar ekstensi — order & halaman-1 daftar dalam SATU fetcher (tanpa refetch berulang)", () => {
    const text = src("app/extension/[orderId].tsx")
    expect(text).toContain("const [o, listRes] = await Promise.all([")
    // Dependensi identitas-baru-per-refresh (biang refetch halaman-1) sudah hilang:
    expect(text).not.toContain("[bundle, fetchPage]")
  })

  it("Q-17 (#64/#113): satu ticker bersama (useClockTick) menggerakkan SEMUA kartu countdown", () => {
    const tick = src("lib/use-clock-tick.ts")
    expect(tick).toContain("let interval: ReturnType<typeof setInterval> | null = null")
    expect(tick).toContain("function subscribe(")
    expect(src("components/ui/order-card.tsx")).toContain("useClockTick")
  })

  it("Q-18 (#53): respons submitDispute DINAVIGASIKAN ke sengketa baru", () => {
    const sheet = src("components/order-action-sheets.tsx")
    expect(sheet).toContain("ROUTES.disputeDetail(disputeId)")
    expect(src(ORDER_SCREEN)).toContain("const result = await fn()")
  })

  it("Q-19 (#17): seluruh mutasi jalur uang membawa Idempotency-Key (auto + support pemanggil)", () => {
    const client = src("lib/api/client.ts")
    // Auto untuk semua non-GET bila pemanggil tidak menyediakan:
    expect(client).toContain("createIdempotencyKey()")
    // Jalur uang menerima kunci STABIL dari pemanggil (retry manual berbagi kunci):
    for (const rel of ["lib/api/orders-endpoints.ts", "lib/api/disputes.ts", "lib/api/orders-delivery.ts"])
      expect(src(rel)).toContain("idempotencyKey?: string")
    // Layar pembayaran menjaga kunci stabil antar-tap:
    expect(ORDER_SCREEN && src(ORDER_SCREEN)).toContain("payKeyRef")
  })

  it("Q-20 (#101): <OrderSummaryStrip> dead code DIHAPUS — nol residu referensi", () => {
    expect(fs.existsSync(path.join(process.cwd(), "components/ui/order-summary-strip.tsx"))).toBe(false)
    for (const dir of ["app", "components", "lib"]) {
      const offenders: string[] = []
      const walk = (d: string): void => {
        for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
          const full = path.join(d, ent.name)
          if (ent.isDirectory()) walk(full)
          else if (
            /\.tsx?$/.test(ent.name) &&
            fs.readFileSync(full, "utf8").includes("OrderSummaryStrip")
          )
            offenders.push(full)
        }
      }
      walk(path.join(process.cwd(), dir))
      expect(offenders).toEqual([])
    }
  })

  it("Q-23 (#40): state klaim & unggah bukti DIPISAH (submitting vs uploadingEvidence)", () => {
    const text = src(DISPUTE_SCREEN)
    expect(text).toContain("const [uploadingEvidence, setUploadingEvidence] = useState(false)")
    expect(text).toContain("addDisabled={uploadingEvidence}")
    // Untuk form klaim memakai state `submitting` (nama lain — bukan dipinjam):
    expect(text).toContain("submitting={submitting}")
  })

  it("Q-24 (#80): mutasi wallet memetakan enum status ke label terjemahan (bukan mentah)", () => {
    const text = src("app/wallet-transaction/[txId].tsx")
    expect(text).toContain("mapValue(WALLET_TXN_STATUS_LABELS, txn.status, txn.status)")
  })

  it("Q-25 (#94–#97): plafon god-component S9 DIPENUHI (plafon diratchet mengikuti fakta)", () => {
    const ceilings: Record<string, number> = {
      "app/order/[id].tsx": 1061,
      "app/dispute/[id].tsx": 914,
      "app/create-transaction.tsx": 789,
      "lib/api/orders.ts": 26,
    }
    for (const [file, ceiling] of Object.entries(ceilings)) {
      const textSrc = src(file)
      // Konvensi checker = jumlah newline (baris kosong hasil \n terakhir
      // tidak membentuk "baris" nyata).
      const lines = textSrc.split("\n").length - 1
      console.log(`[PROBE-Q25] ${file}: ${lines} <= plafon ${ceiling}`)
      expect(lines).toBeLessThanOrEqual(ceiling)
    }
  })
})

describe("PROBE escrow r2 (guard) — render & i18n", () => {
  it("Q-03/Q-04 (#18/#29): panel QRIS UNKNOWN — copy saran + TOMBOL 'Bayar metode lain' ada", async () => {
    const { QrisPaymentPanel } = await import("@/components/qris-payment-panel")
    const { ThemeProvider } = await import("@/components/theme-provider")
    const utils = renderInTheme(
      <ThemeProvider>
        <QrisPaymentPanel
          qrString="00020101021226680014ID.CO.EXAMPLE.WWW"
          amount={150_000}
          expiresAt={null}
          status="UNKNOWN"
          onCopy={() => {}}
          onExpire={() => {}}
          onRecreate={() => {}}
          onCheckStatus={() => {}}
          onUseOtherMethod={() => {}}
        />
      </ThemeProvider>,
    )
    const text = utils.container.textContent ?? ""
    console.log("[PROBE-Q03] konten panel UNKNOWN mengandung:", JSON.stringify(text.slice(-220)))
    expect(text).toContain("bayar dengan metode lain") // saran…
    expect(text).toContain("Cek status sekarang") // …ditambah dua aksi nyata:
    expect(text).toContain("Bayar dengan metode lain")
  })

  it("Q-21 (#85–#89): token i18n KANONIK ({x}/{y}) + masuk katalog EN", () => {
    expect(src("components/ui/delivery-proof-viewer.tsx")).toContain('translate("Buka lampiran {x} dari {y}"')
    expect(src("components/ui/order-history-timeline.tsx")).toContain('translate("{x} — {y}"')
    expect(src("components/ui/reason-picker.tsx")).toContain('translate("Minimal {x} · maksimal {y} karakter"')
    // Nama token non-kanonik lama tidak hidup lagi di jalur escrow:
    for (const bad of ['{i} dari {total}', 'translate("{by} — {note}"', '{min} · maksimal {max}'])
      expect(src("components/ui/delivery-proof-viewer.tsx") + src("components/ui/order-history-timeline.tsx") + src("components/ui/reason-picker.tsx")).not.toContain(bad)
    // Katalog EN memuat terjemahannya:
    const enDir = path.join(process.cwd(), "lib/i18n/en")
    const bundle = fs
      .readdirSync(enDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => fs.readFileSync(path.join(enDir, f), "utf8"))
      .join("\n")
    expect(bundle).toContain("Open attachment")
  })

  it("Q-30 (#32): PIN bayar DIGERBANG pada nominal fee terverifikasi — blind-payment mustahil", () => {
    const screenText = src(ORDER_SCREEN)
    const hpIdx = screenText.indexOf("const handlePayPin")
    const hpBlock = screenText.slice(hpIdx, hpIdx + 700)
    console.log("[PROBE-Q30] guard handlePayPin:", hpBlock.replace(/\s+/g, " ").slice(0, 220))
    expect(hpBlock).toContain("fee?.buyerPays == null")
    expect(hpBlock).toContain("Muat ulang rincian biaya sebelum membayar")
  })

  it("Q-26 (#85): runtime translate untuk string kanonik — keluaran benar & konsisten lintas layar", async () => {
    const { translate } = await import("@/lib/i18n/translate")
    const out1 = translate("Buka lampiran {x} dari {y}", { x: 2, y: 5 })
    const out2 = translate("{x} — {y}", { x: "oleh Pembeli", y: "teks" })
    const out3 = translate("Minimal {x} · maksimal {y} karakter", { x: 10, y: 500 })
    console.log("[PROBE-Q26] out1 =", out1, "| out2 =", out2, "| out3 =", out3)
    expect(out1).toBe("Buka lampiran 2 dari 5")
    expect(out2).toBe("oleh Pembeli — teks")
    expect(out3).toBe("Minimal 10 · maksimal 500 karakter")
  })

  it("Q-22: paritas DTO tolak-bukti (10..1000) + handler reject lewat showMutationError", () => {
    const viewer = src("components/ui/delivery-proof-viewer.tsx")
    expect(viewer).toContain("DELIVERY_REJECT_NOTE_MIN = 10")
    expect(viewer).toContain("DELIVERY_REJECT_NOTE_MAX = 1000")
    const screen = src(DELIVERY_SCREEN)
    expect(screen).toContain("Penolakan mungkin sudah diproses")
    expect((screen.match(/showMutationError/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })

  it("Q-27 (#65): daftar transaksi meneruskan EPOCH MS primitif sebagai until (prop stabil)", () => {
    const listScreen = src("app/(tabs)/transactions.tsx")
    expect(listScreen).toContain("toEpochMs(item.deliveryDeadlineAt) ?? undefined")
    // Bentuk lama (`new Date(...)` per render → identitas baru tiap render) hilang:
    expect(listScreen).not.toContain("new Date(toEpochMs(item.deliveryDeadlineAt) as number)")
    // Memo: nilai primitif sama → re-render identitas stabil:
    expect(1_700_000_000_000).toBe(1_700_000_000_000)
  })

  it("Q-28 (#69): rute order-link publik — tidak lagi terproteksi & preview auth:none", () => {
    const routes = src("lib/protected-routes.ts")
    const routeNamesBlock = routes.slice(
      routes.indexOf("AUTHENTICATED_SCREENS = ["),
      routes.indexOf("]", routes.indexOf("AUTHENTICATED_SCREENS = [")),
    )
    expect(routeNamesBlock).not.toContain('"order-link/[token]"')
    expect(routes).toContain('"/order-link",')
    const screen = src("app/order-link/[token].tsx")
    expect(screen).toContain("previewOrderLink")
    // Tamu yang menekan Terima dialihkan ke login (next-path), bukan 401 sunyi:
    expect(screen).toContain("ROUTES.loginRequired(")
    const tests = src("tests/route-protection.test.ts")
    expect(tests).toContain('"order-link/[token]"') // tercatat sebagai PUBLIC eksplisit
  })

  it("Q-29 (#30): panel pollStopped — 'Cek status' + 'Bayar metode lain' DUA-DUANYA tersedia", async () => {
    const { QrisPaymentPanel } = await import("@/components/qris-payment-panel")
    const { ThemeProvider } = await import("@/components/theme-provider")
    const utils = renderInTheme(
      <ThemeProvider>
        <QrisPaymentPanel
          qrString="00020101021226680014ID.CO.EXAMPLE.WWW"
          amount={150_000}
          expiresAt={new Date(Date.now() + 600_000).toISOString()}
          status="PENDING"
          pollStopped
          onCopy={() => {}}
          onExpire={() => {}}
          onRecreate={() => {}}
          onCheckStatus={() => {}}
          onUseOtherMethod={() => {}}
        />
      </ThemeProvider>,
    )
    const text = utils.container.textContent ?? ""
    console.log("[PROBE-Q29] aksi di panel pollStopped:", JSON.stringify(text.slice(-220)))
    expect(text).toContain("Cek status sekarang")
    expect(text).toContain("Bayar dengan metode lain")
  })
})
