#!/usr/bin/env node
/**
 * Kahade — audit statis layar (`npm run check:screens`).
 *
 * Tiga pemeriksaan `check:*` yang sudah ada menjaga TOKEN, A11Y, dan KONTRAK
 * API. Yang tidak dijaga siapa pun sebelumnya adalah bagaimana layar memakai
 * kembali lapisan yang sudah dibangun: hook data bersama, kerangka layar, dan
 * state UI dari design system. Akibatnya sebagian besar route menyalin ulang
 * blok yang sama dan menyimpang di detail yang penting (abort request, pesan
 * galat backend, kedipan saat pull-to-refresh).
 *
 * Skrip ini mengukur penyimpangan itu. Setiap aturan punya BASELINE — daftar
 * file yang sudah melanggar saat aturan dibuat. Skrip GAGAL bila:
 *   a. ada file baru yang melanggar (regresi), atau
 *   b. ada file di baseline yang sudah tidak melanggar tetapi belum dicoret
 *      (baseline basi — pemeriksaan harus mengetat, bukan mengendur).
 *
 * Jadi baseline hanya boleh mengecil. Saat sebuah layar dimigrasikan, hapus
 * namanya dari daftar di bawah.
 *
 * Jalankan: npm run check:screens
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const rel = (p) => relative(root, p).split("\\").join("/")

function* walk(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue
      yield* walk(p)
    } else if (/\.tsx?$/.test(entry)) yield p
  }
}

/**
 * Komentar dibuang sebelum pencocokan: docblock di repo ini sering MENGUTIP
 * pola lama ("sebelumnya `pathname: \"/x\"`") sebagai catatan audit. Mencocokkan
 * teks komentar akan menandai file yang justru sudah diperbaiki.
 */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1")

const screens = [...walk(join(root, "app"))]
  .filter((p) => p.endsWith(".tsx") && !/\+(html|not-found)\.tsx$/.test(p))
  .map((p) => ({ path: rel(p), src: stripComments(readFileSync(p, "utf8")) }))

const uiComponents = [...walk(join(root, "components", "ui"))].map((p) => rel(p))
const allSources = [...walk(join(root, "app")), ...walk(join(root, "components")), ...walk(join(root, "lib")), ...walk(join(root, "tests"))].map(
  (p) => ({ path: rel(p), src: readFileSync(p, "utf8") }),
)

// ------------------------------------------------------------------
// Aturan
// ------------------------------------------------------------------

const SHARED_QUERY = /\buse(Api|Paginated)Query\b/

const rules = []

/**
 * S1 — layar merakit sendiri siklus muat/refresh.
 *
 * Kenapa penting: `useApiQuery`/`usePaginatedQuery` membatalkan request lama
 * (respons lambat tidak bisa menimpa data baru), memisahkan `loading` dari
 * `refreshing`, dan mengubah error menjadi `userMessage(err)`. Rakitan manual
 * kehilangan ketiganya sekaligus.
 */
