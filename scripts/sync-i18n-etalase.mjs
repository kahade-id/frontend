/**
 * Sinkronisasi kamus EN setelah redo string Etalase (audit 2026-09-23):
 *  1. Buang kunci EN yang tidak ada lagi di katalog (kunci mati — gate
 *     tests/i18n.test.ts "EN tidak berisi kunci yang tidak dipakai app").
 *  2. Tambahkan terjemahan untuk string Etalase baru (J-02/J-03) ke
 *     remediation.json — hanya bila kunci belum dipunyai file lain
 *     (larangan kunci dobel lintas file).
 * Idempoten: menjalankan dua kali = tidak ada perubahan kedua.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs"

const EN_DIR = "lib/i18n/en"
const catalog = new Set(
  JSON.parse(readFileSync("lib/i18n/catalog.json", "utf8")).strings.map((e) => e.s),
)

const ADDITIONS = {
  "Karya Anda — komentar di sini bisa Anda moderasi.":
    "Your work — you can moderate comments here.",
  "Saat akun yang kamu ikuti membagikan karya, karyanya muncul di sini.":
    "When accounts you follow share work, it shows up here.",
  "@{x} belum membagikan foto atau karya produk.":
    "@{x} hasn't shared any photos or product work yet.",
  "Bagikan karya ini": "Share this work",
  "Belum ada etalase": "No showcase items yet",
  "Belum ada karya di etalase": "No work in the showcase yet",
  "Cover karya": "Work cover",
  Etalase: "Showcase",
  "Etalase Anda": "Your showcase",
  "Etalase — @{x}": "Showcase — @{x}",
  "Filter kategori {x}": "Category filter {x}",
  "Foto diunggah — lengkapi detail, lalu tampilkan di profil":
    "Photo uploaded — complete the details, then show it on your profile",
  "Foto terunggah tapi gagal dilampirkan": "Photo uploaded but couldn't be attached",
  "Foto yang berhasil disimpan saat Anda menekan Simpan.":
    "Successfully uploaded photos are saved when you press Save.",
  "Gagal memuat etalase": "Couldn't load showcase",
  "Gagal mengirim laporan": "Couldn't send report",
  "Gagal mengunggah foto": "Couldn't upload photo",
  "Halaman sosial: suka, komentar, bagikan": "Social page: like, comment, share",
  "Hapus filter kategori {x}": "Remove category filter {x}",
  "Hapus karya ini?": "Delete this work?",
  "Harga lewat diskusi": "Price on request",
  "Hingga Rp {x}": "Up to Rp {x}",
  "Item etalase": "Showcase item",
  "Jasa desain, kerajinan, digital…": "Design services, crafts, digital…",
  "Judul, kategori, dan rentang harga membantu calon pembeli memahami penawaran Anda.":
    "Title, category, and price range help buyers understand your offer.",
  "Karya akan dihapus permanen dari etalase Anda.":
    "This work will be permanently deleted from your showcase.",
  "Karya dihapus": "Work deleted",
  "Karya disembunyikan": "Work hidden",
  "Karya ditambahkan": "Work added",
  "Karya ditampilkan di profil": "Work shown on profile",
  "Kategori (opsional)": "Category (optional)",
  "Kategori: {x}": "Category: {x}",
  "Ketuk karya untuk mengubah detail, menyembunyikan, atau menghapus.":
    "Tap a work to edit details, hide, or delete.",
  "Kirim Laporan": "Send report",
  "Laporan terkirim": "Report sent",
  "Lihat kategori {x}": "View category {x}",
  "Lihat sebagai galeri": "View as gallery",
  "Lihat semua komentar": "See all comments",
  "Masuk untuk berkomentar": "Sign in to comment",
  "Memuat karya": "Loading work",
  "Mulai Rp {x}": "From Rp {x}",
  "Share tidak tersedia di perangkat ini": "Share isn't available on this device",
  "Simpan karya ini": "Save this work",
  "Tampilkan feed kategori ini": "Show feed for this category",
  "Tampilkan secara publik": "Show publicly",
  "Tampilkan {x} lainnya": "Show {x} more",
  "Tanpa judul": "Untitled",
  "Tautan disalin ke papan klip": "Link copied to clipboard",
  "Urutan foto disimpan": "Photo order saved",
  "{x} dari {y} foto gagal diunggah": "{x} of {y} photos failed to upload",
  "{x} dari {y} foto. Foto pertama menjadi cover karya.":
    "{x} of {y} photos. The first photo becomes the work cover.",
  "{x} foto dilampirkan": "{x} photos attached",
  "{x} foto dilampirkan, {y} gagal": "{x} photos attached, {y} failed",
  "{x} foto gagal diunggah.": "{x} photos failed to upload.",
  "{x} — coba lampirkan lagi.": "{x} — try attaching again.",
}

const files = readdirSync(EN_DIR).filter((f) => f.endsWith(".json")).sort()
const dicts = files.map((file) => ({
  file,
  dict: JSON.parse(readFileSync(`${EN_DIR}/${file}`, "utf8")),
}))

// 1) pruning — hitung dulu total demi laporan.
let pruned = 0
for (const { dict } of dicts) {
  for (const key of Object.keys(dict)) {
    if (!catalog.has(key)) {
      delete dict[key]
      pruned += 1
    }
  }
}

// 2) tambahan — skip kunci yang sudah ada di file mana pun.
const owned = new Set(dicts.flatMap(({ dict }) => Object.keys(dict)))
const remediation = dicts.find(({ file }) => file === "remediation.json").dict
let added = 0
for (const [key, value] of Object.entries(ADDITIONS)) {
  if (!catalog.has(key)) {
    console.warn(`LEWAT (tidak ada di katalog): ${key}`)
    continue
  }
  if (owned.has(key)) continue
  remediation[key] = value
  owned.add(key)
  added += 1
}

for (const { file, dict } of dicts) {
  // Urutan stab: sort by key supaya diff review bersih.
  const sorted = Object.fromEntries(
    Object.entries(dict).sort(([a], [b]) => a.localeCompare(b)),
  )
  writeFileSync(`${EN_DIR}/${file}`, JSON.stringify(sorted, null, 2) + "\n")
}
console.log(`kunci mati dibuang: ${pruned}; terjemahan etalase ditambah: ${added}`)
