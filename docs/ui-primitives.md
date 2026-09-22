# Primitif tata letak — mana yang kanonik

Latar belakang: audit H-13 menemukan enam primitif (`Box`, `Surface`, `ZStack`,
`Presence`, `show`, plus `HStack`/`Spacer`) yang tersedia tetapi **tidak dipakai
satu komponen pun**. Tanpa aturan tertulis, pembaca kode baru tidak tahu mana
yang seharusnya dipakai, dan setiap penambahan kecil berpotensi menambah "cara
ke-7" menata letak.

## Aturan

1. **Default: `<View className>` + token.** 235 komponen di `components/ui`
   memakai jalur ini. Kalau hanya perlu flex/gap/padding sekali pakai, tulis
   className — jangan membuat primitif baru.
2. **Spacing berulang → `Stack`/`HStack`.** `Stack` (12 pemakaian) memberi
   jarak dari skala `space` dan tetap bisa dikombinasikan dengan className.
   `HStack` dipertahankan sebagai alias; jangan menambah pemakaian baru sebelum
   ada kebutuhan nyata.
3. **Kotak ber-token → `Box`/`Surface` (escape hatch, saat ini 0 pemakaian).**
   Keduanya HANYA menerima nilai token (`p={5}` = 20px, `rounded="md"` = 8px),
   jadi mustahil melanggar sistem. Dipakai bila sebuah komponen butuh kotak
   yang diparameterkan lewat props (bukan className) — mis. komponen yang
   menerima `padding` sebagai prop. **Jangan** memakainya untuk tata letak
   sekali pakai (aturan 1).
4. **`ZStack`/`Presence`/`show` — dormant.** Tidak ada pemakainya dan tidak ada
   rencana pemakaian jangka pendek. Statusnya: dipertahankan (keputusan produk:
   baseline komponen UI tidak dihapus, diuji lewat
   `tests/unused-ui-baseline.test.tsx`) tetapi **jangan dipakai untuk kode
   baru**. Kalau kamu memang butuh (mis. animasi mount/unmount bertingkat tanpa
   Reanimated), tambahkan alasannya di dokumen ini lebih dulu.
5. **`ToastItem` internal.** Presentasi satu toast sengaja TIDAK diekspor
   (audit H-14): repo ini tidak punya infrastruktur story, jadi ekspor itu
   hanya janji kosong. Story/preview kalau nanti ada dibuat lewat
   `ToastProvider` + `useToast()`.

## Status pemakaian (dijaga `check:screens` S5)

| Primitif | Pemakai di `app/components/lib` | Catatan |
|---|---|---|
| `<View className>` | 235+ berkas | kanonik |
| `Stack` | 12 | kanonik untuk spacing berulang |
| `Box`, `Surface`, `ZStack`, `Presence`, `show`, `HStack`, `Spacer` | 0 | dormant — lihat aturan 3 & 4 |

Gate S5 menghitung pemakaian HANYA dari sumber produk (bukan test), supaya
komponen yang diuji tanpa dipakai tetap terlihat sebagai belum dipakai — itulah
yang membuat tabel di atas tidak bisa "menghijau" sendiri.