rules.push({
  id: "S1",
  title: "Layar merakit sendiri state async (bukan useApiQuery/usePaginatedQuery)",
  // `set[A-Z]\w*Loading` — sebelumnya hanya `setLoading\(`, sehingga layar
  // yang menamai ulang statenya (setProfileLoading, setWalletLoading, …)
  // lolos aturan padahal polanya sama persis. Nama variabel bukan alasan
  // untuk mengecualikan layar dari perlindungan abort/stale-response.
  test: (f) =>
    /set(?:[A-Z]\w*)?Refreshing\s*\(/.test(f.src) &&
    /set(?:[A-Z]\w*)?Loading\s*\(/.test(f.src) &&
    !SHARED_QUERY.test(f.src),
  baseline: [
    // Form multi-bagian, bukan layar data: fee & validasi lawan transaksi
    // di-debounce per ketikan dan sudah memakai guard `draft.current` +
    // `confirmedFeeKey`/`confirmedCounterpart` — padanan useApiQuery untuk
    // form (respons lama tidak bisa menimpa input baru). Memaksakan
    // useApiQuery di sini justru menghilangkan guard konfirmasi form.
    "app/create-transaction.tsx",
    "app/user/[username].tsx",
  ],
})

/**
 * S2 — copy galat ditulis tangan di layar.
 *
 * `setError("Gagal memuat X.")` MEMBUANG pesan backend. Pengguna yang ditolak
 * karena KYC belum selesai, rate limit, atau data sudah berubah membaca kalimat
 * yang sama dengan pengguna yang kehilangan sinyal — dan support tidak punya
 * apa pun untuk ditindaklanjuti. Pakai `userMessage(err)`.
 */
rules.push({
  id: "S2",
  title: 'setError("…") literal menggantikan pesan backend (pakai userMessage(err))',
  test: (f) => /setError\(\s*"/.test(f.src),
  baseline: [],
})

/**
 * S3 — kerangka layar disalin, bukan dipakai ulang.
 *
 * `useSafeAreaInsets()` + <PullToRefresh> + `insets.bottom + tokens.space[N]`
 * adalah kerangka <DataScreen>. Menyalinnya membuat inset bawah, urutan state,
 * dan padding konten berbeda-beda antar layar.
 */
rules.push({
  id: "S3",
  title: "Kerangka Screen+Header+PullToRefresh disalin manual (pakai <DataScreen>)",
  test: (f) =>
    /useSafeAreaInsets\(\)/.test(f.src) &&
    /<PullToRefresh/.test(f.src) &&
    /insets\.bottom\s*\+\s*tokens\.space/.test(f.src),
  baseline: [
    "app/analytics.tsx",
    "app/bank-accounts.tsx",
    "app/create-transaction.tsx",
    "app/delivery-proof/[orderId].tsx",
    "app/edit-profile.tsx",
    "app/extension/[orderId].tsx",
    "app/invoice/[orderId].tsx",
    "app/kyc.tsx",
    "app/order-link/[token].tsx",
    "app/order-links.tsx",
    "app/order/[id].tsx",
    "app/questions.tsx",
    "app/rate/[orderId].tsx",
    "app/ratings.tsx",
    "app/referral.tsx",
    "app/reports.tsx",
    "app/security.tsx",
    "app/showcase.tsx",
    "app/subscriptions.tsx",
    "app/support/[ticketId].tsx",
    "app/topup.tsx",
    "app/transaction-templates.tsx",
    "app/transfer.tsx",
    "app/two-factor.tsx",
    "app/user/[username].tsx",
    "app/user/[username]/questions.tsx",
    "app/user/[username]/ratings.tsx",
    "app/user/[username]/showcase.tsx",
    "app/wallet-transaction/[txId].tsx",
    "app/withdraw.tsx",
    "app/withdrawal-schedules.tsx",
  ],
})

/**
 * S4 — route literal di luar lib/routes.ts.
 *
 * Satu-satunya sumber path adalah `ROUTES`. `pathname: "/x"` atau
 * `router.push("/x")` di layar membuat rename folder `app/` gagal diam-diam.
 */
rules.push({
  id: "S4",
  title: 'Route literal di app/ (pakai ROUTES dari lib/routes.ts)',
  test: (f) =>
    /router\.(push|replace|navigate)\(\s*["'`]\//.test(f.src) ||
    /pathname:\s*["'`]\//.test(f.src),
  baseline: [],
})

/**
 * S6 — fetcher `useApiQuery`/`usePaginatedQuery` yang membuang `signal`.
 *
 * Kenapa penting: kedua hook membuat `AbortController` per pemuatan dan
 * membatalkannya saat key berubah, saat `reload()` dipanggil lagi, dan saat
 * layar di-unmount. `client.ts` sudah menghormati signal sepenuhnya
 * (`checkAborted`, listener abort, dan `signal?.aborted` mematikan retry),
 * jadi satu-satunya yang hilang adalah penerusan dari call site.
 *
 * Tanpa signal, guard `if (!controller.signal.aborted)` memang mencegah state
 * basi, TAPI request HTTP-nya tetap berjalan sampai selesai: pada layar seperti
 * `analytics.tsx` (2 request paralel) dan `delete-account.tsx` (3 request
 * paralel) tiap perpindahan periode/re-mount meninggalkan 2–3 request yatim di
 * jaringan seluler. `retry: 1` di sebagian besar GET membuat satu pembatalan
 * yang tidak diteruskan bisa jadi dua request penuh.
 *
 * Aturan ini memindai app/ DAN components/ (mis. `legal-document-screen.tsx`)
 * karena hook data dipakai di kedua tempat.
 */
const HOOK_FETCHER = /\buse(Api|Paginated)Query\s*(?:<[\s\S]*?>)?\s*\(/g

/**
 * Pecah argumen tingkat-1 dari panggilan yang kurung pembukanya di indeks
 * `open`. Sadar string/kurung bersarang agar koma di dalam `{ page: 1 }`,
 * template literal, atau body arrow tidak memecah argumen.
 */
function splitArgs(src, open) {
  const args = []
  let depth = 0
  let quote = null
  let start = open + 1
  for (let i = open; i < src.length; i++) {
    const c = src[i]
    if (quote) {
      if (c === quote && src[i - 1] !== "\\") quote = null
      continue
    }
    if (c === '"' || c === "'" || c === "`") quote = c
    else if (c === "(" || c === "[" || c === "{") depth++
    else if (c === ")" || c === "]" || c === "}") {
      depth--
      if (depth === 0) {
        args.push(src.slice(start, i))
        return args
      }
    } else if (c === "," && depth === 1) {
      args.push(src.slice(start, i))
      start = i + 1
    }
  }
  return args
}

/**
 * true bila ada fetcher arrow yang daftar parameternya tidak menyebut `signal`.
 * Fetcher non-arrow (identifier, mis. `useApiQuery("k", loadThing)`) dilewati:
 * signature-nya diperiksa TypeScript, bukan regex.
 */
function dropsSignal(src) {
  HOOK_FETCHER.lastIndex = 0
  let m
  while ((m = HOOK_FETCHER.exec(src))) {
    const args = splitArgs(src, m.index + m[0].length - 1)
    const fetcher = (args[1] ?? "").trim()
    const params = fetcher.match(/^(?:async\s*)?\(([^)]*)\)\s*(?::[^=]*)?=>/)
    if (!params) continue
    if (!/\bsignal\b/.test(params[1])) return true
  }
  return false
}

const queryCallers = [
  ...screens,
  ...[...walk(join(root, "components"))]
    .filter((p) => p.endsWith(".tsx"))
    .map((p) => ({ path: rel(p), src: stripComments(readFileSync(p, "utf8")) })),
].filter((f) => SHARED_QUERY.test(f.src))

rules.push({
  id: "S6",
  title: "fetcher useApiQuery/usePaginatedQuery tidak meneruskan `signal` ke adapter",
  files: queryCallers,
  test: (f) => dropsSignal(f.src),
  baseline: [],
})

/**
 * S7 — komponen gesture yang melumpuhkan scroll.
 *
 * Tiga bentuk pelanggaran dengan akar yang sama (laporan pengguna 2026-09-08:
 * "pull to refresh ga bisa di scroll"), keduanya muncul dari niat baik
 * "supaya gesture tidak berebut dengan scroll":
 *
 *   a. `scrollEnabled` diset dari state data (`refreshing`/`loading`).
 *      Konsekuensinya layar BEKU selama request berjalan — dengan
 *      API_TIMEOUT_MS 20 detik dan hingga 2 retry (lib/api/client.ts) itu bisa
 *      ±1 menit — dan di web `scrollEnabled={false}` bukan "abaikan sentuhan"
 *      melainkan `overflow:hidden` (react-native-web ScrollViewBase
 *      styles.scrollDisabled), yang juga membuang posisi scroll.
 *   b. `<GestureDetector>` membungkus scroll container tanpa mematok
 *      `touchAction`. Default RNGH untuk web adalah `touch-action: none` dan
 *      dipasang LANGSUNG di elemen yang bisa di-scroll, sehingga halaman tidak
 *      dapat digeser dengan sentuhan sama sekali.
 *   c. `<PullToRefresh>` membuat gesture/worklet sendiri di atas ScrollView.
 *      Insiden kedua (force-close pada buka/scroll layar) menunjukkan bahwa
 *      touch callback UI-thread + synchronous state manager native berada di
 *      luar React ErrorBoundary. Walau aritmetikanya benar dan bundle lolos,
 *      kegagalannya menutup layar. Komponen ini wajib memakai RefreshControl
 *      native; branding indikator tidak boleh mengalahkan keselamatan input.
 *
 * Aturan ini tidak punya baseline: tidak ada layar/komponen yang boleh
 * melakukannya, sekarang maupun nanti.
 */
const gestureHosts = [...walk(join(root, "components")), ...walk(join(root, "lib"))]
  .filter((p) => /\.tsx?$/.test(p))
  .map((p) => ({ path: rel(p), src: stripComments(readFileSync(p, "utf8")) }))

rules.push({
  id: "S7",
  title:
    "Gesture component membahayakan scroll (scrollEnabled data / touch-action / custom pull gesture)",
  files: gestureHosts,
  test: (f) =>
    /scrollEnabled=\{[^}]*\b(?:refreshing|loading|isValidating)\b/.test(f.src) ||
    (/<GestureDetector/.test(f.src) &&
      /<(?:Animated\.)?[A-Za-z]*ScrollView\b/.test(f.src) &&
      !/touchAction=/.test(f.src)) ||
    (f.path.endsWith("/pull-to-refresh.tsx") &&
      /react-native-(?:gesture-handler|reanimated)|\bPanResponder\b/.test(f.src)),
  baseline: [],
})

const failures = []
const staleBaselines = []

for (const rule of rules) {
  const offenders = (rule.files ?? screens).filter(rule.test).map((f) => f.path).sort()
  const baseline = new Set(rule.baseline)
  for (const file of offenders) {
    if (!baseline.has(file)) failures.push(`${rule.id} ${file} — ${rule.title}`)
  }
  for (const file of rule.baseline) {
    if (!offenders.includes(file))
      staleBaselines.push(
        `${rule.id} ${file} — sudah lolos; hapus dari baseline di scripts/check-screens.mjs`,
      )
  }
  rule.remaining = offenders.filter((f) => baseline.has(f)).length
}

// ------------------------------------------------------------------
// S5 — komponen UI yang tidak pernah diimpor
// ------------------------------------------------------------------

/**
 * Komponen mati bukan sekadar berat: ia adalah pekerjaan design system yang
 * sudah selesai tapi tidak sampai ke pengguna, dan ia membusuk (prop/token
 * berubah tanpa ada call site yang memaksanya ikut). Beberapa di antaranya
 * memang cadangan yang disengaja — daftar di bawah adalah kondisi saat audit,
 * dan harus mengecil, bukan bertambah.
 */
/*
 * Baseline S5 — KEPUTUSAN PRODUK (amandemen audit 2026-09-06).
 *
 * Audit sempat menghapus 38 komponen di bawah, lalu DIPULIHKAN atas
 * keputusan pemilik proyek: klaster ini memetakan
 * fitur roadmap yang adapter backend-nya sudah ada (captcha di lib/api/auth,
 * pemilihan metode 2FA, tanda tangan bukti terima, UI panggilan sengketa,
 * dsb.) dan ingin dipertahankan sebagai cadangan yang terjaga. Empat
 * komponen kaskade (collapse, currency-range-field, layout, range-slider)
 * tidak masuk daftar: setelah klaster dipulihkan mereka TERPAKAI kembali
 * (accordion, filter-sheet-content, live-region) — jadi resmi keluar dari
 * status cadangan.
 *
 * Konsekuensi yang harus dipahami pemelihara berikutnya:
 *   - Komponen di baseline ini TIDAK diuji oleh layar mana pun. Saat token,
 *     prop, atau aturan design system berubah, TIDAK ADA yang memaksa
 *     berkas-berkas ini ikut berubah — mereka pasti menyimpang perlahan.
 *     Sebelum memakai salah satunya, baca ulang dan adaptasi ke design
 *     system terkini, lalu HAPUS dari baseline di saat yang sama.
 *   - Baseline hanya boleh menyusut. Komponen baru yang tidak pernah
 *     diimpor TETAP langsung gagal (tidak masuk daftar ini diam-diam).
 *   - Baseline basi (komponen akhirnya dipakai) juga gagal — hapus namanya.
 */
const UNUSED_UI_BASELINE = new Set([
  "components/ui/accordion.tsx",
  "components/ui/banner.tsx",
  "components/ui/biometric-prompt-trigger.tsx",
  "components/ui/box.tsx",
  "components/ui/bullet-list.tsx",
  "components/ui/captcha-field.tsx",
  "components/ui/checkbox-group.tsx",
  "components/ui/count-badge.tsx",
  "components/ui/data-table.tsx",
  "components/ui/dispute-evidence-item.tsx",
  "components/ui/filter-sheet-content.tsx",
  "components/ui/in-call-controls-bar.tsx",
  "components/ui/incoming-call-prompt.tsx",
  "components/ui/kyc-document-viewer.tsx",
  "components/ui/menu-list.tsx",
  "components/ui/order-summary-strip.tsx",
  "components/ui/presence.tsx",
  "components/ui/result-state.tsx",
  "components/ui/search-overlay.tsx",
  "components/ui/sensitive-text.tsx",
  "components/ui/show.tsx",
  "components/ui/signature-pad.tsx",
  "components/ui/slider.tsx",
  "components/ui/surface.tsx",
  "components/ui/swipeable-list-item.tsx",
  "components/ui/tag-input.tsx",
  "components/ui/tooltip.tsx",
  "components/ui/two-factor-method-selector.tsx",
  "components/ui/typography.tsx",
  "components/ui/z-stack.tsx",
])
const unusedUi = []
for (const component of uiComponents) {
  const name = component.replace(/^components\/ui\//, "").replace(/\.tsx$/, "")
  const importRe = new RegExp(`["'](?:@/components/ui|\\.)/${name}["']`)
  const used = allSources.some((f) => f.path !== component && importRe.test(f.src))
  if (!used) unusedUi.push(component)
}
for (const component of unusedUi) {
  if (!UNUSED_UI_BASELINE.has(component))
    failures.push(`S5 ${component} — komponen UI tidak pernah diimpor di mana pun`)
}
for (const component of UNUSED_UI_BASELINE) {
  if (!unusedUi.includes(component))
    staleBaselines.push(
      `S5 ${component} — sudah dipakai; hapus dari UNUSED_UI_BASELINE di scripts/check-screens.mjs`,
    )
}

// ------------------------------------------------------------------
// Laporan
// ------------------------------------------------------------------

console.log(`check-screens: ${screens.length} layar, ${uiComponents.length} komponen UI dipindai`)
for (const rule of rules) {
  console.log(`  ${rule.id}  sisa ${String(rule.remaining).padStart(2)} — ${rule.title}`)
}
console.log(
  `  S5  sisa ${String(unusedUi.length).padStart(2)} — komponen UI tanpa satu pun pemakaian`,
)

if (staleBaselines.length) {
  console.error("\ncheck-screens: baseline basi (pemeriksaan harus mengetat):")
  for (const message of staleBaselines) console.error(`  ${message}`)
}
if (failures.length) {
  console.error("\ncheck-screens: pelanggaran BARU:")
  for (const message of failures) console.error(`  ${message}`)
}
if (failures.length || staleBaselines.length) process.exit(1)
console.log("check-screens: OK")
