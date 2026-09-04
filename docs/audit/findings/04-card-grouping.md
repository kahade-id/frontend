# Audit #4 — Grouping & urutan baca kartu

**Status:** Selesai. Dijaga otomatis oleh `pnpm check:a11y`.

## Ringkasan

Deteksi yang ditulis di BACKLOG.md (`grep -qE 'accessible|accessibilityLabel'`
pada `*-card/-item/-row`) hanya menemukan **3** file dan **melewatkan masalah
sebenarnya**. Grep itu memeriksa apakah kata `accessibilityLabel` *muncul* di
file — bukan apakah label itu benar-benar berefek.

Temuan utamanya adalah **label yang ditulis tapi diam-diam tidak berfungsi**,
dan kebalikannya, **grup yang menelan tombolnya sendiri**. Total **41 kasus**
di 34 file.

| Kelas masalah | Kasus | Dampak SR |
|---|---:|---|
| A. `<Card accessibilityLabel>` statis: prop diterima tapi tidak pernah diteruskan ke `<View>` | 12 | Label hilang total; kartu dibaca 5–8 fragmen |
| B. `<View accessibilityLabel>` tanpa `accessible` | 16 | idem |
| C. `accessible` membungkus kontrol (Button/IconButton/TextLink/Pressable) | 8 | **Kontrol HILANG dari screen reader** |
| D. `.filter(Boolean).join(", ")` manual | 12 | Tidak ada (konsistensi) |
| E. File tanpa jalur label sama sekali | 2 | Kartu dibaca per fragmen |

## Akar masalah

### 1. Bug di primitif `Card` (menjelaskan 12 dari 41 kasus)

`CardProps` mengiklankan `accessibilityLabel` lewat
`Pick<PressableScaleProps, ... | "accessibilityLabel" | ...>`, dan cabang
interaktif meneruskannya ke `<PressableScale>`. Tapi cabang **statis**
merender `<View className={...} {...rest}>` — sementara `accessibilityLabel`
sudah ter-*destructure* keluar dari `rest`. Jadi label yang ditulis 12 call
site **tidak pernah sampai ke View mana pun**, dan TypeScript tidak bisa
melihatnya karena propnya memang ada di tipe.

Ini persis pola yang diminta "Aturan umum perbaikan": diperbaiki di primitif,
bukan di 12 call site.

### 2. `accessibilityLabel` tanpa `accessible` adalah no-op di RN

React Native hanya mengelompokkan subtree bila `accessible={true}`. `<View
accessibilityLabel="...">` tanpa itu diabaikan sepenuhnya — anak-anaknya tetap
dibaca satu per satu. 16 tempat menulis label yang tidak pernah terdengar,
termasuk **13 skeleton loader** (`accessibilityLabel="Memuat ..."`) yang
akibatnya membacakan "Memuat" sekali per `<Skeleton>` — 4–6 kali per kartu.

### 3. Grouping naif justru menghapus tombol (kelas C)

Ini kebalikannya dan **lebih berbahaya**: `accessible` membuat seluruh subtree
berhenti jadi target fokus. 8 tempat sudah memakai `accessible` di wrapper yang
juga memuat aksinya, sehingga tombol "Salin", "Hapus", "Coba lagi", dan
"Bersihkan" tidak bisa dijangkau VoiceOver/TalkBack sama sekali.

Pola berulangnya: kotak "nilai + tombol salin" (nomor resi, nomor invoice, URL
order, kode voucher) — wrapper diberi `accessible` supaya nomornya dibaca
per digit, dan IconButton di sebelahnya ikut tertelan.

> **Konsekuensinya untuk kriteria lolos backlog.** BACKLOG.md menulis "Root
> kartu/list item non-interaktif punya `accessible` + `accessibilityLabel`" dan
> "Aksi sekunder di dalam kartu tetap fokusable terpisah". Untuk kartu yang
> berisi tombol, **dua syarat itu saling bertentangan** — `accessible` di root
> pasti menelan tombolnya. Yang dipakai di sini: root tidak digrup, blok
> informasinya yang digrup.

## Perbaikan

### Primitif & helper baru

