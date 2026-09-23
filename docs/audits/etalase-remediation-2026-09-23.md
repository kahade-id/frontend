# Ledger remediasi Etalase — E01–E70

Tanggal: 23 September 2026. Branch: `arena/01a0cd3e-frontend`.

## Status yang dapat dipertanggungjawabkan

**61 butir memiliki perubahan frontend yang diterapkan; 9 butir masih parsial/terbuka. Ini bukan klaim 61 sudah terbukti selesai end-to-end, dan bukan klaim semua 70 sudah ditutup.** `FE` berarti perubahan kode tersedia dan masuk quality gate lokal; tidak berarti seluruh acceptance per butir sudah diuji pada backend/browser/perangkat. `Parsial` berarti ada gap fungsional atau coverage yang diketahui. Semua verifikasi eksternal yang belum dilakukan tetap disebutkan.

### Verifikasi aktual pada patch ini

- `npm run check`: **lolos** seluruh rangkaian typecheck, lint, token/class/a11y/screen/inventory/spec/API/link/time/push/permissions/i18n dan tests.
- Unit/API/helpers: **417 tes lulus, 32 berkas**.
- Component/hooks: **135 tes lulus, 15 berkas**.
- Total: **552 tes lulus**, termasuk 56 tes tambahan dibanding baseline 496.
- `npm run build:web`: **lolos**, 113 static routes. Web push tidak dikonfigurasi pada environment build ini.
- Katalog i18n: **1956/1956** terjemahan tersedia.
- `git diff --check`: lolos. Plafon baris screen hanya **diturunkan**, bukan dilonggarkan; inset scroll profil dibagi dengan DataScreen.
- Browser: instalasi Chromium gagal lima kali `ECONNRESET` dari CDN Playwright. **Tidak ada hasil Playwright yang diklaim lulus.**
- Tidak melakukan mutasi terhadap konten nyata, tidak menjalankan API staging ber-auth, tidak menguji perangkat fisik.
- Warnings nonfatal tetap ada: delapan warning API inventory serta warning dependency/Vite/RN-web; pass gate tidak berarti warning hilang.

## Per butir

