# Offline — Fase 2: cache-first dan persistensi

## Perilaku

- `useApiQuery` membaca cache memori, lalu snapshot persisten sebelum GET. Hit stale langsung ditampilkan; saat online hook menyegarkannya di latar tanpa menghapus data lama.
- `usePaginatedQuery` menerapkan alur yang sama untuk halaman pertama daftar. Pull-to-refresh tetap menembus cache.
- Saat offline, hook tidak memulai GET. Cache stale tetap tampil; miss menjadi placeholder netral “Anda sedang offline”, tanpa `ErrorState`. Saat koneksi pulih, query dimuat ulang otomatis.
- Banner offline menjelaskan bahwa data tersimpan mungkin belum terbaru.

## Persistensi dan isolasi

- Native: snapshot JSON berversi di `Paths.cache` milik `expo-file-system`; penulisan berseri dan best-effort agar kegagalan filesystem tidak mengganggu request/cache memori.
- Snapshot dibatasi 200 entri, sekitar 2 MB, maksimal 30 hari. Respons terlalu besar dilewati. OS dapat mengosongkan direktori cache; cache bukan sumber kebenaran.
- Kunci ruang lingkup acak berada di SecureStore dan dirotasi/dihapus bersama sesi. Respons tidak dipersistenkan tanpa sesi terautentikasi. Saat akun berganti, pembacaan hanya memakai ruang lingkup aktif dan penulisan baru memangkas ruang lingkup lama.
- Web tetap memory-only: allowlist secure-storage melarang payload API arbitrer disimpan sebagai teks di `localStorage`.
- Invalidasi key, prefix, invalidasi penuh, dan logout membersihkan snapshot yang sesuai. Cache lama tidak dipakai sebagai sumber kebenaran; mutasi tetap menginvalidasi data terkait.

## Verifikasi

- `tests/query-cache-persistence.test.ts`: pemulihan setelah restart modul, pembatasan tanpa sesi, isolasi akun, write-through, invalidasi prefix/logout.
- `tests/query-cache-hooks.test.tsx` dan `tests/hooks.test.tsx`: cache disk tampil offline, SWR mempertahankan data lama, offline miss netral, refresh otomatis saat online.
- `tests/offline-static-screens.test.tsx`: placeholder layar data offline tanpa error state.
