# Kebijakan Produk & Legal — Escrow Bertahap (Milestone)

> G199 (GAP-C). Dokumen ini adalah kebijakan produk & legal untuk fitur
> **Escrow Bertahap (Milestone)** di Kahade. Berlaku untuk pembeli, penjual,
> dan admin. Bahasa Indonesia. Revisi mengikuti perubahan produk.

## 1. Definisi tahap

- **Milestone (tahap)** adalah bagian dari satu order yang dapat diserahterimakan
  dan dibayar terpisah. Satu order terdiri dari 1 atau lebih tahap.
- Setiap tahap memiliki: **judul**, **deskripsi/kriteria hasil**, **nilai** (Rp),
  **tenggat pengerjaan**, dan **tenggat review** pembeli.
- Σ nilai seluruh tahap **HARUS sama dengan** nilai order (divalidasi server).
  Order satu tahap yang tidak mengaktifkan milestone tetap memakai alur escrow
  satu tahap existing — tidak berubah.
- Tahap diidentifikasi urutannya (Tahap 1, 2, 3, …) dan tidak bisa diurutkan
  ulang setelah order dibayar.

## 2. Acceptance (penerimaan) & kriteria

- Penjual menyelesaikan pekerjaan sesuai kriteria tiap tahap, lalu **mengirim
  hasil** dari aplikasi (dapat melampirkan bukti: foto/dokumen).
- Pembeli **mereview hasil** dalam tenggat review yang tertera. Review hanya
  bisa: **Terima** atau **Minta revisi**.
- "Terima" bersifat **sadar dan eksplisit** — pembeli menekan tombol
  "Terima & cairkan" dan mengonfirmasi nominal yang dicairkan.
- **Tidak ada auto-accept diam-diam**: bila pembeli tidak merespons, tahap
  TIDAK otomatis dianggap diterima (lihat §5).

## 3. Putaran revisi

- Tiap tahap punya **jatah putaran revisi** (default: 2 putaran), terlihat di
  aplikasi ("Putaran revisi tersisa: X dari 2").
- Permintaan revisi **wajib disertai catatan** yang menjelaskan kekurangannya.
- Bila jatah habis, pembeli tidak dapat lagi meminta revisi dari aplikasi.
  Penyelesaian lanjutan dilakukan lewat **sengketa per tahap** (§7) atau
  kesepakatan dua pihak.

## 4. Pelepasan dana per tahap

- Dana **dicairkan ke wallet penjual per tahap** begitu pembeli menekan
  "Terima & cairkan" dan konfirmasi berhasil.
- Pelepasan dana tahap bersifat **final dan tidak dapat ditarik kembali**
  oleh pembeli maupun Kahade — kecuali lewat hasil sengketa (§7) atau
  keputusan pengadilan/penegak hukum.
- Pencairan per tahap bersifat **idempoten**: satu tahap tidak pernah
  dicairkan dua kali, termasuk saat pengguna menekan tombol berulang atau
  koneksi terputus.
- **Fee platform dihitung proporsional per tahap** dari nilai tiap tahap.
  Tahap terakhir menyerap sisa pembulatan agar total fee tepat.

## 5. Deadline review & konsekuensi lewat tenggat

- Setiap tahap memiliki **tenggat review** (batas waktu pembeli meninjau hasil
  yang dikirim penjual).
- **Tanpa auto-accept**: lewat tenggat review TIDAK membuat tahap otomatis
  diterima dan dana TIDAK otomatis cair.
- Bila tenggat review lewat tanpa respons pembeli:
  1. Status tahap tetap "Hasil terkirim";
  2. Penjual menerima notifikasi pengingat agar menghubungi pembeli;
  3. Admin dapat memediasi; keputusan admin tercatat sebagai audit dan
     mengikat kedua pihak.
- Tenggat pengerjaan yang lewat tanpa hasil terkirim menjadi bahan
  pertimbangan admin dalam mediasi/sengketa.

## 6. Pembatalan sisa tahap

- Order bermilestone dapat dibatalkan selama ada tahap yang belum dicairkan.
- **Dana tahap yang sudah dicairkan (released) TIDAK kembali** ke pembeli
  lewat pembatalan — tahap tersebut sudah menjadi hak penjual (§4).
- Dana tahap yang belum dicairkan dikembalikan ke pembeli sesuai aturan
  refund escrow yang berlaku, dikurangi biaya yang sah bila ada.
- Pembatalan sebagian (sisa tahap saja) tidak memengaruhi tahap yang sudah
  selesai dan dicairkan.

## 7. Sengketa per tahap

- Sengketa dapat diajukan **terbatas pada satu tahap** (bukan seluruh order),
  selama tahap tersebut belum dicairkan.
- Tahap yang sedang disengketakan berstatus "Disengketa"; dananya tetap
  ditahan escrow sampai ada keputusan.
- Keputusan sengketa tahap dapat berupa: cairkan ke penjual, kembalikan ke
  pembeli, atau cairkan sebagian (split) — tercatat sebagai audit.
- Sengketa tahap tidak menghentikan tahap lain yang tidak disengketakan,
  kecuali admin memutuskan sebaliknya.

## 8. Perubahan tahap (change request)

- Perubahan judul, nilai, atau tenggat tahap setelah order dibayar
  **membutuhkan persetujuan eksplisit kedua pihak** (pembeli DAN penjual).
- Usulan perubahan dapat diajukan oleh salah satu pihak; pihak lain
  menyetujui/menolak dari aplikasi.
- Perubahan berlaku hanya setelah **disetujui kedua pihak**. Sebelum itu,
  ketentuan tahap semula tetap mengikat.
- Riwayat usulan dan persetujuan tercatat sebagai audit dan tidak dapat
  dihapus.

## 9. Fee proporsional

- Fee platform per tahap = fee order × (nilai tahap ÷ nilai order),
  dibulatkan ke rupiah terdekat; **tahap terakhir menyerap selisih
  pembulatan** sehingga Σ fee tahap = fee order tepat.
- Voucher/diskon order dialokasikan proporsional ke tiap tahap dengan
  mekanisme yang sama.

## 10. Rekonsiliasi & audit

- Sistem menjalankan pemeriksaan invarian berkala:
  - Σ nilai tahap = nilai order;
  - Σ net penjual per tahap = nilai bersih penjual order;
  - escrowHeld + escrowReleased per order = nilai bersih penjual.
- Ketidakcocokan memicu alert ke tim keuangan dan dapat diblokir dari
  pencairan lanjutan sampai diperbaiki.
- Seluruh kejadian tahap (dibuat, diaktifkan, hasil terkirim, revisi diminta,
  diterima, dicairkan, perubahan, sengketa) tercatat di timeline audit tahap.

## 11. Retensi data tahap

- Data tahap, bukti, dan audit disimpan selama order aktif dan masa garansi
  sengketa. Bukti tahap mengikuti kebijakan retensi bukti transaksi.
- Penghapusan data mengikuti kebijakan privasi Kahade; data audit keuangan
  dipertahankan sesuai kewajiban perpajakan/peraturan yang berlaku.

---

*Dokumen hidup — perubahan kebijakan memerlukan persetujuan produk dan
pembaruan dokumen ini sebelum dirilis.*
