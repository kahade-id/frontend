/**
 * Kahade — kamus Indonesia → English (induk).
 *
 * Bentuknya JSON per area layar, BUKAN satu file TS raksasa atau tabel kunci
 * simbolik. Alasannya (non-obvious, dan ini keputusan inti i18n repo ini):
 *
 *  - KUNCI = string Indonesia yang ada di kode. Menambah teks UI baru tidak
 *    pernah bisa "lupa daftar kunci": kalau belum diterjemahkan, yang tampil
 *    adalah teks sumbernya (Indonesia), bukan `settings.title` atau layar kosong.
 *  - JSON bisa dibaca Node, Metro, DAN `scripts/check-i18n.mjs` tanpa
 *    transpile, jadi pemeriksaan cakupan bisa jalan di CI seperti check lain.
 *  - Dipecah per area (auth, tabs, ui, labels, screens-*) supaya satu layar
 *    bisa diterjemahkan tuntas dalam satu review — campuran separuh Inggris
 *    di satu kartu adalah hasil yang paling jelek.
 *
 * Aturan isi:
 *  - Satu kunci per string; file `area-*` hasil `npm run gen:i18n --areas`
 *    adalah daftar kerja. Kunci yang tidak ada di katalog = string sudah
 *    berubah di kode → `check:i18n` gagal (bukan runtime yang menanggung).
 *  - `{x}` = tempat nilai runtime disisipkan; jumlah dan urutannya harus sama
 *    dengan kunci (lib/i18n/shape.ts).
 *  - Jangan memakai apostrof lurus di tengah kalimat? Boleh — JSON bukan JSX.
 *    Yang tidak boleh: newline literal (pakai spasi; teks UI di-layout ulang
 *    oleh <Text>, tidak ada hard-wrap).
 *
 * Nilai yang identik dengan kunci (mis. "WhatsApp") sengaja TIDAK ditulis —
 * kamus tidak boleh membengkak oleh entri no-op; fallback sudah benar.
 */
import auth from "./auth.json"
import labels from "./labels.json"
import screens1 from "./screens-1.json"
import screens2 from "./screens-2.json"
import screens3 from "./screens-3.json"
import screens4 from "./screens-4.json"
import screens5 from "./screens-5.json"
import screens6 from "./screens-6.json"
import tabs from "./tabs.json"
import ui from "./ui.json"

export type Dict = Record<string, string>

/**
 * Urutan spread tidak menentukan apa pun di sini (kunci ganda antar file
 * ditolak `check:i18n` + test), tapi urutannya sengaja mengikuti ukuran area
 * supaya diff mudah dibaca.
 */
export const EN: Dict = {
  ...labels,
  ...auth,
  ...tabs,
  ...ui,
  ...screens1,
  ...screens2,
  ...screens3,
  ...screens4,
  ...screens5,
  ...screens6,
}