| ID | Status | Perubahan, bukti, dan batasan |
|---|---|---|
| E01 | FE | Patch hanya target; root/reply lain dipertahankan, lalu rekonsiliasi server. `showcase-state`, detail, regression tests. |
| E02 | FE | Bacaan publik memakai auth optional, mempertahankan bearer viewer tanpa memaksa tamu login. Transport dan adapter tests. |
| E03 | FE | Reset sosial/cache saat revisi sesi; bookmark ber-owner; layar manajemen di-remount per sesi. Regression/operation tests. |
| E04 | FE | Override suka direkonsiliasi dengan hasil server, tidak lagi permanen menimpa refresh. Social actions. |
| E05 | FE | Lock mutasi bersama per item lintas instance kartu. `showcase-state` + regression tests. |
| E06 | FE | Konflik suka mengambil detail kanonik, bukan rollback buta. Social actions. |
| E07 | FE | Bookmark lokal dipersist dengan owner, maksimum 25, dibersihkan saat logout. Bukan sinkronisasi antarperangkat; kegagalan storage hanya tercatat di telemetry. |
| E08 | FE | Koleksi Etalase di halaman Tersimpan; item tak tersedia dapat dicoba lagi/dihapus dari koleksi. |
| E09 | FE | Following tamu selesai pada CTA login tanpa fetch berulang. Actual feed lifecycle test. |
| E10 | FE | Keanggotaan following dibaca seluruh halaman, tanpa batas diam-diam 200; respons berulang tanpa kemajuan ditolak. |
| E11 | FE | Cache keanggotaan following diinvalidasi saat kembali fokus dan perubahan sesi. |
| E12 | FE | Revisi sesi masuk lifecycle/key feed; respons sesi lama dibuang. Lifecycle tests. |
| E13 | FE | Halaman following kosong tetapi belum selesai mempunyai jalur lanjut mencari, bukan final empty state. |
| E14 | FE | Commit kursor dan hasil bersama; sumber yang gagal tidak menggeser kursor. Lifecycle test kegagalan parsial. |
| E15 | FE | Single-flight dan generasi request mengecualikan load-more ketika refresh/filter berganti; PaginatedList juga menjaga overlap. |
| E16 | FE | Data filter lama dibersihkan pada perubahan identitas query; late response diabaikan. |
| E17 | FE | allSettled mempertahankan sumber feed yang berhasil, dengan error parsial dan retry sumber gagal. |
| E18 | FE | Panjang search/category mengikuti batas kontrak; API fixture tests memeriksa 100/60 karakter. |
| E19 | FE | Kind/search/category disinkronkan ke parameter URL agar bisa dipulihkan/dibagikan. |
| E20 | FE | Refresh berhasil membersihkan error load-more lama. |
| E21 | FE | Sheet memakai ticket, identitas item, revisi sesi dan abort. Tes aktual membuktikan respons A tidak masuk B. |
| E22 | FE | Composer terkunci selama submit; draft baru tidak terhapus oleh respons lama. Actual sheet test. |
| E23 | FE | Lock submit sinkron juga melindungi jalur Enter detail. Hook operasi diuji; handler layar detail belum diuji lengkap. |
| E24 | FE | Retry mengulang halaman yang gagal, bukan menaikkan nomor terlebih dahulu. |
| E25 | FE | Merge komentar/reply berbasis ID, bukan concat offset buta. Regression tests. |
| E26 | FE | Fetch/mutasi difence; rekonsiliasi ulang seluruh halaman yang sudah dimuat setelah mutasi. |
| E27 | FE | Dirty version setelah mutasi menyegarkan feed, profil dan galeri saat fokus. Hook profil memiliki abort sendiri. |
| E28 | FE | Error refresh detail tidak lagi tersembunyi di balik data lama; tampilan fail-closed. |
| E29 | FE | Identitas query dan operasi komentar mengikuti revisi sesi, bukan snapshot mount pertama. |
| E30 | FE | Report mempunyai gerbang login dan return URL item; request tamu tidak dikirim. |
| E31 | FE | Report memakai identitas/ticket; respons lama tidak menutup report baru. |
| E32 | Parsial | Label diubah menjadi laporan pengguna sesuai endpoint yang tersedia. Pelaporan entitas komentar/karya beserta konteks spesifik masih memerlukan kontrak report yang mendukungnya. |
| E33 | Parsial | Description/category kosong dikirim eksplisit; harga 0 valid. Clear harga lama sengaja diblokir dengan penjelasan sampai kontrak nullable/reset harga tersedia. |
| E34 | FE | Harga null dibedakan dari 0; rentang terbalik tidak ditampilkan sebagai rentang valid. Regression tests. |
| E35 | FE | Picker berada di dalam try/catch/finally; lock pulih ketika picker gagal. |
| E36 | FE | Picker memvalidasi batas pilihan setelah hasil dikembalikan, bukan hanya mengandalkan UI platform. |
| E37 | FE | Abort upload pada unmount/sesi, cleanup key staged, lock sinkron; media yang mungkin sudah commit tidak dihapus secara destruktif. Rekonsiliasi/orphan GC backend tetap diperlukan. |
| E38 | FE | Fallback legacy auto-publish dihapus; multipilih hanya melalui pipeline upload-only lalu create eksplisit. |
| E39 | FE | Tidak ada lagi publish-then-hide legacy. Visibility ikut create; otorisasi dan enforcement server tetap wajib. |
| E40 | FE | Attach tidak dapat masuk fallback pembuat item otomatis. |
| E41 | FE | Tidak ada fallback luas lintas tahap PUT/confirm; kegagalan pipeline diteruskan dengan penanganan cleanup. |
| E42 | FE | Key presigned tetap tersedia untuk kompensasi bila PUT/confirm gagal; cleanup dibagi batch 20. Upload tests. |
| E43 | FE | Progres per foto, kegagalan dipertahankan, retry hanya file gagal, keberhasilan batch tetap tersedia. |
| E44 | FE | Preview draft, remove/reorder dan penetapan foto pertama sebagai cover sebelum create. |
| E45 | FE | Dialog discard editor, prevent-remove navigasi, beforeunload web; lifecycle native perlu QA perangkat. |
| E46 | FE | Reorder harus permutasi tepat himpunan ID server; draft invalid tidak dikirim. Regression tests. |
| E47 | FE | Draft/order sheet dipertahankan saat request gagal; tutup ulang melakukan retry. Mutasi punya lock sinkron/fence sesi. |
| E48 | FE | Label aktivasi dibedakan dari PUBLIC/PRIVATE; toast menjelaskan bahwa aktivasi tidak mengubah privasi. |
| E49 | FE | Count tersembunyi dan badge memakai predicate yang sama: inactive atau PRIVATE. |
| E50 | FE | Budget render direset per username; galeri/session scroller di-key ulang. |
| E51 | FE | Label tambahan tidak lagi menjanjikan jumlah melebihi batch yang dibuka. |
| E52 | Parsial | Budget render awal/bertahap ditambahkan. Belum virtualized grid dan belum benchmark 100/500/1000 item di perangkat target; bukan penutupan temuan. |
| E53 | FE | Parser entity sosial/comments menolak identitas rusak, menormalisasi images/count, memvalidasi cursor. Regression + API contract tests. |
| E54 | FE | Adapter sosial meng-encode segmen path. API tests termasuk ID berisi slash/query. |
| E55 | FE | Detail memakai fallback cover ketika images kosong. |
| E56 | FE | Gallery tidak lagi membuka konten hanya saat momentum-end; halaman memakai scroll/layout dan gambar tersedia saat dipilih. Perlu QA gesture nyata. |
| E57 | FE | Index/offset direkonsiliasi ketika signature foto atau lebar berubah. Rotasi/resize perangkat belum diverifikasi langsung. |
| E58 | FE | Kontrol sebelumnya/berikutnya, label posisi dan aksesibilitas eksplisit; belum audit screen reader perangkat. |
| E59 | FE | Judul detail tidak lagi dibatasi dua baris. |
| E60 | FE | Login CTA membawa next ke karya/feed terkait. Fixture browser ditulis tetapi belum dijalankan. |
| E61 | FE | Alasan moderasi ditampilkan lewat label manusiawi, bukan enum mentah. |
| E62 | FE | Share menggunakan URL kanonik sebagai fallback tanpa ketergantungan wajib metadata. |
| E63 | FE | Web Share dipanggil dari gesture, tidak menunggu metadata API terlebih dahulu. Verifikasi Safari/perangkat masih diperlukan. |
| E64 | Parsial | Belum ada HTML OG/title/description per item untuk crawler non-JS. Export statis tidak menyelesaikan ini; perlu renderer/edge yang mengambil hanya data publik. |
| E65 | Parsial | Tes lifecycle actual feed dan comments sheet, hook operasi, regression helpers tersedia. Handler detail/manajemen dan lifecycle profil belum memiliki coverage komponen lengkap. |
| E66 | Parsial | Fixture adapter/transport/upload ditambahkan. Matriks kontrak backend live, legacy/deployment dan seluruh mutasi belum lengkap. |
| E67 | Parsial | Tiga fixture-driven browser journeys ditambahkan. Chromium gagal diunduh (ECONNRESET); belum dieksekusi. Alur ber-auth create/edit/like/delete E2E belum lengkap. |
| E68 | FE | Cleanup gagal menghasilkan telemetry teredaksi tanpa fileKey/signed URL mentah. Perlu memastikan pipeline monitoring deployment benar-benar menerima event. |
| E69 | Parsial | Frontend galeri memakai optional auth, tetapi perbedaan kebijakan OpenAPI/deployment belum diselesaikan dengan pemilik backend; tidak mengubah spec untuk menutupi mismatch. |
| E70 | Parsial | Retry otomatis detail yang menghitung view dinonaktifkan dan cache/revalidation dibatasi. Dedup view lintas mount/client tetap perlu kontrak/idempotensi server. |

