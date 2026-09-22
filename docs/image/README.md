# docs/image — aset desain non-produksi

Menjawab temuan audit **I-13**: folder ini berisi artefak biner mockup yang
ter-commit tanpa penjelasan. Kebijakan mulai 2026-09-21 (ditegaskan 2026-09-22):

- Folder ini HANYA untuk referensi desain berukuran kecil (< 100 KB/file)
  yang perlu dilihat bersebelahan dengan kode (mis. mockup satu layar).
- Aset besar (video, PSD, ekspor lengkap, foto perangkat beresolusi penuh)
  TIDAK masuk git — simpan di drive tim/wiki dan tautkan URL-nya di dokumen
  terkait.
- Setiap file di sini WAJIB disebut di tabel bawah dengan asal & kegunaannya.
- Placeholder `.dummy` dihapus (audit I-13): ia hanya bertahan untuk menjaga
  folder tetap ada, padahal tabel ini sudah tidak kosong.

| File | Asal | Kegunaan |
| ---- | ---- | -------- |
| `IMG_20260917_224056_353.jpg` (40 KB) | foto mockup UI dari perangkat, 17 Sep 2026; dikompres ulang 2026-09-22 (536×544, quality 72) dari sumber 156 KB | referensi visual saat audit redesign v2 (`docs/redesign-v2.md`), dipakai juga sebagai acuan pola angka kompak di `lib/format.ts` |
