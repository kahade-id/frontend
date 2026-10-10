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
// chat-room (audit chat 2026-10): string baru dari perbaikan ruang chat —
// satu berkas per batch terjemahan supaya bisa ditinjau tuntas.
import chatRoom from "./chat-room.json"
import errors from "./errors.json"
import labels from "./labels.json"
// profile (redesign Profil & Tanya Jawab): satu berkas per batch.
import profile from "./profile.json"
import remediation from "./remediation.json"
// story (fitur Story): satu berkas untuk seluruh string tray, viewer, kreator, dan kelola.
import story from "./story.json"
import screens1 from "./screens-1.json"
import screens2 from "./screens-2.json"
import screens3 from "./screens-3.json"
import screens4 from "./screens-4.json"
import screens5 from "./screens-5.json"
import screens6 from "./screens-6.json"
import screens7 from "./screens-7.json"
// screens-8 (audit G-01): kalimat yang dulu dirakit dari template literal +
// potongan bersyarat (transfer/withdraw/langganan, dialog sesi, dan label
// komponen) — satu berkas per batch terjemahan supaya bisa ditinjau tuntas.
import screens8 from "./screens-8.json"
// screens-9 (audit 2026-09-24, Q-02/Q-03/Q-04): string yang dulu LUMPUH di
// pemindai katalog — children ekspresi JSX, kalimat ber-`;`, dan argumen
// `setFormError()` — plus 9 kunci Etalase yang memang belum pernah ada.
import screens9 from "./screens-9.json"
// screens-10 (audit UI/UX 2026-09-28, TEXT-004): sisa string Indonesia yang
// belum punya padanan English — satu berkas per batch terjemahan.
import screens10 from "./screens-10.json"
// screens-11 (audit Pengaturan & Bantuan 2026-10-10): Pusat Bantuan, Tentang,
// Tampilan, Privasi, Umpan Balik, Tiket, Versi Aplikasi, Biometrik.
import screens11 from "./screens-11.json"
// screens-12 (audit Pengaturan & Bantuan 2026-10-10, batch 2): label log
// keamanan/aktivitas (enum UserAuditAction), kredensial, privasi, hapus akun.
import screens12 from "./screens-12.json"
// screens-13 (audit Pengaturan & Bantuan 2026-10-10, batch 3): sisa string
// layar Keamanan/Privasi/Notifikasi/Bantuan/Chat + label komponen bawaan.
import screens13 from "./screens-13.json"
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
  ...remediation,
  ...story,
  ...screens1,
  ...screens2,
  ...screens3,
  ...screens4,
  ...screens5,
  ...screens6,
  ...screens7,
  ...screens8,
  ...screens9,
  ...screens10,
  ...screens11,
  ...screens12,
  ...screens13,
  ...chatRoom,
  ...profile,
  // Pesan error & label status dari peta di lib/ — yang paling sering muncul
  // saat jaringan bermasalah, jadi jangan sampai jatuh ke Bahasa Indonesia.
  ...errors,
}

// FE-072: side-effect registration — test/alat yang mengimpor `./en` langsung
// mendapat kamus terdaftar secara sinkron; graph boot produksi TIDAK menarik
// modul ini (kamus dimuat lewat `ensureDictionary` di dictionaries.ts).
import { registerDictionary } from "../dictionaries"
registerDictionary("en", EN)