## Risiko penting yang belum boleh disamarkan

1. **Create/attach timeout ambigu:** create menyimpan DTO immutable dan idempotency key yang sama selama retry editor; attach yang sudah dikirim tidak diikuti penghapusan media buta. Backend harus menjamin idempotency, menyediakan rekonsiliasi, dan membersihkan orphan. Menutup editor pada status ambigu belum memiliki recovery journal lintas restart.
2. **Harga nullable (E33):** sekarang tidak berpura-pura sukses saat pengguna mencoba clear harga. Diperlukan kontrak reset/nullable untuk menyelesaikan kebutuhan tersebut.
3. **Reports (E32):** laporan pengguna bukan pengganti penuh laporan komentar dengan konteks. Penyelesaian memerlukan dukungan target/konteks server.
4. **Skala (E52):** render bertahap mengurangi pekerjaan awal, bukan virtualisasi; array lengkap masih dapat datang dari backend.
5. **SEO (E64), public-gallery policy (E69), view dedup (E70):** belum tuntas di repository frontend ini saja.
6. **Coverage (E65–E67):** tambahkan pengujian actual detail/manajemen serta E2E ber-auth dengan API fixture/staging. Jalankan gagal jaringan, timeout setelah commit, respons terbalik, account switch, hardware back, iOS Safari share, carousel resize, dan screen reader.
7. **Bookmark:** sengaja lokal/per akun, maksimum 25, dihapus saat logout. Tidak ada sinkronisasi antarperangkat. Storage failure tercatat tetapi belum ada status durability tersendiri di UI.

## Rujukan pengujian dan dokumentasi

- `tests/showcase-regressions.test.ts`: komentar, harga, order, parser, social state, lock, share.
- `tests/showcase-upload.test.ts`: presign/PUT/confirm, cancel, cleanup failure, batch cleanup, tanpa legacy auto-publish.
- `tests/showcase-api-contract.test.ts` dan tambahan `tests/api-client.test.ts`: auth optional, path encoding, cursor/entity, batas query.
- `tests/showcase-operation.test.tsx`: ticket, synchronous exclusion, sesi/identitas/unmount.
- `tests/showcase-feed-lifecycle.test.tsx`: actual feed component, termasuk guest following dan partial-source failure.
- `tests/showcase-comments-lifecycle.test.tsx`: actual sheet, late A→B, duplicate submit, guest CTA.
- `e2e/showcase.spec.ts`: smoke lama + tiga fixture journeys baru, **belum dieksekusi**.
- [Audit awal](etalase-deep-audit-2026-09-23.md) adalah snapshot sebelum perbaikan. `etalase-probes.mjs` berisi karakterisasi defect historis, bukan regression gate kode terkini; default execution dinonaktifkan dengan pesan yang menjelaskan penggantinya.
