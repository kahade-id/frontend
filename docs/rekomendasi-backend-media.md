# Rekomendasi Backend — Media Chat & Viewer (2026-10-07)

Konteks: frontend kini punya halaman media viewer terpusat (`/media-viewer`)
dan bubble media kaya (foto besar, video inline, voice waveform, kartu berkas,
peta mini, pratinjau tautan). Semua item di bawah ini adalah **rekomendasi —
TANPA perubahan kontrak API yang wajib**: klien sudah punya fallback untuk
setiap kolom yang belum ada. Backend bisa mengadopsi bertahap, dari prioritas
tertinggi.

## P0 — Thumbnail video (`thumbnailUrl`)

Masalah: `thumbnailUrl` sering kosong untuk lampiran video → bubble menampilkan
kotak ikon generik (bukan frame video), dan video inline memutar tanpa poster.

Usulan: saat unggah video, ekstrak satu frame (mis. detik ke-1, lebar 480px,
JPEG q60) dan isi `thumbnailUrl` seperti pada foto.

Fallback klien hari ini: ikon + badge durasi + ukuran (tetap informatif).

## P1 — Metadata durasi & ukuran yang konsisten

- `durationSeconds` pada pesan/lampiran audio & video (dipakai badge durasi
  bubble dan label pemutar sebelum metadata berkas siap). Hari ini sering
  `null` → badge disembunyikan, tidak merusak.
- `fileSize` (byte) pada semua lampiran (dipakai badge "12,4 MB" dan panel
  info). Hari ini sering `null` → baris ukuran disembunyikan.

Usulan: ekstrak saat unggah (ffprobe/MediaInfo untuk durasi; size dari stream).

## P2 — Varian kualitas video (opsional, hemat kuota)

Pemutar klien mendukung menu kualitas (Otomatis/Tinggi/Sedang/Rendah) tetapi
hari ini hanya punya satu URL → menu tidak tampil.

Usulan (bila kapasitas transcode ada): sediakan varian H.264 480p/720p +
master, mis. kolom `variants: [{ label, url }]` pada lampiran video. Tanpa
ini: satu URL tetap diputar normal.

## P3 — Waveform voice note (opsional, kosmetik)

Bubble voice note memakai waveform pseudo-random deterministik dari ID pesan
(konsisten per pesan, tetapi bukan bentuk suara asli).

Usulan (nice-to-have): kolom `waveform: number[]` (32–64 sampel ternormalisasi
0–1) saat unggah audio. Klien akan memakainya bila ada (TODO di kode).

## P4 — TTL signed URL & pola refresh

Kondisi hari ini: `fileUrl`/`thumbnailUrl` di-sign dengan TTL 5 menit
(`ATTACHMENT_URL_TTL_SECONDS=300`); klien me-refresh via
`GET /rooms/{id}/attachments?limit=100` lalu mencocokkan `fileName`.

Tidak ada yang rusak, tetapi dua perbaikan kecil akan menghilangkan seluruh
kelas bug "media kedaluwarsa":

1. Sertakan `urlExpiresAt` yang akurat di setiap URL (sebagian lampiran lama
   tidak memilikinya → klien menganggap kedaluwarsa dan me-refresh selalu).
2. (Ideal) Endpoint refresh per berkas (`GET /attachments/{id}/url`) supaya
   klien tidak mengambil 100 baris untuk menyegarkan satu foto.

## Bukan rekomendasi (sengaja TIDAK diminta)

- Tile/static-map server untuk pratinjau lokasi — klien memakai peta mini
  SVG deterministik lokal (gratis, offline, tanpa kunci API). Peta penuh
  in-app juga SVG + tombol "Rute" (deep-link `geo:`/Apple Maps). Tidak perlu
  backend.
- Proxy/scraper Open Graph untuk pratinjau tautan — klien fetch + parse
  `<meta property="og:*">` langsung dengan batas 300 KB/8 detik + cache.
  Tidak perlu backend.
- Konversi dokumen (PDF/docx/xlsx → HTML/JSON) — klien me-render PDF via
  Google Docs viewer, teks via fetch, dan office via tombol unduh/buka-dengan
  app. Khusus office: JANGAN kirim konten sebagai JSON mentah; unduhan
  biner biasa sudah cukup.
