# #8 Layar di `app/` + #9 Komponen di luar `components/ui`

Dikerjakan bersama karena cakupan keduanya ternyata sangat kecil dan
saling terkait (boot sequence: `app/_layout.tsx` → `theme-provider` →
`animated-splash`).

## Cakupan aktual

| Area | File | Catatan |
|---|---|---|
| `app/` | `app/_layout.tsx` | Satu-satunya file. Ini **layout**, bukan screen — belum ada route screen di repo. |
| `components/` non-`ui` | `components/theme-provider.tsx` | Infrastruktur (context + `vars()`). |
| `lib/` | 14 file `.ts` | Utilitas non-visual; hanya `tokens.ts` menyimpan warna (memang sumbernya). |
| `StyleSheet.create` | `components/ui/animated-splash.tsx` | Satu-satunya di seluruh repo. |

## Hasil skrip deteksi (#8 & #9, semua path)

| Pemeriksaan | Kasus |
|---|---|
| Hex literal | 0 |
| Class warna literal (`bg-white`, `text-gray-*`, …) | 0 |
| `Text`/`TouchableOpacity`/`TextInput` RN mentah | 0 |
| `<Pressable>`/`<TouchableOpacity>` tanpa role | 0 |
| `tone="tertiary"` di `app/` | 0 |
| `StyleSheet.create` dengan literal | 0 — objek style di `animated-splash` seluruhnya dari `tokens.*` (background, surface, primary, radius.md, borderWidth.default, zIndex.banner). Ini pengecualian yang **disengaja & terdokumentasi** di header file: overlay render sebelum `ThemeProvider` mount sehingga `vars()`/className belum tersedia. |

Checklist a11y layar (Heading h1, ScrollView, SafeArea, back berlabel)
**tidak berlaku** untuk `_layout.tsx` karena tidak ada screen. Checklist
ini tetap harus dijalankan saat route screen pertama ditambahkan —
ditandai di BACKLOG sebagai syarat definisi selesai #8 ke depan.

## Temuan yang diperbaiki

**Kontrak splash tidak nyata.** `app/_layout.tsx` dan `animated-splash.tsx`
sama-sama berkomentar "harus SAMA dengan `backgroundColor` splash di
`app.json`", tetapi `app.json` **tidak punya konfigurasi splash** — plugin
`expo-splash-screen` terdaftar tanpa opsi. Kesamaan warna hanya kebetulan
(default native = putih = `light.background`). Kalau `light.background`
diganti (mis. ke off-white), handoff native→JS akan kedip tanpa ada yang
memperingatkan.

Perbaikan:
1. `app.json`: `["expo-splash-screen", { backgroundColor: "#FFFFFF", resizeMode: "contain" }]` — eksplisit.
2. `scripts/check-tokens.mjs` pemeriksaan #8 (baru): `splash.backgroundColor == light.background`,
   `splash.dark.backgroundColor == dark.background` (bila diisi), dan
   `expo-notifications.color == light.primary`. Konfigurasi native tidak bisa
   `import tokens.ts`, jadi ini satu-satunya cara menjaga literalnya sinkron.
   Diuji mutasi: mengubah salah satu warna → FAIL.
3. Komentar di `animated-splash.tsx` diperbarui merujuk ke pemeriksaan mesin.

## Keputusan yang perlu konfirmasi tim

- ~~**Splash dark mode.**~~ **Ditutup di #13** (`findings/13-dark-mode.md`):
  `dark.backgroundColor` ditambahkan ke `app.json` (kini wajib di checker)
  dan `<AnimatedSplash>` membaca `useColorScheme()` react-native.
- **Gambar splash.** Belum ada aset logo; `resizeMode: contain` tidak
  berefek sampai `image` ditambahkan. Placeholder di `<AnimatedSplash>`
  juga masih kotak — sinkronkan keduanya saat logo tersedia.
- **Cakupan #8 ke depan.** Karena `app/` baru berisi layout, definisi
  selesai #8 saat ini adalah "bersih + guard tersedia". Setiap PR yang
  menambah route screen wajib menjalankan skrip deteksi #8 dan checklist
  a11y layar di BACKLOG §8.
