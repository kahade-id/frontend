/**
 * Konten dokumen legal — DIBANGKITKAN OTOMATIS dari draf .docx
 * (lihat tools di workspace). Jangan edit manual; perbarui draf lalu
 * jalankan ulang generator. Draf versi 1.0, 27 September 2026.
 */
export interface LegalTextSegment {
  text: string
  bold?: boolean
  italic?: boolean
}
export interface LegalParagraph {
  kind: "p"
  segments: LegalTextSegment[]
}
export interface LegalSection {
  id: string
  title: string
  paragraphs: LegalParagraph[]
}
export interface LegalPart {
  id: string
  title: string
  sections: LegalSection[]
}
export interface LegalDocData {
  title: string
  company: string
  versionLabel: string
  effectiveLabel: string
  intro: LegalParagraph[]
  summary: { title: string; paragraphs: LegalParagraph[] } | null
  parts: LegalPart[]
}

export const TERMS_CONTENT: LegalDocData = {
  "title": "Syarat & Ketentuan",
  "company": "PT Kawal Hak Dengan Aman",
  "versionLabel": "Versi 1.0",
  "effectiveLabel": "Disusun 27 September 2026",
  "intro": [
    {
      "kind": "p",
      "segments": [
        {
          "text": "Kahade adalah platform social commerce dan fasilitasi transaksi peer-to-peer dengan mekanisme rekening bersama atau escrow. Pengguna dapat membuat profil dan etalase, berinteraksi melalui fitur sosial, berkomunikasi, membuat transaksi, melakukan pembayaran melalui metode yang tersedia, memantau pengiriman, mengonfirmasi penerimaan, memberi ulasan, serta mengajukan sengketa. Dana transaksi ditahan selama proses yang ditentukan dan diteruskan sesuai status transaksi, instruksi yang sah, keputusan sengketa, atau kewajiban hukum."
        }
      ]
    },
    {
      "kind": "p",
      "segments": [
        {
          "text": "Dengan membuat akun, mengakses fitur yang memerlukan persetujuan, atau melanjutkan transaksi setelah memperoleh kesempatan yang wajar untuk membaca dokumen ini, Pengguna menyatakan telah membaca dan memahami ketentuan yang relevan. Persetujuan tidak menghapus hak yang tidak dapat dikesampingkan berdasarkan hukum Indonesia."
        }
      ]
    }
  ],
  "summary": null,
  "parts": [
    {
      "id": "bagian-i-syarat-ketentuan",
      "title": "BAGIAN I — SYARAT & KETENTUAN",
      "sections": [
        {
          "id": "1-ruang-lingkup-dan-keberlakuan",
          "title": "1. Ruang lingkup dan keberlakuan",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "1.1. Syarat & Ketentuan ini merupakan perjanjian antara setiap orang atau badan usaha yang menggunakan Kahade (\"Pengguna\") dan PT Kawal Hak Dengan Aman (\"Kahade\", \"kami\")."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "1.2. Ketentuan ini berlaku terhadap aplikasi seluler, situs web, antarmuka pemrograman aplikasi yang diizinkan, layanan pelanggan, notifikasi, fitur sosial, etalase, chat, transaksi, escrow, dompet, voucher, promosi, langganan, serta fitur lain yang secara resmi dioperasikan Kahade."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "1.3. Ketentuan tambahan dapat berlaku untuk fitur tertentu. Apabila terjadi pertentangan, ketentuan khusus berlaku hanya sejauh mengatur fitur tersebut, sedangkan ketentuan umum tetap berlaku untuk hal lainnya."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "1.4. Kebijakan Privasi, kebijakan biaya, panduan transaksi, standar komunitas, aturan barang terlarang, ketentuan promosi, dan pemberitahuan di layar transaksi menjadi bagian dari kontrak ini sejauh ditampilkan atau dirujuk secara jelas sebelum tindakan terkait dilakukan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "1.5. Tidak ada bagian dalam dokumen ini yang dimaksudkan untuk mengurangi hak konsumen, hak Subjek Data Pribadi, atau upaya hukum lain yang wajib diberikan oleh peraturan perundang-undangan."
                }
              ]
            }
          ]
        },
        {
          "id": "2-definisi-utama",
          "title": "2. Definisi utama",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "2.1. "
                },
                {
                  "text": "Akun",
                  "bold": true
                },
                {
                  "text": " adalah identitas elektronik Pengguna pada Kahade, termasuk kredensial, profil, perangkat, sesi, pengaturan, dan riwayat aktivitas yang terkait."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "2.2. "
                },
                {
                  "text": "Etalase",
                  "bold": true
                },
                {
                  "text": " adalah konten produk atau jasa yang dibuat Pengguna dan dapat dilihat, disukai, dikomentari, dibagikan, disimpan, atau digunakan untuk memulai transaksi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "2.3. "
                },
                {
                  "text": "Transaksi",
                  "bold": true
                },
                {
                  "text": " adalah kesepakatan elektronik antara Pembeli dan Penjual yang dibuat atau dicatat melalui Kahade, termasuk nilai barang/jasa, biaya, deskripsi, pengiriman, tenggat, dan instruksi pelepasan dana."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "2.4. "
                },
                {
                  "text": "Escrow",
                  "bold": true
                },
                {
                  "text": " adalah mekanisme penahanan dan pelepasan dana transaksi berdasarkan tahapan serta kondisi yang ditampilkan. Istilah ini tidak dengan sendirinya menyatakan Kahade sebagai bank, penerbit uang elektronik, atau penyedia jasa pembayaran berizin; pemrosesan pembayaran dapat melibatkan mitra yang tunduk pada ketentuannya sendiri."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "2.5. "
                },
                {
                  "text": "Dompet",
                  "bold": true
                },
                {
                  "text": " adalah tampilan saldo dan catatan mutasi yang tersedia pada Akun. Sifat hukum, ketersediaan, penggunaan, penarikan, dan penyelesaian setiap saldo mengikuti sumber dana, mitra pembayaran, serta hukum yang berlaku."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "2.6. "
                },
                {
                  "text": "Konten Pengguna",
                  "bold": true
                },
                {
                  "text": " mencakup teks, foto, video, audio, dokumen, etalase, komentar, ulasan, jawaban, pesan, bukti pengiriman, dan bukti sengketa yang dikirim melalui Layanan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "2.7. "
                },
                {
                  "text": "Sengketa",
                  "bold": true
                },
                {
                  "text": " adalah perselisihan terkait pelaksanaan Transaksi yang diajukan melalui mekanisme Kahade, tanpa menghilangkan hak para pihak untuk menggunakan forum penyelesaian yang tersedia berdasarkan hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "2.8. Istilah lain dijelaskan pada Lampiran D. Judul dipakai untuk kemudahan membaca dan tidak membatasi makna klausul."
                }
              ]
            }
          ]
        },
        {
          "id": "3-kelayakan-dan-kapasitas-hukum",
          "title": "3. Kelayakan dan kapasitas hukum",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "3.1. Pengguna harus mampu membuat perjanjian yang sah. Fitur keuangan, escrow, penarikan, verifikasi identitas, dan tindakan berisiko tinggi hanya boleh digunakan oleh pihak yang memenuhi usia, kapasitas, verifikasi, dan persyaratan lain yang ditampilkan serta diwajibkan hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "3.2. Anak atau orang yang belum cakap hukum tidak boleh menggunakan fitur keuangan atas nama sendiri. Apabila Kahade menyediakan pengalaman terbatas untuk Pengguna muda, penggunaan tersebut harus mengikuti batas usia, persetujuan orang tua/wali, dan kontrol yang dinyatakan secara khusus."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "3.3. Pengguna badan usaha menyatakan bahwa orang yang mendaftar atau bertindak untuknya memiliki kewenangan yang cukup. Kahade dapat meminta dokumen pendirian, izin, data pemilik manfaat, surat kuasa, atau bukti kewenangan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "3.4. Pengguna tidak boleh menggunakan Layanan jika pernah dilarang berdasarkan hukum, dikenai sanksi yang relevan, atau Akunnya dihentikan karena pelanggaran berat tanpa izin tertulis Kahade."
                }
              ]
            }
          ]
        },
        {
          "id": "4-pendaftaran-identitas-dan-keamanan-akun",
          "title": "4. Pendaftaran, identitas, dan keamanan Akun",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "4.1. Pendaftaran baru menggunakan nomor telepon seluler Indonesia dan verifikasi satu kali melalui WhatsApp resmi Kahade sesuai alur yang tersedia. Pengguna juga membuat kata sandi. Login dapat mendukung username, nomor telepon, atau email yang telah ditautkan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "4.2. Pengguna wajib memberikan informasi yang benar, mutakhir, lengkap, dan miliknya sendiri. Dilarang menyamar, memakai identitas orang lain tanpa kewenangan, memalsukan umur, menggunakan nomor yang tidak dikuasai, atau menciptakan Akun untuk menghindari pembatasan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "4.3. Setiap Pengguna bertanggung jawab menjaga kata sandi, PIN, kode OTP, perangkat, passkey, autentikator, dan sesi. Kahade tidak pernah meminta Pengguna menyerahkan kata sandi, PIN, atau kode OTP kepada pihak lain. Pengguna wajib segera melaporkan pengambilalihan Akun atau transaksi yang tidak dikenali."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "4.4. Satu Akun pada prinsipnya digunakan oleh satu pemilik. Pengalihan, penyewaan, penjualan, atau berbagi kontrol Akun dilarang. Akses staf pada Akun badan usaha harus dikelola secara berwenang dan dapat diaudit."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "4.5. Kahade dapat menerapkan batas percobaan, CAPTCHA, verifikasi perangkat, autentikasi dua faktor, passkey, pembekuan sementara, konfirmasi tindakan sensitif, serta pemeriksaan lokasi atau risiko untuk mencegah penyalahgunaan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "4.6. Perubahan nomor, email, kata sandi, PIN, perangkat tepercaya, rekening bank, atau faktor autentikasi dapat memerlukan verifikasi tambahan. Keterlambatan akibat pemeriksaan keamanan tidak dianggap wanprestasi sepanjang dilakukan secara wajar dan proporsional."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "4.7. Pengguna wajib memperbarui data apabila berubah. Risiko dari data tidak akurat, termasuk kegagalan notifikasi atau transfer ke rekening yang salah akibat instruksi Pengguna, menjadi tanggung jawab Pengguna sejauh bukan akibat kesalahan Kahade atau mitranya."
                }
              ]
            }
          ]
        },
        {
          "id": "5-verifikasi-identitas-dan-kepatuhan",
          "title": "5. Verifikasi identitas dan kepatuhan",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "5.1. Kahade dapat meminta proses Know Your Customer (KYC), verifikasi wajah atau liveness, dokumen identitas, data usaha, rekening bank, sumber dana, tujuan transaksi, pemilik manfaat, atau informasi lain yang diperlukan untuk keamanan dan kepatuhan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "5.2. Status terverifikasi atau badge hanya menunjukkan bahwa pemeriksaan tertentu telah dilalui pada waktu tertentu. Status tersebut bukan jaminan kejujuran, kualitas barang, kemampuan membayar, kewenangan menjual, atau keberhasilan Transaksi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "5.3. Kahade dapat menolak, membatasi, menunda, atau meninjau tindakan apabila data tidak konsisten, dokumen kedaluwarsa, ditemukan indikasi penipuan, pencucian uang, pendanaan terorisme, pengambilalihan Akun, transaksi sirkular, penyalahgunaan promosi, atau kewajiban hukum lain."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "5.4. Pengguna wajib memberikan klarifikasi yang wajar. Kegagalan menanggapi dapat mengakibatkan pembatasan sementara, tanpa mengurangi hak atas dana sah setelah verifikasi dan kewajiban hukum diselesaikan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "5.5. Kahade dapat bekerja sama dengan penyedia verifikasi, penyedia pembayaran, bank, kurir, dan otoritas yang berwenang sesuai Kebijakan Privasi dan hukum. Permintaan aparat atau regulator dipenuhi hanya berdasarkan dasar hukum yang sah."
                }
              ]
            }
          ]
        },
        {
          "id": "6-peran-kahade-dan-para-pengguna",
          "title": "6. Peran Kahade dan para Pengguna",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "6.1. Pembeli dan Penjual adalah pihak pada kontrak jual beli atau jasa. Mereka bertanggung jawab atas deskripsi, legalitas, kualitas, kepemilikan, harga, pajak, pengiriman, penerimaan, garansi, retur, dan pemenuhan kewajiban masing-masing."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "6.2. Kahade menyediakan sarana elektronik untuk menemukan atau menampilkan etalase, berkomunikasi, membentuk kesepakatan, mencatat instruksi, memfasilitasi pembayaran dan escrow, serta menangani sengketa administratif."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "6.3. Kecuali dinyatakan secara tegas, Kahade bukan produsen, pemilik, importir, distributor, pemberi kerja, agen, penasihat, kurir, atau penjamin barang/jasa Pengguna. Kahade tidak menjadi pihak dalam komunikasi atau Transaksi di luar sistemnya."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "6.4. Kahade tidak menjamin bahwa setiap Pengguna, etalase, ulasan, atau klaim adalah benar. Sistem verifikasi, moderasi, peringkat, dan deteksi risiko mengurangi risiko tetapi tidak menghilangkannya."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "6.5. Pengguna harus menilai lawan transaksi secara mandiri, membaca detail, meminta bukti yang relevan, memakai chat dalam Layanan, dan tidak mengalihkan pembayaran ke luar mekanisme resmi."
                }
              ]
            }
          ]
        },
        {
          "id": "7-pembentukan-transaksi-elektronik",
          "title": "7. Pembentukan Transaksi elektronik",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "7.1. Penawaran dalam etalase bukan selalu penawaran final. Transaksi terbentuk ketika syarat utama dikonfirmasi oleh para pihak dan sistem menerbitkan ID Transaksi atau status yang menunjukkan pesanan aktif."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "7.2. Detail minimum dapat mencakup identitas para pihak, objek, variasi, kuantitas, kondisi, harga, biaya, pihak penanggung biaya, metode pembayaran, alamat atau metode penyerahan, batas waktu, dan kriteria penerimaan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "7.3. Pengguna wajib memeriksa ringkasan sebelum menyetujui. Catatan sistem, stempel waktu, versi detail, chat, bukti pembayaran, dan perubahan status dapat digunakan sebagai bukti elektronik."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "7.4. Perubahan material setelah pembayaran memerlukan persetujuan yang dapat dibuktikan dari pihak terdampak. Kesepakatan di luar sistem mungkin tidak dapat dipertimbangkan oleh Kahade."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "7.5. Kesalahan harga, stok, biaya, atau informasi yang nyata dapat dikoreksi sebelum dana dilepas, dengan pemberitahuan dan pilihan pembatalan atau persetujuan ulang yang wajar."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "7.6. Kahade dapat membatalkan Transaksi yang melanggar hukum, melibatkan barang terlarang, terindikasi manipulatif, tidak dapat diproses mitra, atau mustahil dipenuhi. Dana diperlakukan sesuai status penyelesaian, potongan yang sah, dan hukum."
                }
              ]
            }
          ]
        },
        {
          "id": "8-pembayaran-dan-escrow",
          "title": "8. Pembayaran dan escrow",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "8.1. Pembeli wajib membayar hanya melalui instruksi resmi dalam Layanan. Status \"menunggu pembayaran\" bukan bukti dana diterima. Status yang tercatat pada sistem Kahade atau mitra pembayaran menjadi rujukan operasional, dengan hak Pengguna mengajukan koreksi disertai bukti."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "8.2. Dana yang berhasil diterima untuk Transaksi ditempatkan dalam mekanisme escrow dan belum menjadi dana bebas Penjual sampai kondisi pelepasan terpenuhi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "8.3. Dana dapat dilepas kepada Penjual setelah Pembeli mengonfirmasi penerimaan, masa konfirmasi berakhir sesuai aturan yang ditampilkan, bukti dan status pengiriman memenuhi kondisi, kedua pihak bersepakat, atau keputusan sengketa menetapkannya."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "8.4. Dana dapat dikembalikan seluruh atau sebagian kepada Pembeli jika Transaksi dibatalkan secara sah, pembayaran gagal atau berlebih, Penjual tidak memenuhi kewajiban, kesepakatan para pihak mengaturnya, atau keputusan sengketa menetapkannya."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "8.5. Selama sengketa, peninjauan risiko, chargeback, permintaan otoritas, gangguan penyedia pembayaran, atau dugaan pelanggaran, pelepasan dana dapat ditahan sementara. Penahanan harus dibatasi pada kebutuhan pemeriksaan dan ditinjau secara wajar."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "8.6. Pengguna tidak memperoleh bunga atas dana escrow kecuali diwajibkan hukum atau ditawarkan secara tegas. Dana tidak boleh digunakan untuk spekulasi atau kepentingan yang bertentangan dengan peruntukannya."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "8.7. Jika penyedia pembayaran membatalkan, menarik kembali, atau menolak pembayaran, Kahade dapat menyesuaikan catatan saldo, membekukan nilai terkait, menagih kekurangan, atau membatalkan Transaksi setelah pemeriksaan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "8.8. Pengguna dilarang melakukan chargeback yang tidak jujur. Pengajuan kepada penerbit alat bayar tidak menggantikan kewajiban memberikan keterangan pada proses sengketa Kahade."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "8.9. Kahade dapat memakai rekening penampungan, virtual account, QRIS, transfer bank, atau metode lain melalui mitra. Nama, biaya, limit, waktu proses, dan syarat mitra ditampilkan pada alur terkait."
                }
              ]
            }
          ]
        },
        {
          "id": "9-biaya-pajak-dan-koreksi",
          "title": "9. Biaya, pajak, dan koreksi",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "9.1. Biaya layanan, biaya admin, biaya pembayaran, biaya penarikan, biaya pengiriman, premi, atau potongan lain hanya dibebankan jika ditampilkan sebelum konfirmasi atau timbul karena kewajiban hukum yang dapat dijelaskan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "9.2. Setiap pihak bertanggung jawab atas pajak, bea, pungutan, dan pelaporan yang melekat pada kegiatannya. Kahade dapat memotong atau melaporkan jumlah tertentu apabila diwajibkan hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "9.3. Voucher, cashback, subsidi, atau pembulatan tidak mengubah nilai pokok Transaksi kecuali ringkasan menyatakannya. Nilai promo tidak dapat diuangkan atau dipindahtangankan kecuali aturannya mengizinkan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "9.4. Bila terjadi salah hitung atau pencatatan ganda, Kahade dapat melakukan koreksi dengan jejak audit. Sebelum mendebit saldo tersedia untuk koreksi material, Kahade akan memberi pemberitahuan dan dasar koreksi, kecuali tindakan segera diperlukan untuk mencegah kerugian atau mematuhi hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "9.5. Pengguna dapat meminta penjelasan mutasi melalui Chat dengan Customer Service (CS) dan menyertakan ID Transaksi, tanggal, waktu, jumlah, biaya admin, tujuan transfer, serta bukti yang relevan."
                }
              ]
            }
          ]
        },
        {
          "id": "10-dompet-saldo-top-up-transfer-dan-penarikan",
          "title": "10. Dompet, saldo, top up, transfer, dan penarikan",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "10.1. Dompet menampilkan saldo total, saldo tersedia, saldo escrow, dan mutasi sesuai fungsi yang tersedia. Tampilan tidak menggantikan catatan penyelesaian pada mitra pembayaran atau bank jika terjadi perbedaan yang dapat dibuktikan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "10.2. Top up harus berasal dari sumber dana yang sah dan dikuasai Pengguna. Penggunaan kartu, rekening, atau identitas pihak lain tanpa izin dilarang."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "10.3. Transfer antar-Pengguna hanya boleh untuk tujuan sah. Pengguna wajib memeriksa nama, username, nomor, dan nominal penerima. Transfer yang telah final mungkin tidak dapat dibatalkan kecuali penerima setuju atau diwajibkan hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "10.4. Penarikan hanya dilakukan ke rekening terverifikasi yang sesuai dengan persyaratan KYC. Kahade dapat menetapkan jumlah minimum, maksimum, biaya, jadwal, dan waktu proses yang ditampilkan sebelum konfirmasi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "10.5. PIN, OTP, atau autentikasi tambahan dapat diwajibkan untuk tindakan Dompet. Pembatasan keamanan tidak boleh diakali dengan membagi transaksi, memakai Akun lain, atau memanipulasi perangkat."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "10.6. Saldo yang tidak dapat digunakan karena sengketa, reserve, chargeback, kewajiban pengembalian, atau perintah hukum akan ditandai sesuai status. Pengguna berhak memperoleh penjelasan yang tidak mengganggu investigasi atau kewajiban kerahasiaan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "10.7. Jika saldo menjadi negatif karena koreksi, chargeback, atau kewajiban sah, Pengguna wajib melunasi. Kahade dapat membatasi fungsi Dompet sampai penyelesaian, tetapi tidak boleh mengambil dana yang tidak terkait secara sewenang-wenang."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "10.8. Kahade dapat menetapkan saldo dorman atau mekanisme penanganan Akun tidak aktif sesuai hukum dan pemberitahuan sebelumnya. Dana sah tidak hangus hanya karena Pengguna tidak aktif, kecuali hukum atau syarat produk tertentu secara sah menentukan lain."
                }
              ]
            }
          ]
        },
        {
          "id": "11-kewajiban-penjual",
          "title": "11. Kewajiban Penjual",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "11.1. Penjual wajib memiliki hak dan kewenangan untuk menawarkan barang/jasa; memberikan informasi yang akurat; mengungkap kondisi, cacat, risiko, asal, garansi, masa berlaku, dan pembatasan; serta memenuhi izin atau standar produk."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "11.2. Foto dan deskripsi harus mewakili objek sebenarnya. Dilarang memakai foto menyesatkan, merek tanpa hak, testimoni palsu, kelangkaan semu, harga umpan, atau klaim kesehatan/keuangan yang tidak dapat dibuktikan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "11.3. Penjual wajib menjaga stok, merespons dalam waktu wajar, mengemas secara layak, memakai metode kirim yang disepakati, memasukkan nomor resi yang benar, dan menyimpan bukti serah-terima."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "11.4. Penjual tidak boleh meminta Pembeli membayar di luar Kahade, mengirim kode OTP/PIN, menandai barang terkirim sebelum diserahkan, atau menekan Pembeli mengonfirmasi sebelum pemeriksaan yang wajar."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "11.5. Untuk jasa atau produk digital, Penjual wajib menetapkan ruang lingkup, hasil, format, jadwal, lisensi, revisi, dan kriteria penerimaan. Bukti penyerahan harus dapat diverifikasi tanpa mengekspos data berlebihan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "11.6. Penjual bertanggung jawab atas penarikan produk, keselamatan, garansi, layanan purnajual, dan kewajiban konsumen yang melekat. Moderasi atau pembayaran oleh Kahade tidak mengalihkan kewajiban tersebut."
                }
              ]
            }
          ]
        },
        {
          "id": "12-kewajiban-pembeli",
          "title": "12. Kewajiban Pembeli",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "12.1. Pembeli wajib membaca deskripsi, memeriksa kompatibilitas dan syarat, memberi alamat atau instruksi yang akurat, membayar tepat waktu, serta tersedia untuk menerima dan memeriksa barang."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "12.2. Pembeli wajib mengonfirmasi penerimaan dengan jujur. Dilarang mengklaim barang tidak diterima ketika telah diterima, mengganti barang untuk retur, merusak objek agar memenuhi alasan klaim, atau menyalahgunakan sengketa."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "12.3. Pemeriksaan harus dilakukan tanpa penggunaan berlebihan yang menurunkan nilai barang, kecuali diperlukan untuk menguji fungsi normal. Bukti pembukaan paket disarankan untuk barang bernilai tinggi atau rentan sengketa."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "12.4. Jika ada masalah, Pembeli harus segera memakai kanal Transaksi, menjaga barang dan kemasan, menghentikan penggunaan jika tidak aman, serta mengikuti instruksi retur yang wajar."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "12.5. Pembeli bertanggung jawab atas kebenaran alamat dan penerima. Risiko akibat penolakan, alamat salah, keterlambatan pengambilan, atau tindakan penerima yang ditunjuk dapat dibebankan sesuai fakta dan kebijakan kurir."
                }
              ]
            }
          ]
        },
        {
          "id": "13-pengiriman-penyerahan-dan-risiko",
          "title": "13. Pengiriman, penyerahan, dan risiko",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "13.1. Estimasi pengiriman bukan jaminan. Kurir dapat memiliki syarat, area, larangan, batas ganti rugi, dan prosedur klaim sendiri."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "13.2. Status pelacakan otomatis adalah informasi dari kurir atau integrator. Para pihak dapat mengajukan koreksi dengan bukti serah-terima, foto, rekaman, berat, geolokasi, atau dokumen lain yang sah."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "13.3. Risiko kehilangan atau kerusakan dinilai berdasarkan tanggung jawab pengemasan, penyerahan ke kurir, ketentuan kurir, asuransi, serta bukti. Tidak ada klausul ini yang menghapus hak konsumen yang wajib."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "13.4. Pengiriman langsung, pickup, atau penyerahan digital harus memakai bukti yang disepakati. Pengguna dilarang membuat bukti palsu atau meminta pihak lain mengonfirmasi kejadian yang tidak terjadi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "13.5. Klaim asuransi, bila tersedia, tunduk pada polis, risiko yang ditanggung, pengecualian, bukti, nilai pertanggungan, dan tenggat yang ditampilkan. Kahade tidak menjanjikan perlindungan yang tidak tercantum dalam polis atau perjanjian mitra."
                }
              ]
            }
          ]
        },
        {
          "id": "14-pembatalan-retur-pengembalian-dana-dan-penuka",
          "title": "14. Pembatalan, retur, pengembalian dana, dan penukaran",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "14.1. Pembatalan sebelum pembayaran, setelah pembayaran, setelah pengiriman, dan setelah penerimaan dapat memiliki akibat berbeda. Opsi yang tersedia ditampilkan sesuai status Transaksi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "14.2. Penjual dapat menolak pembatalan setelah pemenuhan dimulai jika penolakan sah dan proporsional. Pembeli tetap dapat mengajukan klaim atas ketidaksesuaian, cacat, barang terlarang, atau hak wajib lain."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "14.3. Retur harus memakai alasan yang benar, metode kirim yang dapat dilacak, serta kondisi yang secara wajar memungkinkan pemeriksaan. Pihak yang menanggung biaya retur ditentukan oleh alasan, bukti, kesepakatan, dan hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "14.4. Pengembalian dana diproses ke sumber atau kanal yang tersedia setelah syarat terpenuhi. Waktu dana terlihat dapat bergantung pada bank atau mitra dan akan diinformasikan secara wajar."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "14.5. Penukaran tidak dianggap selesai sampai objek pengganti diterima atau kesepakatan lain dipenuhi. Dana dapat tetap ditahan sepanjang diperlukan untuk melindungi kedua pihak."
                }
              ]
            }
          ]
        },
        {
          "id": "15-sengketa-dan-keputusan-escrow",
          "title": "15. Sengketa dan keputusan escrow",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "15.1. Pengguna harus mengajukan Sengketa melalui Transaksi dalam tenggat yang ditampilkan, memilih kategori yang tepat, menjelaskan tuntutan, serta mengunggah bukti yang relevan dan diperoleh secara sah."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "15.2. Bukti dapat mencakup detail pesanan, chat, foto/video, resi, bukti pembayaran, rekaman kondisi, dokumen teknis, dan komunikasi kurir. Data pihak lain harus diminimalkan dan tidak boleh dipublikasikan di ruang terbuka."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "15.3. Pihak lawan memperoleh kesempatan yang wajar untuk menanggapi. Kegagalan menanggapi tidak selalu berarti mengakui klaim, tetapi keputusan dapat dibuat berdasarkan bukti yang tersedia."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "15.4. Kahade dapat meminta klarifikasi, membuka ruang chat Sengketa yang dapat diikuti admin, menawarkan penyelesaian bersama, memperpanjang tenggat secara terbatas, atau mengunci status agar bukti tidak diubah."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "15.5. Keputusan dapat berupa pelepasan kepada Penjual, pengembalian kepada Pembeli, pembagian dana, retur, penukaran, atau tindakan lain yang tersedia dan proporsional. Keputusan mempertimbangkan detail Transaksi, bukti, status logistik, perilaku para pihak, kebijakan, dan hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "15.6. Kahade bertindak sebagai administrator mekanisme platform, bukan pengadilan. Keputusan internal tidak meniadakan hak Pengguna untuk mengakses Badan Penyelesaian Sengketa Konsumen, mediasi, arbitrase berdasarkan kesepakatan yang sah, atau pengadilan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "15.7. Untuk mencegah kerugian, keputusan yang telah dieksekusi pada escrow dapat bersifat final secara operasional di sistem, tanpa menghilangkan koreksi atas kesalahan nyata, penipuan, atau putusan/ketetapan berwenang."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "15.8. Pelapor yang sengaja menyerahkan bukti palsu, mengintimidasi pihak lain, atau memanipulasi proses dapat dikenai pembatasan dan bertanggung jawab menurut hukum."
                }
              ]
            }
          ]
        },
        {
          "id": "16-etalase-dan-fitur-social-commerce",
          "title": "16. Etalase dan fitur social commerce",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "16.1. Pengguna dapat membuat etalase dan berinteraksi melalui like, komentar, simpan, bagikan, ikuti, Tanya Jawab atau Utas, dan fitur serupa. Ketersediaan tidak menjamin distribusi, jangkauan, penjualan, atau peringkat tertentu."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "16.2. Penjual bertanggung jawab menjaga informasi etalase tetap akurat. Jika stok, harga, izin, atau kondisi berubah, etalase harus diperbarui atau dinonaktifkan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "16.3. Like, jumlah pengikut, badge, peringkat, atau posisi feed bukan sertifikasi barang maupun rekomendasi Kahade. Dilarang memperjualbelikan interaksi, memakai bot, pertukaran manipulatif, atau koordinasi untuk menipu sistem peringkat."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "16.4. Kahade dapat mengatur rekomendasi berdasarkan relevansi, keamanan, preferensi, aktivitas, kualitas, lokasi umum, dan sinyal lain. Penjelasan tingkat tinggi tersedia dalam Kebijakan Privasi; Pengguna dapat mengelola pilihan tertentu yang tersedia."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "16.5. Etalase yang dihapus dapat masuk masa pemulihan 30 hari sebelum penghapusan permanen, kecuali diperlukan untuk sengketa, legal hold, keamanan, atau kewajiban hukum. Selama masa pemulihan, etalase tidak harus tampil kepada publik."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "16.6. Pengguna dilarang membuat etalase yang semata-mata mengarahkan pembayaran ke luar sistem, mengumpulkan Data Pribadi secara tidak sah, melakukan phishing, menyamarkan identitas, atau memperdagangkan barang/jasa terlarang."
                }
              ]
            }
          ]
        },
        {
          "id": "17-chat-komentar-ulasan-dan-utas",
          "title": "17. Chat, komentar, ulasan, dan Utas",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "17.1. Chat langsung dapat dibuka meskipun belum ada riwayat percakapan. Chat Transaksi dan ruang Sengketa dapat memiliki peserta, akses admin, serta aturan retensi yang berbeda."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "17.2. Pengguna wajib berkomunikasi secara sopan dan relevan. Dilarang mengirim spam, ancaman, pelecehan, ujaran kebencian, konten seksual eksploitatif, malware, phishing, doxing, data sensitif yang tidak perlu, atau instruksi melanggar hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "17.3. Ulasan harus berdasarkan pengalaman nyata, jujur, dan proporsional. Insentif ulasan harus diungkapkan. Penjual dilarang mensyaratkan ulasan positif atau membalas dengan intimidasi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "17.4. Pengguna dapat menyunting atau menghapus konten jika fitur mengizinkan, tetapi salinan dapat dipertahankan untuk keamanan, Sengketa, audit, pelaporan, atau kewajiban hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "17.5. Fitur reaksi, balasan, bagikan, dan notifikasi tidak boleh dipakai untuk pengeroyokan digital, manipulasi, atau memperluas penyebaran konten ilegal."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "17.6. Kahade dapat menerapkan pemindaian otomatis dan peninjauan manusia untuk spam, penipuan, ancaman, eksploitasi, konten terlarang, dan keselamatan. Moderasi tidak berarti seluruh komunikasi dibaca secara rutin."
                }
              ]
            }
          ]
        },
        {
          "id": "18-lisensi-konten-pengguna",
          "title": "18. Lisensi Konten Pengguna",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "18.1. Pengguna tetap memiliki hak atas Konten Pengguna yang sah. Dengan mengunggah konten, Pengguna memberikan kepada Kahade lisensi non-eksklusif, berlaku global, bebas royalti, dapat disublisensikan kepada penyedia teknis, dan terbatas untuk menyimpan, mereproduksi, menampilkan, mengirim, memformat, memoderasi, serta mendistribusikan konten guna mengoperasikan dan mempromosikan Layanan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "18.2. Lisensi berakhir ketika konten dihapus dari sistem aktif, kecuali salinan masih diperlukan untuk cadangan, Sengketa, audit, penegakan, kewajiban hukum, atau telah dibagikan pihak lain secara sah."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "18.3. Pengguna menjamin memiliki hak yang diperlukan, termasuk izin dari orang yang tampak atau pemilik kekayaan intelektual. Pengguna tidak boleh mengunggah dokumen identitas, alamat, nomor rekening, atau Data Pribadi pihak lain tanpa alasan dan dasar yang sah."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "18.4. Kahade dapat membuat cuplikan atau pratinjau etalase untuk feed dan tautan berbagi. Penggunaan merek atau konten Pengguna di luar operasi normal atau promosi etalase memerlukan dasar yang sesuai."
                }
              ]
            }
          ]
        },
        {
          "id": "19-barang-jasa-dan-perilaku-terlarang",
          "title": "19. Barang, jasa, dan perilaku terlarang",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "19.1. Dilarang menggunakan Kahade untuk kegiatan yang melanggar hukum, hak pihak lain, ketertiban umum, kesusilaan, keselamatan, atau integritas sistem."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "19.2. Barang/jasa terlarang antara lain narkotika; senjata atau bahan peledak tanpa izin; manusia atau bagian tubuh; eksploitasi seksual; perjudian; dokumen, akun, data, kredensial, atau alat pembayaran curian; barang palsu; malware; jasa peretasan; pencucian uang; pendanaan terorisme; suap; hasil kejahatan; serta objek lain pada Lampiran B."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "19.3. Barang yang dibatasi, seperti obat, pangan, kosmetik, alkohol, tembakau, alat kesehatan, produk anak, barang berbahaya, jasa profesional, aset digital, tiket, dan produk berlisensi, hanya dapat ditawarkan jika hukum, izin, verifikasi usia, dan kebijakan Kahade mengizinkan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "19.4. Dilarang memanipulasi harga, melakukan transaksi fiktif atau sirkular, menguji alat bayar curian, membagi transaksi untuk menghindari limit, membuat bukti palsu, menyalahgunakan referral, mencuci hasil kejahatan, atau membantu pelanggaran pihak lain."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "19.5. Kahade dapat menghapus konten, menahan penyelesaian, membatasi jangkauan, menangguhkan fitur, atau melaporkan aktivitas berdasarkan tingkat risiko. Jika memungkinkan, Pengguna diberi alasan dan sarana keberatan; rincian dapat dibatasi untuk melindungi investigasi."
                }
              ]
            }
          ]
        },
        {
          "id": "20-kekayaan-intelektual-dan-laporan-pelanggaran",
          "title": "20. Kekayaan intelektual dan laporan pelanggaran",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "20.1. Aplikasi, kode, desain, merek, logo, basis data, dokumentasi, dan materi Kahade dilindungi hukum. Hak menggunakan Layanan bersifat terbatas, dapat dicabut, non-eksklusif, dan tidak dapat dialihkan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "20.2. Pengguna dilarang menyalin, menjual, merekayasa balik, mengikis data secara masif, menghindari kontrol akses, atau membuat layanan turunan dari sistem Kahade kecuali diizinkan hukum atau perjanjian tertulis."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "20.3. Pemilik hak dapat melaporkan konten dengan identitas, uraian karya/merek, lokasi konten, dasar hak, pernyataan itikad baik, dan bukti kewenangan. Laporan palsu dapat menimbulkan tanggung jawab."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "20.4. Pemilik konten yang diturunkan dapat mengajukan keberatan dengan bukti hak. Kahade dapat memulihkan, mempertahankan penurunan, atau meminta para pihak menyelesaikan sengketa melalui forum yang berwenang."
                }
              ]
            }
          ]
        },
        {
          "id": "21-promosi-voucher-referral-cashback-dan-peringk",
          "title": "21. Promosi, voucher, referral, cashback, dan peringkat",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "21.1. Setiap program memiliki periode, peserta, kuota, minimum transaksi, batas penggunaan, jenis transaksi, dan cara perhitungan yang ditampilkan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "21.2. Promosi tidak dapat digabungkan kecuali dinyatakan. Nilai promosi dapat dibatalkan bila Transaksi batal, diretur, chargeback, atau terbukti manipulatif."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "21.3. Dilarang melakukan self-referral, membuat banyak Akun, transaksi semu, kolusi, atau otomatisasi untuk memperoleh manfaat. Kahade dapat menahan manfaat selama pemeriksaan dan membatalkannya dengan alasan yang dapat dijelaskan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "21.4. Perubahan program tidak berlaku surut terhadap hak yang telah sah diperoleh, kecuali untuk koreksi kesalahan nyata, pencegahan fraud, atau kewajiban hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "21.5. Peringkat keanggotaan dan badge dapat didasarkan pada aktivitas, kualitas, kepatuhan, atau kriteria program. Peringkat bukan produk investasi dan tidak menjamin manfaat permanen."
                }
              ]
            }
          ]
        },
        {
          "id": "22-langganan-dan-fitur-berbayar",
          "title": "22. Langganan dan fitur berbayar",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "22.1. Langganan seperti Kahade Plus, bila tersedia, mengikuti harga, periode, manfaat, pembaruan, dan pembatalan yang ditampilkan sebelum pembelian."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "22.2. Pembaruan otomatis hanya dilakukan dengan persetujuan yang sah dan sarana pembatalan yang wajar. Perubahan harga berlaku untuk periode berikutnya setelah pemberitahuan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "22.3. Manfaat yang bergantung pada pihak ketiga, kuota, wilayah, atau status Akun dapat berubah secara proporsional. Apabila perubahan material mengurangi manfaat yang telah dibayar, Kahade menyediakan solusi yang diwajibkan hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "22.4. Pengembalian biaya langganan mengikuti penggunaan, alasan pembatalan, ketentuan toko aplikasi atau mitra, dan hak konsumen yang tidak dapat dikesampingkan."
                }
              ]
            }
          ]
        },
        {
          "id": "23-asuransi-dan-layanan-pihak-ketiga",
          "title": "23. Asuransi dan layanan pihak ketiga",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "23.1. Jika perlindungan asuransi ditawarkan, penanggung, polis, premi, manfaat, risiko, pengecualian, dan prosedur klaim harus dibaca sebelum ikut serta."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "23.2. Kahade dapat bertindak sebagai penghubung teknologi, bukan penanggung. Keputusan klaim berada pada pihak yang berwenang berdasarkan polis, dengan hak Pengguna mengajukan keluhan sesuai prosedur."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "23.3. Tautan, peta, kurir, pembayaran, analitik, autentikasi, cloud, toko aplikasi, dan layanan pihak ketiga tunduk pada syarat mereka. Kahade bertanggung jawab atas pemilihan dan pengelolaan penyedia sejauh diwajibkan hukum, tetapi tidak mengendalikan seluruh sistem pihak ketiga."
                }
              ]
            }
          ]
        },
        {
          "id": "24-ketersediaan-dan-perubahan-layanan",
          "title": "24. Ketersediaan dan perubahan Layanan",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "24.1. Kahade berupaya menjaga Layanan aman dan tersedia, tetapi pemeliharaan, pembaruan, gangguan jaringan, bencana, serangan, atau kegagalan pihak ketiga dapat terjadi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "24.2. Fitur dapat ditambah, diubah, dibatasi, atau dihentikan untuk keamanan, hukum, kualitas, atau kebutuhan bisnis. Perubahan material yang merugikan hak berjalan diberi pemberitahuan yang wajar dan mekanisme penyelesaian."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "24.3. Pengguna harus memakai versi aplikasi yang didukung. Kahade dapat memblokir versi yang rentan, perangkat di-root/jailbreak berisiko, atau integrasi tidak resmi."
                }
              ]
            }
          ]
        },
        {
          "id": "25-pembatasan-penangguhan-dan-penghentian-akun",
          "title": "25. Pembatasan, penangguhan, dan penghentian Akun",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "25.1. Kahade dapat memberi peringatan, membatasi konten atau fitur, menahan tindakan berisiko, menangguhkan, atau menghentikan Akun berdasarkan pelanggaran, risiko, putusan, atau kewajiban hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "25.2. Tindakan mempertimbangkan tingkat pelanggaran, dampak, riwayat, niat, potensi kerugian, dan kebutuhan menjaga pengguna lain. Pelanggaran berat seperti penipuan, eksploitasi anak, serangan sistem, atau pencucian uang dapat ditindak segera."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "25.3. Jika diizinkan, Pengguna memperoleh alasan umum dan kanal keberatan. Kahade dapat meminta verifikasi ulang atau tindakan perbaikan sebelum memulihkan akses."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "25.4. Penangguhan tidak menghapus kewajiban Transaksi. Kahade dapat mempertahankan akses terbatas ke riwayat, sengketa, penarikan dana sah, ekspor data, atau dukungan sejauh aman dan diwajibkan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "25.5. Pengguna tidak boleh membuat Akun baru untuk menghindari pembatasan. Akun terkait dapat ditinjau berdasarkan indikator teknis dan bukti yang proporsional."
                }
              ]
            }
          ]
        },
        {
          "id": "26-penghapusan-akun",
          "title": "26. Penghapusan Akun",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "26.1. Pengguna dapat meminta penghapusan melalui fitur yang tersedia setelah verifikasi sensitif. Permintaan tidak dapat diproses sampai pesanan dan Sengketa selesai, saldo tersedia ditarik, dana escrow terselesaikan, serta penarikan tidak lagi diproses."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "26.2. Setelah permintaan diterima, profil dapat disembunyikan dan berlaku masa tenggang 30 hari. Selama masa ini Pengguna dapat membatalkan sesuai mekanisme verifikasi yang tersedia."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "26.3. Setelah masa tenggang, data akan dihapus, dianonimkan, atau dibatasi sesuai Kebijakan Privasi. Catatan tertentu tetap disimpan jika diperlukan untuk transaksi, pajak, akuntansi, audit, keamanan, pencegahan fraud, penegakan kontrak, Sengketa, atau perintah hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "26.4. Legal hold dapat menunda penghapusan bagian data yang terkait. Penundaan tidak boleh dipakai untuk tujuan baru yang tidak sesuai."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "26.5. Konten yang telah dibagikan atau dikutip oleh Pengguna lain mungkin tetap ada dalam konteks percakapan, bukti, atau catatan mereka, dengan identitas diminimalkan jika layak."
                }
              ]
            }
          ]
        },
        {
          "id": "27-bukti-elektronik-dan-komunikasi",
          "title": "27. Bukti elektronik dan komunikasi",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "27.1. Pengguna menyetujui penggunaan catatan elektronik, tanda persetujuan, OTP, PIN, passkey, log sistem, stempel waktu, IP, perangkat, lokasi tindakan, dan riwayat status sebagai bukti, tanpa menghilangkan hak untuk membantah akurasi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "27.2. Pemberitahuan dapat dikirim melalui aplikasi, push notification, WhatsApp, email, SMS, atau kanal lain yang didaftarkan. Pesan keamanan dan transaksi tidak selalu dapat dinonaktifkan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "27.3. Pengguna wajib memastikan kanal kontak dapat diakses. Pemberitahuan dianggap diterima saat tersedia pada Akun atau berhasil dikirim, kecuali Pengguna membuktikan gangguan yang bukan kesalahannya."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "27.4. Bahasa Indonesia menjadi bahasa pengendali. Terjemahan disediakan untuk kemudahan dan tidak menggantikan naskah Bahasa Indonesia."
                }
              ]
            }
          ]
        },
        {
          "id": "28-jaminan-tanggung-jawab-dan-ganti-rugi",
          "title": "28. Jaminan, tanggung jawab, dan ganti rugi",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "28.1. Kahade menyediakan Layanan dengan kehati-hatian yang wajar dan tidak mengecualikan tanggung jawab yang tidak boleh dikecualikan berdasarkan hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "28.2. Sejauh diizinkan hukum, Kahade tidak menjamin hasil ekonomi, kualitas atau legalitas barang pihak lain, kecocokan setiap Pengguna, atau bebasnya internet dan perangkat dari gangguan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "28.3. Kahade bertanggung jawab atas kerugian langsung yang terbukti timbul dari kesengajaan atau kelalaian Kahade, dengan mempertimbangkan kontribusi kesalahan pihak lain, mitigasi, dan hukum. Batas tanggung jawab kontraktual tidak berlaku untuk fraud, kesengajaan, pelanggaran data yang menjadi tanggung jawab Kahade, kematian/cedera karena kelalaian, atau hak konsumen yang tidak dapat dibatasi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "28.4. Sejauh diizinkan hukum, kerugian tidak langsung, kehilangan peluang, laba, reputasi, atau data yang tidak dapat diperkirakan secara wajar tidak menjadi tanggung jawab Kahade."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "28.5. Pengguna bertanggung jawab atas kerugian yang timbul dari pelanggaran hukum, pelanggaran hak pihak lain, barang ilegal, informasi palsu, atau penyalahgunaan Akun. Kewajiban mengganti kerugian harus proporsional, terbukti, dan tidak mencakup kesalahan Kahade."
                }
              ]
            }
          ]
        },
        {
          "id": "29-keadaan-kahar",
          "title": "29. Keadaan kahar",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "29.1. Pihak tidak bertanggung jawab atas keterlambatan yang secara langsung disebabkan peristiwa di luar kendali wajar, seperti bencana, perang, kerusuhan, wabah, tindakan pemerintah, gangguan luas telekomunikasi, kegagalan sistem pembayaran, atau serangan siber besar."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "29.2. Pihak terdampak wajib mengambil langkah wajar untuk mengurangi dampak dan melanjutkan kewajiban yang masih dapat dilakukan. Kewajiban pembayaran yang telah jatuh tempo tidak otomatis hapus."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "29.3. Jika keadaan berlangsung berkepanjangan dan tujuan Transaksi tidak dapat tercapai, para pihak atau Kahade dapat menyelesaikan Transaksi dengan pengembalian atau pelepasan yang adil berdasarkan status barang dan dana."
                }
              ]
            }
          ]
        },
        {
          "id": "30-pengaduan-dan-penyelesaian-perselisihan",
          "title": "30. Pengaduan dan penyelesaian perselisihan",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "30.1. Pengguna dapat menghubungi Chat CS di aplikasi dan memberikan ID Transaksi, kronologi, tuntutan, serta bukti. Kahade akan memberi nomor atau jejak penanganan bila fitur tersedia."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "30.2. Para pihak terlebih dahulu berupaya bermusyawarah dengan itikad baik. Penggunaan dukungan Kahade tidak membatasi pengaduan kepada regulator, lembaga perlindungan konsumen, atau aparat."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "30.3. Syarat ini tunduk pada hukum Republik Indonesia. Sengketa yang tidak selesai dapat diajukan kepada forum yang berwenang, termasuk Badan Penyelesaian Sengketa Konsumen atau pengadilan sesuai kompetensi dan hak konsumen."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "30.4. Pilihan forum tidak boleh menghalangi Pengguna menggugat di tempat yang diwajibkan atau diizinkan hukum perlindungan konsumen."
                }
              ]
            }
          ]
        },
        {
          "id": "31-perubahan-syarat-ketentuan",
          "title": "31. Perubahan Syarat & Ketentuan",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "31.1. Kahade dapat memperbarui ketentuan untuk perubahan hukum, keamanan, fitur, mitra, atau model operasional. Tanggal versi dan ringkasan perubahan material akan tersedia."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "31.2. Perubahan material diberitahukan sebelum berlaku dalam jangka waktu wajar. Persetujuan ulang diminta jika diwajibkan atau jika perubahan bergantung pada persetujuan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "31.3. Perubahan tidak berlaku surut untuk mengurangi hak yang telah timbul. Jika Pengguna tidak setuju, Pengguna dapat berhenti menggunakan fitur terkait dan menutup Akun setelah kewajiban diselesaikan."
                }
              ]
            }
          ]
        },
        {
          "id": "32-ketentuan-umum",
          "title": "32. Ketentuan umum",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "32.1. Jika klausul tidak sah, bagian lain tetap berlaku dan klausul ditafsirkan sedekat mungkin dengan tujuan sahnya."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "32.2. Kegagalan menegakkan hak sekali tidak berarti pelepasan hak. Pengguna tidak dapat mengalihkan perjanjian tanpa persetujuan; Kahade dapat mengalihkan dalam restrukturisasi yang tidak mengurangi hak Pengguna dan dengan pemberitahuan yang sesuai."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "32.3. Tidak ada hubungan kemitraan, keagenan, kerja, fidusia umum, atau usaha patungan antara Kahade dan Pengguna, kecuali secara tegas dibuat terpisah."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "32.4. Syarat ini, ketentuan khusus, dan pemberitahuan transaksi merupakan keseluruhan kesepakatan mengenai Layanan, tanpa meniadakan representasi yang menurut hukum tidak boleh dikecualikan."
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "lampiran-a-matriks-kategori-data-dan-retensi",
      "title": "LAMPIRAN A — MATRIKS KATEGORI DATA DAN RETENSI",
      "sections": [
        {
          "id": "lampiran-a-matriks-kategori-data-dan-retensi-2",
          "title": "LAMPIRAN A — MATRIKS KATEGORI DATA DAN RETENSI",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Lampiran ini memberi gambaran operasional. Masa simpan aktual mengikuti tujuan, kewajiban hukum, status Transaksi, Sengketa, legal hold, dan jadwal retensi internal yang disahkan."
                }
              ]
            }
          ]
        },
        {
          "id": "a-1-akun-dan-profil",
          "title": "A.1. Akun dan profil",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Elemen data:",
                  "bold": true
                },
                {
                  "text": " ID Pengguna, nama, username, telepon, email, tanggal lahir, gender, bio, avatar, header, bahasa, alamat, dan pengaturan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Tujuan:",
                  "bold": true
                },
                {
                  "text": " registrasi, autentikasi, profil, komunikasi, pemulihan, personalisasi, dan keamanan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Dasar:",
                  "bold": true
                },
                {
                  "text": " kontrak, kewajiban hukum, kepentingan sah, dan persetujuan untuk data opsional."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Penerima:",
                  "bold": true
                },
                {
                  "text": " penyedia hosting, komunikasi, verifikasi, dan pihak yang melihat profil sesuai pengaturan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Retensi:",
                  "bold": true
                },
                {
                  "text": " selama Akun aktif; setelah penghapusan, elemen yang tidak diwajibkan dihapus atau dianonimkan setelah masa tenggang dan siklus cadangan."
                }
              ]
            }
          ]
        },
        {
          "id": "a-2-kredensial-dan-keamanan",
          "title": "A.2. Kredensial dan keamanan",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Elemen data:",
                  "bold": true
                },
                {
                  "text": " hash kata sandi, PIN terlindungi, passkey public credential, 2FA, sesi, OTP, perangkat, IP, percobaan login, CAPTCHA, dan log risiko."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Tujuan:",
                  "bold": true
                },
                {
                  "text": " autentikasi, pencegahan pengambilalihan, pembatasan serangan, dan audit."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Dasar:",
                  "bold": true
                },
                {
                  "text": " kontrak, kepentingan sah, dan kewajiban keamanan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Penerima:",
                  "bold": true
                },
                {
                  "text": " penyedia keamanan dan komunikasi hanya sejauh perlu."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Retensi:",
                  "bold": true
                },
                {
                  "text": " OTP dan sesi sesingkat yang diperlukan; log keamanan lebih lama jika terkait insiden atau penegakan."
                }
              ]
            }
          ]
        },
        {
          "id": "a-3-lokasi-tindakan",
          "title": "A.3. Lokasi tindakan",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Elemen data:",
                  "bold": true
                },
                {
                  "text": " lintang, bujur, akurasi, waktu, IP, perangkat, dan jenis tindakan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Tujuan:",
                  "bold": true
                },
                {
                  "text": " mendeteksi aktivitas tidak wajar dan melindungi perubahan berisiko."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Dasar:",
                  "bold": true
                },
                {
                  "text": " persetujuan izin perangkat, kepentingan sah, atau keamanan kontrak sesuai konteks."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Penerima:",
                  "bold": true
                },
                {
                  "text": " personel keamanan, penyedia lokasi terbatas, dan otoritas jika sah."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Retensi:",
                  "bold": true
                },
                {
                  "text": " dibatasi pada jangka keamanan; diperpanjang hanya untuk insiden, Sengketa, atau kewajiban hukum."
                }
              ]
            }
          ]
        },
        {
          "id": "a-4-kyc-dan-verifikasi-usaha",
          "title": "A.4. KYC dan verifikasi usaha",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Elemen data:",
                  "bold": true
                },
                {
                  "text": " identitas, foto dokumen, swafoto/liveness, hasil kecocokan, status, rekening, data usaha, dan pemilik manfaat."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Tujuan:",
                  "bold": true
                },
                {
                  "text": " kelayakan fitur, pencegahan fraud, kepatuhan, dan penyelesaian dana."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Dasar:",
                  "bold": true
                },
                {
                  "text": " kontrak, kewajiban hukum, serta persetujuan eksplisit jika diperlukan untuk biometrik."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Penerima:",
                  "bold": true
                },
                {
                  "text": " penyedia verifikasi, pembayaran, bank, auditor, dan otoritas."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Retensi:",
                  "bold": true
                },
                {
                  "text": " selama hubungan dan masa wajib setelahnya; data mentah diminimalkan jika hasil verifikasi cukup."
                }
              ]
            }
          ]
        },
        {
          "id": "a-5-pembayaran-dompet-dan-escrow",
          "title": "A.5. Pembayaran, Dompet, dan escrow",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Elemen data:",
                  "bold": true
                },
                {
                  "text": " sumber/metode dana, reference, rekening, nominal, biaya, saldo, status, refund, penarikan, transfer, chargeback, dan rekonsiliasi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Tujuan:",
                  "bold": true
                },
                {
                  "text": " pelaksanaan pembayaran, akuntansi, penyelesaian, pencegahan fraud, dan kewajiban hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Dasar:",
                  "bold": true
                },
                {
                  "text": " kontrak dan kewajiban hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Penerima:",
                  "bold": true
                },
                {
                  "text": " bank, penyedia pembayaran, akuntan, auditor, dan otoritas."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Retensi:",
                  "bold": true
                },
                {
                  "text": " sesuai kewajiban transaksi, akuntansi, pajak, pencucian uang, Sengketa, dan pembelaan klaim."
                }
              ]
            }
          ]
        },
        {
          "id": "a-6-pesanan-dan-pengiriman",
          "title": "A.6. Pesanan dan pengiriman",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Elemen data:",
                  "bold": true
                },
                {
                  "text": " pihak, objek, harga, alamat, penerima, kurir, resi, status, bukti, retur, dan penukaran."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Tujuan:",
                  "bold": true
                },
                {
                  "text": " pemenuhan Transaksi, pelacakan, dukungan, Sengketa, dan keamanan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Dasar:",
                  "bold": true
                },
                {
                  "text": " kontrak, kewajiban hukum, dan kepentingan sah."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Penerima:",
                  "bold": true
                },
                {
                  "text": " pihak Transaksi, kurir, integrator, pembayaran, dan CS."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Retensi:",
                  "bold": true
                },
                {
                  "text": " selama dibutuhkan untuk pemenuhan, garansi, sengketa, pencatatan, dan tuntutan."
                }
              ]
            }
          ]
        },
        {
          "id": "a-7-konten-sosial-dan-etalase",
          "title": "A.7. Konten sosial dan etalase",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Elemen data:",
                  "bold": true
                },
                {
                  "text": " etalase, media, komentar, like, Utas, follow, simpan, laporan, rating, dan ulasan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Tujuan:",
                  "bold": true
                },
                {
                  "text": " publikasi, interaksi, rekomendasi, moderasi, dan transaksi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Dasar:",
                  "bold": true
                },
                {
                  "text": " kontrak, persetujuan untuk publikasi tertentu, dan kepentingan sah."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Penerima:",
                  "bold": true
                },
                {
                  "text": " audiens sesuai visibilitas, penyedia hosting/moderasi, dan penerima tautan berbagi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Retensi:",
                  "bold": true
                },
                {
                  "text": " selama aktif; etalase terhapus memiliki pemulihan 30 hari; bukti moderasi dapat dipertahankan lebih lama."
                }
              ]
            }
          ]
        },
        {
          "id": "a-8-chat-dan-dukungan",
          "title": "A.8. Chat dan dukungan",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Elemen data:",
                  "bold": true
                },
                {
                  "text": " pesan, lampiran, reaksi, peserta, status baca, tiket, jawaban, dan rekaman keputusan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Tujuan:",
                  "bold": true
                },
                {
                  "text": " komunikasi, transaksi, sengketa, dukungan, keselamatan, dan audit."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Dasar:",
                  "bold": true
                },
                {
                  "text": " kontrak, kepentingan sah, dan kewajiban hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Penerima:",
                  "bold": true
                },
                {
                  "text": " peserta, admin berwenang, penyedia komunikasi, serta otoritas jika sah."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Retensi:",
                  "bold": true
                },
                {
                  "text": " sesuai konteks komunikasi; chat Transaksi dan Sengketa dapat mengikuti retensi catatan Transaksi."
                }
              ]
            }
          ]
        },
        {
          "id": "a-9-analitik-dan-diagnostik",
          "title": "A.9. Analitik dan diagnostik",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Elemen data:",
                  "bold": true
                },
                {
                  "text": " peristiwa penggunaan, performa, crash, versi aplikasi, referer, dan metrik agregat."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Tujuan:",
                  "bold": true
                },
                {
                  "text": " stabilitas, kualitas, kapasitas, dan evaluasi fitur."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Dasar:",
                  "bold": true
                },
                {
                  "text": " kepentingan sah atau persetujuan bila diwajibkan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Penerima:",
                  "bold": true
                },
                {
                  "text": " penyedia analitik dan teknis dengan pembatasan tujuan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Retensi:",
                  "bold": true
                },
                {
                  "text": " periode singkat atau dalam bentuk agregat/pseudonim; data anonim dapat disimpan lebih lama."
                }
              ]
            }
          ]
        },
        {
          "id": "a-10-audit-dan-kepatuhan",
          "title": "A.10. Audit dan kepatuhan",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Elemen data:",
                  "bold": true
                },
                {
                  "text": " perubahan status, tindakan admin, persetujuan, versi kebijakan, legal hold, hasil investigasi, dan permintaan otoritas."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Tujuan:",
                  "bold": true
                },
                {
                  "text": " akuntabilitas, keamanan, pembuktian, dan kepatuhan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Dasar:",
                  "bold": true
                },
                {
                  "text": " kewajiban hukum dan kepentingan sah."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Penerima:",
                  "bold": true
                },
                {
                  "text": " personel berwenang, auditor, penasihat, dan otoritas."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Retensi:",
                  "bold": true
                },
                {
                  "text": " selama diperlukan untuk audit, pembelaan klaim, dan periode wajib; akses sangat dibatasi."
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "lampiran-b-standar-komunitas-dan-perdagangan",
      "title": "LAMPIRAN B — STANDAR KOMUNITAS DAN PERDAGANGAN",
      "sections": [
        {
          "id": "b-1-keaslian-dan-integritas",
          "title": "B.1. Keaslian dan integritas",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Pengguna harus menjadi diri sendiri atau mewakili entitas secara sah. Dilarang membuat identitas palsu, badge palsu, testimoni rekaan, transaksi semu, akun massal, atau koordinasi untuk menaikkan metrik. Parodi atau nama kreatif boleh sepanjang tidak menipu mengenai identitas dan tidak melanggar hak."
                }
              ]
            }
          ]
        },
        {
          "id": "b-2-keselamatan-dan-martabat",
          "title": "B.2. Keselamatan dan martabat",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Ancaman kredibel, ajakan kekerasan, eksploitasi, pemerasan, pelecehan berulang, doxing, perdagangan manusia, dan konten seksual yang melibatkan anak dilarang. Konten dokumenter untuk pelaporan harus dibatasi pada kebutuhan dan dikirim melalui kanal aman, bukan dipublikasikan."
                }
              ]
            }
          ]
        },
        {
          "id": "b-3-penipuan-dan-rekayasa-sosial",
          "title": "B.3. Penipuan dan rekayasa sosial",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Dilarang meminta OTP, PIN, kata sandi, kode pemulihan, remote access, atau pembayaran di luar alur. Dilarang menyamar sebagai Kahade, bank, kurir, pemerintah, CS, atau pengguna lain. Tautan pendek, file executable, QR yang tidak dijelaskan, dan instruksi mematikan keamanan dapat ditolak."
                }
              ]
            }
          ]
        },
        {
          "id": "b-4-kekayaan-intelektual",
          "title": "B.4. Kekayaan intelektual",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Hanya tawarkan barang asli atau barang yang secara jujur dijelaskan. Dilarang menjual barang palsu, lisensi ilegal, akses bajakan, salinan tanpa hak, atau jasa yang melanggar hak cipta, merek, paten, desain industri, rahasia dagang, dan hak terkait."
                }
              ]
            }
          ]
        },
        {
          "id": "b-5-privasi",
          "title": "B.5. Privasi",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Dilarang menjual, membeli, membocorkan, atau mencari Data Pribadi secara tidak sah. Dokumen identitas, alamat rumah, nomor telepon, lokasi presisi, nomor rekening, rekam medis, dan data anak tidak boleh diposting di ruang publik. Bukti Sengketa harus disunting pada bagian yang tidak relevan."
                }
              ]
            }
          ]
        },
        {
          "id": "b-6-produk-terlarang",
          "title": "B.6. Produk terlarang",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Kategori berikut dilarang, termasuk upaya menyamarkan namanya:"
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Narkotika, psikotropika, prekursor, atau obat ilegal."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Senjata api, amunisi, bahan peledak, atau komponen yang dilarang."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Manusia, organ, jaringan biologis, atau jasa eksploitasi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Materi eksploitasi seksual anak atau konten intim tanpa persetujuan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Barang curian, hasil kejahatan, atau sarana pencucian uang."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Kredensial, akun, database, malware, exploit, jasa peretasan, atau akses tanpa hak."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Alat bayar, identitas, dokumen pemerintah, ijazah, sertifikat, resep, atau surat palsu."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Barang palsu atau penggunaan merek tanpa hak."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Perjudian, taruhan, skema piramida, ponzi, atau investasi tanpa izin."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Barang/jasa lain yang dilarang hukum atau ditetapkan Kahade karena risiko berat."
                }
              ]
            }
          ]
        },
        {
          "id": "b-7-produk-dibatasi",
          "title": "B.7. Produk dibatasi",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Produk berizin atau berisiko hanya boleh ditawarkan setelah verifikasi yang diperlukan. Ini dapat mencakup obat dan alat kesehatan; pangan, kosmetik, alkohol dan tembakau; bahan kimia; produk dewasa; hewan atau tumbuhan; tiket; jasa keuangan; aset digital; jasa profesional; barang antik; serta produk impor. Kahade dapat meminta nomor izin, label, sertifikat, verifikasi usia, atau bukti asal."
                }
              ]
            }
          ]
        },
        {
          "id": "b-8-informasi-produk",
          "title": "B.8. Informasi produk",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Judul, kategori, merek, kondisi, ukuran, bahan, fungsi, risiko, garansi, lokasi, harga, stok, dan estimasi harus akurat. Foto stok harus ditandai jika tidak menggambarkan unit aktual. Cacat material wajib diperlihatkan. Klaim \"resmi\", \"asli\", \"terverifikasi\", \"aman\", atau \"pasti\" harus dapat dibuktikan."
                }
              ]
            }
          ]
        },
        {
          "id": "b-9-harga-dan-promosi",
          "title": "B.9. Harga dan promosi",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Harga tidak boleh menipu melalui diskon palsu, biaya tersembunyi, pembatalan berulang untuk menaikkan harga, atau syarat yang baru diungkap setelah pembayaran. Kelangkaan, hitung mundur, hadiah, dan testimoni tidak boleh direkayasa."
                }
              ]
            }
          ]
        },
        {
          "id": "b-10-komunikasi-yang-diperbolehkan",
          "title": "B.10. Komunikasi yang diperbolehkan",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Negosiasi, klarifikasi, dukungan, dan kritik yang jujur diperbolehkan. Kritik tidak boleh berubah menjadi penghinaan, ancaman, penyebaran data pribadi, atau kampanye massal. Pengguna harus membedakan fakta, pendapat, dan dugaan."
                }
              ]
            }
          ]
        },
        {
          "id": "b-11-ulasan-yang-dapat-dipercaya",
          "title": "B.11. Ulasan yang dapat dipercaya",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Ulasan harus berasal dari pengalaman nyata dan menilai aspek relevan. Dilarang ulasan berbayar yang tidak diungkapkan, ulasan balasan untuk memaksa, ulasan oleh pemilik sendiri, atau menyertakan data pribadi. Kahade dapat menandai ulasan terkait Transaksi terverifikasi."
                }
              ]
            }
          ]
        },
        {
          "id": "b-12-penegakan",
          "title": "B.12. Penegakan",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Tindakan dapat berupa pengurangan distribusi, label, penghapusan, pembatasan chat, pembekuan etalase, pembatalan transaksi, penahanan manfaat promo, verifikasi ulang, suspensi, atau penghentian. Tindakan disesuaikan dengan risiko dan tidak menggantikan proses hukum."
                }
              ]
            }
          ]
        },
        {
          "id": "b-13-laporan-dan-banding",
          "title": "B.13. Laporan dan banding",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Laporan harus memilih kategori, lokasi konten, uraian, dan bukti. Pelapor tidak otomatis mengetahui hasil terperinci karena privasi pihak lain. Pihak yang ditindak dapat mengajukan banding dengan alasan dan bukti baru. Pelaporan massal palsu merupakan pelanggaran."
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "lampiran-c-prosedur-sengketa-dan-bukti",
      "title": "LAMPIRAN C — PROSEDUR SENGKETA DAN BUKTI",
      "sections": [
        {
          "id": "c-1-sebelum-membuka-sengketa",
          "title": "C.1. Sebelum membuka Sengketa",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Pihak yang menemukan masalah sebaiknya menghentikan tindakan yang memperbesar kerugian, mendokumentasikan kondisi, memeriksa detail, dan menghubungi pihak lawan melalui chat Transaksi. Pembeli tidak boleh menekan konfirmasi penerimaan; Penjual tidak boleh menghapus informasi material."
                }
              ]
            }
          ]
        },
        {
          "id": "c-2-pembukaan",
          "title": "C.2. Pembukaan",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Sengketa diajukan dari Transaksi dengan kategori, kronologi, hasil yang diminta, dan bukti. Sistem mencatat waktu dan menahan pelepasan dana sesuai status. Pengajuan yang terlambat dapat dipertimbangkan jika ada alasan sah dan sistem belum menyelesaikan dana secara final."
                }
              ]
            }
          ]
        },
        {
          "id": "c-3-bukti-yang-relevan",
          "title": "C.3. Bukti yang relevan",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Bukti ideal menunjukkan siapa, apa, kapan, dan keterkaitannya dengan Transaksi. Contohnya:"
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Video pembukaan paket yang berkesinambungan dan memperlihatkan label."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Foto kondisi, segel, nomor seri, ukuran, atau fungsi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Resi dan status dari kurir resmi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Chat dalam Kahade mengenai spesifikasi atau perubahan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Dokumen pemeriksaan dari pihak kompeten."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Bukti penyerahan jasa atau produk digital."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Estimasi dan kuitansi biaya perbaikan yang wajar."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Metadata bukan satu-satunya penentu dan dapat diverifikasi terhadap catatan sistem."
                }
              ]
            }
          ]
        },
        {
          "id": "c-4-bukti-yang-dilarang",
          "title": "C.4. Bukti yang dilarang",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Dilarang memalsukan, menyunting secara menyesatkan, merekayasa stempel waktu, menggunakan dokumen orang lain, memperoleh rekaman dengan melanggar hukum, menyuap saksi, atau mengancam pihak. Bukti yang berisi data pihak ketiga harus disunting."
                }
              ]
            }
          ]
        },
        {
          "id": "c-5-respons",
          "title": "C.5. Respons",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Pihak lawan diberi kesempatan menjawab dan mengajukan bukti tandingan. Jawaban harus menanggapi pokok klaim, bukan menyerang pribadi. Permintaan informasi dari admin harus dipenuhi dalam tenggat yang tampil; perpanjangan dapat diminta dengan alasan."
                }
              ]
            }
          ]
        },
        {
          "id": "c-6-penyelesaian-bersama",
          "title": "C.6. Penyelesaian bersama",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Para pihak dapat mengusulkan refund penuh, refund sebagian, retur, penggantian, perbaikan, pelepasan dana, atau pembagian biaya. Kesepakatan baru mengikat secara operasional setelah dikonfirmasi dalam alur yang tersedia; jangan hanya mengandalkan chat informal."
                }
              ]
            }
          ]
        },
        {
          "id": "c-7-penilaian",
          "title": "C.7. Penilaian",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Admin mempertimbangkan kontrak elektronik, materialitas perbedaan, kondisi sebelum dan sesudah pengiriman, kewajaran perilaku, sebab kerusakan, bukti kurir, kepatuhan tenggat, serta hak konsumen. Jumlah pengikut, badge, atau nilai transaksi masa lalu tidak boleh menggantikan bukti kasus."
                }
              ]
            }
          ]
        },
        {
          "id": "c-8-keputusan-dan-eksekusi",
          "title": "C.8. Keputusan dan eksekusi",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Keputusan memuat hasil, alasan pokok yang dapat dibagikan, pembagian dana, kewajiban retur/penukaran, biaya, dan langkah berikut. Pelaksanaan dapat menunggu pengiriman balik atau verifikasi. Catatan dibuat agar dapat diaudit."
                }
              ]
            }
          ]
        },
        {
          "id": "c-9-keberatan",
          "title": "C.9. Keberatan",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Jika fitur banding tersedia, keberatan harus menunjuk kesalahan fakta, bukti baru yang tidak dapat diajukan sebelumnya, konflik kepentingan, atau pelanggaran prosedur. Ketidaksetujuan tanpa alasan baru tidak otomatis membuka ulang."
                }
              ]
            }
          ]
        },
        {
          "id": "c-10-hubungan-dengan-kurir-pembayaran-dan-otorit",
          "title": "C.10. Hubungan dengan kurir, pembayaran, dan otoritas",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Klaim kurir atau chargeback dapat berjalan bersamaan tetapi harus diberitahukan agar tidak terjadi pemulihan ganda. Kahade dapat menunggu hasil, berbagi bukti minimum, atau menyesuaikan keputusan. Proses internal tidak menghalangi laporan kepada otoritas."
                }
              ]
            }
          ]
        },
        {
          "id": "c-11-perlindungan-dana-dan-data",
          "title": "C.11. Perlindungan dana dan data",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Selama Sengketa, hanya nilai yang relevan yang seharusnya ditahan kecuali risiko meluas dapat dibuktikan. Akses bukti dibatasi. Dokumen identitas dan data keuangan tidak ditampilkan kepada pihak lain kecuali perlu dan sah."
                }
              ]
            }
          ]
        },
        {
          "id": "c-12-konflik-kepentingan",
          "title": "C.12. Konflik kepentingan",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Admin yang memiliki hubungan dengan pihak atau kepentingan pada hasil harus mengundurkan diri. Akses, perubahan status, dan keputusan dicatat. Dugaan konflik dapat dilaporkan melalui CS."
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "lampiran-d-glosarium",
      "title": "LAMPIRAN D — GLOSARIUM",
      "sections": [
        {
          "id": "lampiran-d-glosarium-2",
          "title": "LAMPIRAN D — GLOSARIUM",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Admin:",
                  "bold": true
                },
                {
                  "text": " personel berwenang yang menjalankan dukungan, moderasi, verifikasi, Sengketa, atau operasi sesuai peran."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Data Pribadi:",
                  "bold": true
                },
                {
                  "text": " data tentang orang perseorangan yang teridentifikasi atau dapat diidentifikasi, sendiri atau digabung dengan informasi lain."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Data Pribadi spesifik:",
                  "bold": true
                },
                {
                  "text": " kategori berisiko tinggi menurut hukum, termasuk data biometrik, data anak, dan data keuangan pribadi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Escrow balance:",
                  "bold": true
                },
                {
                  "text": " bagian saldo yang terkait Transaksi dan belum tersedia untuk ditarik atau digunakan bebas."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Hard delete:",
                  "bold": true
                },
                {
                  "text": " penghapusan permanen dari sistem aktif setelah masa pemulihan, dengan pengecualian backup, legal hold, dan retensi wajib."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "ID Transaksi:",
                  "bold": true
                },
                {
                  "text": " pengenal unik untuk suatu Transaksi; berbeda dari ID struk, reference pembayaran, atau nomor resi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "KYC:",
                  "bold": true
                },
                {
                  "text": " proses untuk mengenali dan memverifikasi identitas Pengguna serta menilai informasi yang diperlukan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Legal hold:",
                  "bold": true
                },
                {
                  "text": " pembatasan penghapusan karena Sengketa, investigasi, audit, tuntutan, atau kewajiban hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Mitra:",
                  "bold": true
                },
                {
                  "text": " pihak ketiga yang membantu pembayaran, bank, kurir, verifikasi, komunikasi, keamanan, penyimpanan, analitik, asuransi, atau fungsi lain."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Pemrosesan:",
                  "bold": true
                },
                {
                  "text": " setiap tindakan terhadap Data Pribadi, termasuk memperoleh, menyimpan, menggunakan, mengungkapkan, memperbarui, membatasi, menghapus, atau memusnahkan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Pembeli:",
                  "bold": true
                },
                {
                  "text": " Pengguna yang membuat atau membiayai pesanan barang/jasa."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Penjual:",
                  "bold": true
                },
                {
                  "text": " Pengguna yang menawarkan dan memenuhi barang/jasa."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Pengendali Data Pribadi:",
                  "bold": true
                },
                {
                  "text": " pihak yang menentukan tujuan dan kendali pemrosesan Data Pribadi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Prosesor Data Pribadi:",
                  "bold": true
                },
                {
                  "text": " pihak yang memproses Data Pribadi atas nama Pengendali."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Saldo tersedia:",
                  "bold": true
                },
                {
                  "text": " nilai yang menurut catatan sistem dapat digunakan atau ditarik setelah memperhitungkan pembatasan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Soft delete:",
                  "bold": true
                },
                {
                  "text": " penghapusan dari tampilan aktif dengan masa pemulihan sebelum penghapusan permanen."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Transaksi berisiko tinggi:",
                  "bold": true
                },
                {
                  "text": " tindakan yang karena nilai, pola, perangkat, lokasi, penerima, atau dampaknya memerlukan autentikasi atau pemeriksaan tambahan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Utas:",
                  "bold": true
                },
                {
                  "text": " rangkaian pertanyaan, jawaban, atau balasan yang terhubung pada profil atau fitur komunitas."
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "referensi-hukum-resmi",
      "title": "REFERENSI HUKUM RESMI",
      "sections": [
        {
          "id": "referensi-hukum-resmi-2",
          "title": "REFERENSI HUKUM RESMI",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Naskah ini disusun dengan memperhatikan kerangka hukum Indonesia berikut. Daftar ini bukan pernyataan bahwa hanya aturan ini yang berlaku dan harus diperbarui saat publikasi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.",
                  "bold": true
                },
                {
                  "text": " Mengatur jenis data, hak Subjek Data, dasar dan tata kelola pemrosesan, kewajiban Pengendali/Prosesor, transfer, sanksi, dan larangan. Sumber resmi:"
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Undang-Undang Nomor 11 Tahun 2008 tentang Informasi dan Transaksi Elektronik beserta perubahan, terakhir Undang-Undang Nomor 1 Tahun 2024.",
                  "bold": true
                },
                {
                  "text": " Mengatur informasi, dokumen, kontrak, dan penyelenggaraan sistem elektronik. Sumber resmi:"
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Peraturan Pemerintah Nomor 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik.",
                  "bold": true
                },
                {
                  "text": " Mengatur penyelenggara sistem, tata kelola, keamanan, data, dan transaksi elektronik. Sumber resmi:"
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Peraturan Pemerintah Nomor 80 Tahun 2019 tentang Perdagangan Melalui Sistem Elektronik.",
                  "bold": true
                },
                {
                  "text": " Mengatur perdagangan elektronik, kontrak elektronik, pelaku usaha, konsumen, bukti, dan kewajiban platform. Sumber resmi:"
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Undang-Undang Nomor 8 Tahun 1999 tentang Perlindungan Konsumen.",
                  "bold": true
                },
                {
                  "text": " Mengatur hak dan kewajiban konsumen serta pelaku usaha dan penyelesaian sengketa. Sumber resmi:"
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Peraturan Menteri Perdagangan Nomor 31 Tahun 2023",
                  "bold": true
                },
                {
                  "text": " mengenai perizinan berusaha, periklanan, pembinaan, dan pengawasan pelaku usaha dalam PMSE. Sumber resmi pemerintah:"
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Peraturan Bank Indonesia Nomor 23/6/PBI/2021 tentang Penyedia Jasa Pembayaran.",
                  "bold": true
                },
                {
                  "text": " Relevan terhadap pihak yang menjalankan aktivitas penyediaan jasa pembayaran dan kerja sama dengan penyelenggara penunjang. Sumber resmi:"
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Undang-Undang Nomor 8 Tahun 2010 tentang Pencegahan dan Pemberantasan Tindak Pidana Pencucian Uang.",
                  "bold": true
                },
                {
                  "text": " Relevan terhadap deteksi, pembatasan, pencatatan, dan pelaporan aktivitas keuangan sesuai peran dan kewajiban masing-masing pihak. Sumber resmi:"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
