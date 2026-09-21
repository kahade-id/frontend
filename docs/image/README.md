# docs/image — aset desain non-produksi

Menjawab temuan audit **I-11**: folder ini berisi artefak biner mockup yang
ter-commit tanpa penjelasan. Kebijakan mulai 2026-09-21:

- Folder ini HANYA untuk referensi desain berukuran kecil (< 500 KB/file)
  yang perlu dilihat bersebelahan dengan kode (mis. mockup satu layar).
- Aset besar (video, PSD, ekspor lengkap, foto perangkat) TIDAK masuk git —
  simpan di drive tim/wiki dan tautkan URL-nya di dokumen terkait.
- Setiap file di sini wajib disebut di README ini dengan asal & kegunaannya.

| File | Asal | Kegunaan |
| ---- | ---- | -------- |
| `IMG_20260917_224056_353.jpg` (156 KB) | foto mockup UI dari perangkat, 17 Sep 2026 | referensi visual saat audit redesign v2 (`docs/redesign-v2.md`) |
| `.dummy` | placeholder 1 byte | menjaga folder tetap ada di git saat isinya kosong; boleh dihapus bila tabel di atas tidak kosong |