| Berkas | Isi |
|---|---|
| `lib/a11y.ts` | `summarize(parts)` — merangkai fragmen label, membuang yang kosong. Menggantikan 12 `.filter(Boolean).join(", ")` yang disalin antar file. |
| `components/ui/card.tsx` | Cabang statis kini meneruskan `accessibilityLabel`/`accessibilityHint` **dan** menyetel `accessible` bila ada label. |
| `components/ui/card.tsx` | `<CardSummary>` baru — grup baca untuk blok informasi di dalam kartu yang punya aksi. |

### Aturan yang dipakai (didokumentasikan di `card.tsx`)

| Bentuk kartu | Perlakuan |
|---|---|
| Interaktif (`onPress`) | Sudah satu elemen via `PressableScale`. Cukup pastikan labelnya ringkas. |
| Statis, tanpa kontrol di dalam | `accessibilityLabel` di root `<Card>` (kini benar-benar berefek). |
| Statis, ADA kontrol di dalam | Root polos; blok teks dibungkus `<CardSummary label={summarize([...])}>`; tombol di **luar** grup. |

Kartu yang dikonversi ke `<CardSummary>`: `kyc-status-card`,
`subscription-status-card`, `two-factor-status-card`, `trust-score-card`,
`withdrawal-schedule-card`, `counterpart-validation-card`,
`mutual-resolution-card`, `order-extension-card`, `rating-review-card`,
`topup-status-card`.

Wrapper "nilai + tombol salin" (kelas C) diperbaiki dengan memindahkan label ke
`<Text>` nilainya, bukan ke wrapper — nomor tetap dibaca per digit, tombol
salin tetap fokusable: `delivery-proof-viewer`, `invoice-receipt-view`,
`order-link-share-card`, `voucher-redeem-box`, `chat-attachment-item`,
`qa-comment-item`, `signature-pad`.

### Guard otomatis: `pnpm check:a11y`

`scripts/check-a11y.mjs` (pola sama dengan `check:tokens`) memeriksa:

1. `<View accessibilityLabel>` wajib punya `accessible` — kecuali terdaftar di
   `CONTAINER_LABEL_ALLOWLIST` beserta alasannya.
2. `accessible` / `<CardSummary>` tidak boleh membungkus komponen interaktif.
3. Kartu & list item punya jalur label ringkas.
4. (warn) `.filter(Boolean).join(", ")` manual → pakai `summarize()`.

Tambahkan ke CI bersama `pnpm typecheck` dan `pnpm check:tokens`.

## Pengecualian yang disengaja

`CONTAINER_LABEL_ALLOWLIST` berisi 15 komponen yang punya label kontainer
**tanpa** `accessible`, karena isinya sudah fokusable sendiri dan `accessible`
akan menelannya. Labelnya memang tidak dibacakan sebagai grup; konteks datang
dari `accessibilityRole` (`adjustable` / `progressbar` / `timer`) plus
`accessibilityValue`. Contoh: `rating` (5 bintang PressableScale), `pin-pad`
(12 tombol), `page-indicator`, `progress-bar`, `bar-chart`.

`notification-preferences-matrix` justru **kehilangan** `accessibilityLabel`
kontainernya: label itu tidak pernah dibacakan (tidak ada `accessible`) dan
menambahkannya akan menelan matriks Switch. Konteks kategori sudah ada di label
tiap Switch (`"<kategori>, <kanal>"`).

## Perlu konfirmasi tim

1. **Urutan baca `trust-score-card`.** Blok skor kini satu elemen, tapi rincian
   faktor tetap terpisah (masing-masing sudah `accessible` + label sendiri) agar
   tidak menghasilkan satu label sepanjang ~200 karakter. Kalau tim ingin satu
   napas penuh, gabungkan `factors` ke label ringkasan.
2. **`SignaturePadLabels.signed` (string baru).** Kanvas kosong membaca
   `hint`; setelah ada goresan membaca `"Tanda tangan sudah diisi"`. Perlu
   di-review penerjemah.
3. **`QACardProps.labels` kini `Partial<typeof DEFAULT_LABELS>`** dan bertambah
   `askedBy`/`answeredBy` (fungsi). Perubahan tipe yang kompatibel untuk
   pemanggil lama, tapi bentuknya berubah dari object literal eksplisit.

## Catatan untuk #8 (layar `app/`)

`check:a11y` sudah memindai `app/` juga (saat ini 0 temuan karena belum ada
route screen). Saat screen pertama ditambahkan, skrip ini langsung berlaku
tanpa perubahan.
