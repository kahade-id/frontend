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

export const PRIVACY_CONTENT: LegalDocData = {
  "title": "Kebijakan Privasi",
  "company": "PT Kawal Hak Dengan Aman",
  "versionLabel": "Versi 1.0",
  "effectiveLabel": "Disusun 27 September 2026 • Berlaku sejak publikasi resmi",
  "intro": [
    {
      "kind": "p",
      "segments": [
        {
          "text": "Kebijakan Privasi ini menjelaskan bagaimana PT Kawal Hak Dengan Aman (selanjutnya disebut “Kahade”, “kami”, atau “milik kami”) memperoleh, menggunakan, menyimpan, mengungkapkan, melindungi, dan menghapus Data Pribadi ketika Anda menggunakan aplikasi, situs web, fitur pengamanan dana transaksi, dompet, transaksi, etalase sosial-commerce, profil, percakapan, dukungan pelanggan, serta kanal resmi Kahade lainnya (secara bersama-sama disebut “Layanan”)."
        }
      ]
    },
    {
      "kind": "p",
      "segments": [
        {
          "text": "Kebijakan ini merupakan bagian yang tidak terpisahkan dari Syarat dan Ketentuan Kahade. Dengan membuat akun, mengakses, atau menggunakan Layanan, Anda menyatakan telah membaca Kebijakan ini. Apabila suatu pemrosesan memerlukan persetujuan berdasarkan hukum, kami akan meminta persetujuan melalui mekanisme yang sesuai. Persetujuan bukan satu-satunya dasar pemrosesan; untuk kegiatan tertentu kami dapat memproses data guna melaksanakan kontrak, memenuhi kewajiban hukum, melindungi kepentingan vital, menjalankan tugas untuk kepentingan umum, atau memenuhi kepentingan sah yang telah dinilai secara patut."
        }
      ]
    },
    {
      "kind": "p",
      "segments": [
        {
          "text": "Kebijakan ini disusun mengacu antara lain pada Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi dan Peraturan Pemerintah Nomor 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik. Apabila ketentuan hukum berubah, ketentuan yang berlaku akan diutamakan dan Kebijakan ini akan disesuaikan."
        }
      ]
    }
  ],
  "summary": {
    "title": "Ringkasan Utama",
    "paragraphs": [
      {
        "kind": "p",
        "segments": [
          {
            "text": "Data yang kami proses.",
            "bold": true
          },
          {
            "text": " Bergantung pada fitur yang Anda gunakan, data dapat meliputi nomor telepon, identitas akun, profil, dokumen verifikasi, selfie atau liveness, detail transaksi, saldo dan mutasi dompet, rekening bank, percakapan, bukti sengketa, konten etalase, interaksi sosial, lokasi, perangkat, alamat IP, log keamanan, serta preferensi."
          }
        ]
      },
      {
        "kind": "p",
        "segments": [
          {
            "text": "Mengapa data diproses.",
            "bold": true
          },
          {
            "text": " Tujuan utamanya adalah menyediakan Layanan; mengautentikasi pengguna; melaksanakan pengamanan dana transaksi, top up, penarikan, transfer, refund, dan rekonsiliasi; memverifikasi identitas; mencegah penipuan; menyelesaikan sengketa; memoderasi konten; mengirim notifikasi; memperbaiki Layanan; dan memenuhi kewajiban hukum."
          }
        ]
      },
      {
        "kind": "p",
        "segments": [
          {
            "text": "Siapa yang dapat menerima data.",
            "bold": true
          },
          {
            "text": " Data dapat diberikan secara terbatas kepada pihak lawan transaksi, penyedia pembayaran, bank, kurir, penyedia komunikasi, penyedia infrastruktur, pemeriksa profesional, dan instansi berwenang apabila diperlukan. Kami tidak menjual Data Pribadi sebagai komoditas."
          }
        ]
      },
      {
        "kind": "p",
        "segments": [
          {
            "text": "Kontrol Anda.",
            "bold": true
          },
          {
            "text": " Sesuai hukum, Anda dapat meminta akses, salinan, koreksi, pembaruan, penghentian pemrosesan tertentu, penarikan persetujuan, penghapusan atau pemusnahan, portabilitas, dan mengajukan keberatan. Beberapa permintaan dapat dibatasi oleh kewajiban hukum, keamanan, hak pihak lain, transaksi yang belum selesai, atau sengketa."
          }
        ]
      },
      {
        "kind": "p",
        "segments": [
          {
            "text": "Keamanan.",
            "bold": true
          },
          {
            "text": " Kami menggunakan pengamanan teknis dan organisasional berlapis. Tidak ada sistem yang sepenuhnya bebas risiko; karena itu kami juga menerapkan pemantauan, respons insiden, pencadangan, dan pembatasan akses."
          }
        ]
      },
      {
        "kind": "p",
        "segments": [
          {
            "text": "Kontak.",
            "bold": true
          },
          {
            "text": " Permintaan privasi dapat diajukan melalui fitur bantuan atau Chat dengan CS di aplikasi, kanal resmi yang ditampilkan pada Layanan, atau surat ke alamat korespondensi Kahade."
          }
        ]
      }
    ]
  },
  "parts": [
    {
      "id": "kebijakan-privasi",
      "title": "Kebijakan Privasi",
      "sections": [
        {
          "id": "1-ruang-lingkup-kebijakan",
          "title": "1. RUANG LINGKUP KEBIJAKAN",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "1.1 Kebijakan ini berlaku terhadap pemrosesan Data Pribadi oleh Kahade sehubungan dengan Layanan, baik melalui aplikasi seluler, situs web, panel atau portal yang ditujukan bagi pengguna, halaman publik, komunikasi dengan layanan pelanggan, kegiatan verifikasi, maupun integrasi yang secara jelas menjadi bagian dari Layanan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "1.2 Kebijakan ini mencakup pengguna yang bertindak sebagai pembeli, penjual, pengirim dana, penerima dana, pemilik etalase, pengikut, pemberi komentar, pihak yang mengajukan sengketa, penerima dukungan, serta pengunjung yang belum memiliki akun sejauh datanya diproses oleh Kahade."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "1.3 Kebijakan ini tidak mengatur pemrosesan yang dilakukan pihak ketiga sebagai pengendali data independen, misalnya bank, dompet elektronik lain, kurir, atau situs pihak ketiga yang Anda kunjungi di luar lingkungan Kahade. Kebijakan privasi pihak tersebut berlaku untuk pemrosesan mereka sendiri."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "1.4 Untuk suatu fitur, kami dapat memberikan pemberitahuan privasi tambahan yang lebih spesifik. Apabila terdapat perbedaan, pemberitahuan yang lebih spesifik berlaku untuk konteks fitur tersebut sepanjang tidak mengurangi hak yang diberikan oleh hukum."
                }
              ]
            }
          ]
        },
        {
          "id": "2-siapa-yang-bertanggung-jawab",
          "title": "2. SIAPA YANG BERTANGGUNG JAWAB",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "2.1 PT Kawal Hak Dengan Aman bertindak sebagai pengendali Data Pribadi ketika menentukan tujuan dan melakukan kendali atas pemrosesan data dalam Layanan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "2.2 Dalam situasi tertentu, penyedia layanan kami bertindak sebagai prosesor Data Pribadi berdasarkan instruksi Kahade. Mereka wajib memproses data hanya untuk tujuan yang disepakati, menjaga kerahasiaan dan keamanan, serta membantu Kahade memenuhi kewajiban pelindungan data sesuai kontrak dan hukum yang berlaku."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "2.3 Pihak seperti bank, penyelenggara pembayaran, perusahaan logistik, atau otoritas dapat bertindak sebagai pengendali independen karena memiliki tujuan dan kewajiban hukum sendiri. Pengungkapan kepada mereka tetap dibatasi pada data yang relevan dan dasar yang sah."
                }
              ]
            }
          ]
        },
        {
          "id": "3-definisi-penting",
          "title": "3. DEFINISI PENTING",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "3.1 “Data Pribadi” adalah data tentang orang perseorangan yang teridentifikasi atau dapat diidentifikasi, baik secara tersendiri maupun dikombinasikan dengan informasi lain, secara langsung atau tidak langsung, melalui sistem elektronik atau nonelektronik."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "3.2 “Data Pribadi yang bersifat spesifik” mencakup kategori yang memperoleh pelindungan lebih tinggi berdasarkan hukum, termasuk data biometrik, data keuangan pribadi, catatan kejahatan, data anak, dan kategori lain yang ditetapkan peraturan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "3.3 “Pemrosesan” mencakup memperoleh, mengumpulkan, mengolah, menganalisis, menyimpan, memperbaiki, memperbarui, menampilkan, mengumumkan, mentransfer, menyebarluaskan, mengungkapkan, menghapus, atau memusnahkan Data Pribadi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "3.4 “Pengguna” atau “Anda” adalah individu yang mengakses atau menggunakan Layanan, termasuk pihak yang berinteraksi dengan Kahade meskipun belum memiliki akun."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "3.5 “Pengamanan Dana” adalah mekanisme penyimpanan dana secara sementara dalam alur transaksi sampai syarat pelepasan, pengembalian, pembatalan, atau penyelesaian sengketa terpenuhi sesuai Syarat dan Ketentuan serta status transaksi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "3.6 “Dompet” adalah tampilan dan fungsi pencatatan saldo, dana tersedia, dana dalam transaksi, mutasi, penarikan, top up, transfer, refund, biaya, dan aktivitas keuangan lain yang didukung Layanan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "3.7 “Konten Pengguna” meliputi etalase, foto, deskripsi, komentar, ulasan, pesan, lampiran, bukti, profil, bio, dan materi lain yang disampaikan melalui Layanan."
                }
              ]
            }
          ]
        },
        {
          "id": "4-prinsip-pemrosesan-data",
          "title": "4. PRINSIP PEMROSESAN DATA",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "4.1 Kami berupaya memproses Data Pribadi secara terbatas, spesifik, sah, adil, transparan, dan sesuai tujuan yang telah diberitahukan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "4.2 Kami mengumpulkan data yang relevan dan proporsional terhadap fungsi yang digunakan. Fitur yang berbeda dapat memerlukan data yang berbeda; sebagai contoh, melihat konten publik tidak memerlukan seluruh data yang dibutuhkan untuk menarik dana."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "4.3 Kami menjaga agar data akurat, lengkap, dan mutakhir sejauh diperlukan. Anda bertanggung jawab memberi data yang benar dan memperbarui data yang berubah. Untuk data tertentu, pembaruan dapat memerlukan verifikasi ulang demi mencegah pengambilalihan akun atau penyalahgunaan dana."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "4.4 Kami menyimpan data selama diperlukan untuk tujuan pemrosesan, kewajiban hukum, penyelesaian sengketa, audit, keamanan, dan penegakan perjanjian. Setelah itu, data akan dihapus, dimusnahkan, atau dianonimkan secara wajar, kecuali hukum mensyaratkan tindakan lain."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "4.5 Kami menerapkan pengamanan yang sebanding dengan sifat dan risiko data, terutama terhadap identitas, data keuangan, dokumen KYC, kredensial, lokasi, dan bukti sengketa."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "4.6 Kami mendokumentasikan kegiatan pemrosesan dan melakukan peninjauan saat terdapat fitur, penyedia, risiko, atau ketentuan hukum baru."
                }
              ]
            }
          ]
        },
        {
          "id": "5-data-akun-dan-profil",
          "title": "5. DATA AKUN DAN PROFIL",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "5.1 Saat pendaftaran dan pengelolaan akun, kami dapat memproses nama lengkap, nomor telepon, username, alamat email jika ditambahkan, kata sandi dalam bentuk hasil hash, tanggal lahir, jenis kelamin, alamat, foto profil, gambar header, bio, jenis akun, bahasa, serta status verifikasi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "5.2 Nomor telepon merupakan identitas utama pendaftaran Kahade. Kode sekali pakai (OTP) untuk verifikasi nomor dikirim atau diproses melalui kanal WhatsApp resmi sesuai alur yang ditampilkan. Kami dapat mencatat waktu permintaan, status pengiriman, percobaan verifikasi, nomor tujuan, referensi, dan hasil verifikasi untuk keamanan serta audit."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "5.3 Kata sandi tidak disimpan sebagai teks biasa. Sistem menyimpan representasi hash yang dirancang agar kata sandi asli tidak dapat dibaca langsung. Anda tetap wajib menjaga kerahasiaan kata sandi, PIN, perangkat, dan kode verifikasi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "5.4 Beberapa elemen profil dapat terlihat oleh pengguna lain, seperti nama, username, foto, bio, lencana, statistik transaksi atau ulasan tertentu, status mengikuti, dan etalase publik. Informasi kontak hanya ditampilkan jika fitur dan pilihan Anda mengizinkannya."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "5.5 Status akun, termasuk aktif, terkunci, dibatasi, ditangguhkan, atau dilarang, dapat diproses bersama alasan dan catatan audit. Informasi operasional internal tidak selalu ditampilkan kepada pihak lain jika pengungkapan dapat mengganggu keamanan, investigasi, atau hak pihak lain."
                }
              ]
            }
          ]
        },
        {
          "id": "6-data-autentikasi-sesi-dan-perangkat",
          "title": "6. DATA AUTENTIKASI, SESI, DAN PERANGKAT",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "6.1 Kami memproses data sesi seperti pengenal sesi, token yang disimpan atau ditransmisikan secara aman, waktu pembuatan dan kedaluwarsa, status pencabutan, aktivitas terakhir, dan alasan penghentian sesi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "6.2 Data perangkat dapat meliputi pengenal perangkat yang dibuat aplikasi, nama dan tipe perangkat, sistem operasi, versi aplikasi, browser, user-agent, alamat IP, token notifikasi, status perangkat tepercaya, waktu login, dan jumlah login."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "6.3 Data tersebut digunakan untuk autentikasi, menjaga sesi, menampilkan daftar perangkat, mengirim notifikasi, mendeteksi akses tidak wajar, membatasi percobaan login, mencabut sesi, menginvestigasi pengambilalihan akun, serta melindungi dana dan pengguna."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "6.4 Kami dapat membandingkan pola akses saat ini dengan riwayat akses, misalnya perubahan perangkat, jaringan, negara atau lokasi, frekuensi percobaan, dan pola kecepatan perjalanan yang tidak wajar. Sinyal ini dapat memicu verifikasi tambahan, pembatasan sementara, atau pemeriksaan manusia."
                }
              ]
            }
          ]
        },
        {
          "id": "7-data-verifikasi-identitas-dan-kyc",
          "title": "7. DATA VERIFIKASI IDENTITAS DAN KYC",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "7.1 Untuk mengaktifkan fitur tertentu, menaikkan batas, memenuhi kewajiban kepatuhan, atau mengurangi penipuan, kami dapat meminta data Know Your Customer (KYC), termasuk nama sesuai identitas, Nomor Induk Kependudukan, jenis dan foto dokumen identitas, foto selfie, rekaman atau berkas liveness, tanggal lahir, alamat, serta data pendukung lain yang relevan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "7.2 Kami dapat membuat nilai hash satu arah dari nomor identitas untuk mendeteksi penggunaan dokumen yang sama pada beberapa akun tanpa harus membandingkan nomor identitas dalam bentuk terbaca. Dokumen dan nilai asli dapat dilindungi dengan enkripsi dan kontrol akses khusus."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "7.3 Selfie dan liveness digunakan untuk memeriksa bahwa pengajuan dilakukan oleh orang nyata dan, jika fitur tersebut diterapkan, untuk menilai kecocokan dengan dokumen. Apabila pemrosesan teknis menghasilkan templat atau data biometrik yang ditujukan untuk identifikasi unik, data tersebut diperlakukan sebagai Data Pribadi yang bersifat spesifik dan mendapat perlindungan lebih tinggi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "7.4 Data KYC dapat ditinjau oleh personel berwenang atau penyedia verifikasi yang terikat kewajiban kerahasiaan. Kami mencatat status, waktu pengajuan, percobaan, hasil, alasan penolakan, permintaan dokumen tambahan, peninjau, dan jejak audit."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "7.5 Kami dapat meminta verifikasi ulang apabila data berubah, kualitas dokumen tidak memadai, terdapat indikasi penyalahgunaan, masa berlaku dokumen berakhir, akun dipulihkan, atau diwajibkan oleh hukum dan mitra yang sah."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "7.6 Data identitas tidak ditampilkan kepada pengguna lain kecuali bagian tertentu memang diperlukan untuk transaksi, diwajibkan hukum, atau Anda memilih menampilkannya. Kami tidak meminta Anda mengirim dokumen identitas melalui kanal informal yang tidak dinyatakan sebagai kanal resmi."
                }
              ]
            }
          ]
        },
        {
          "id": "8-data-escrow-dan-transaksi",
          "title": "8. DATA PENGAMANAN DANA DAN TRANSAKSI",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "8.1 Untuk menjalankan transaksi, kami memproses identitas para pihak, peran pembeli atau penjual, ID transaksi, objek transaksi, deskripsi, nilai, biaya, metode pembayaran, status, waktu, instruksi, tenggat, konfirmasi, pembatalan, pengiriman, penerimaan, pelepasan dana, refund, dan riwayat perubahan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "8.2 Data pengiriman dapat meliputi nama penerima, nomor kontak, alamat tujuan, pilihan kurir, nomor resi, status pelacakan, bukti pengiriman, bukti penerimaan, serta catatan yang diberikan para pihak."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "8.3 Data transaksi digunakan untuk membentuk dan melaksanakan kesepakatan, menyimpan dana transaksi, menentukan status, memberi notifikasi, memfasilitasi pengiriman, mencatat persetujuan, menyelesaikan pembatalan atau refund, merekonsiliasi dana, mencegah duplikasi, dan menyediakan bukti transaksi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "8.4 Pihak lawan transaksi akan menerima data yang secara wajar diperlukan untuk melaksanakan transaksi. Jangan mencantumkan informasi yang tidak diperlukan dalam deskripsi, catatan, chat, atau alamat pengiriman."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "8.5 Karena Kahade menangani alur yang berdampak pada hak dan dana, catatan transaksi tertentu dapat tetap disimpan setelah transaksi selesai atau akun ditutup untuk akuntansi, audit, penanganan keluhan, pencegahan penipuan, pembelaan klaim, dan kewajiban hukum."
                }
              ]
            }
          ]
        },
        {
          "id": "9-data-dompet-dan-mutasi",
          "title": "9. DATA DOMPET DAN MUTASI",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "9.1 Kami memproses saldo tersedia, saldo dalam transaksi, saldo total, top up, transfer, penarikan, refund, biaya administrasi, cashback atau manfaat jika tersedia, batas transaksi, mutasi, referensi pembayaran, status, waktu, dan metadata rekonsiliasi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "9.2 Catatan dompet merupakan catatan sistem yang berkaitan dengan pergerakan dana. Koreksi terhadap kesalahan tidak selalu dilakukan dengan menghapus catatan lama; kami dapat membuat entri pembalik atau penyesuaian agar jejak audit tetap utuh."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "9.3 Untuk mengamankan dompet, kami dapat memproses PIN dalam bentuk hash, percobaan PIN, status penguncian, alasan penguncian, otorisasi perangkat, lokasi tindakan, dan sinyal risiko. Kami tidak akan meminta Anda menyebutkan PIN lengkap atau OTP kepada petugas dukungan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "9.4 Batas harian, riwayat top up atau penarikan, dan data terkait dapat digunakan untuk menerapkan batas produk, mendeteksi pola tidak wajar, serta memenuhi kewajiban dari mitra pembayaran atau hukum."
                }
              ]
            }
          ]
        },
        {
          "id": "10-data-rekening-bank-dan-pencairan",
          "title": "10. DATA REKENING BANK DAN PENCAIRAN",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "10.1 Untuk penarikan atau pencairan, kami dapat memproses nama bank, kode bank, nomor rekening, nama pemilik rekening, status rekening utama, status verifikasi, identitas penerima manfaat pada mitra pembayaran, nominal, biaya, dan hasil pencairan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "10.2 Nomor rekening dapat disimpan dalam bentuk terenkripsi. Nilai hash dapat digunakan untuk mendeteksi pendaftaran rekening yang sama atau pola penyalahgunaan tanpa menampilkan nomor lengkap."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "10.3 Sebelum pencairan, Kahade atau mitra dapat memverifikasi kesesuaian nama, status rekening, dan informasi lain. Data yang dikirim kepada bank atau penyedia pembayaran dibatasi pada yang diperlukan untuk memproses, menelusuri, mengoreksi, atau mengembalikan transaksi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "10.4 Untuk keamanan, sebagian nomor rekening dapat disamarkan pada antarmuka, notifikasi, dan komunikasi. Pengungkapan penuh hanya dilakukan bila benar-benar diperlukan dan sesuai kewenangan."
                }
              ]
            }
          ]
        },
        {
          "id": "11-data-pembayaran-dan-mitra-keuangan",
          "title": "11. DATA PEMBAYARAN DAN MITRA KEUANGAN",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "11.1 Saat Anda menggunakan kanal pembayaran, penyedia pembayaran atau lembaga keuangan dapat mengumpulkan data langsung dari Anda berdasarkan kebijakan mereka. Kahade dapat menerima status, referensi, nominal, metode, waktu, identitas terbatas, dan hasil transaksi, tetapi tidak selalu menerima seluruh detail instrumen pembayaran."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "11.2 Kami memproses callback, webhook, atau konfirmasi dari mitra untuk memperbarui status pembayaran. Kami dapat menyimpan pengenal mitra dan log teknis untuk mencegah satu pembayaran dibukukan lebih dari sekali, menyelesaikan perbedaan, dan menangani klaim."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "11.3 Apabila transaksi ditolak, tertunda, dibatalkan, dikembalikan, atau ditinjau, kami dan mitra dapat bertukar data yang relevan untuk menemukan penyebab dan menentukan tindakan yang tepat."
                }
              ]
            }
          ]
        },
        {
          "id": "12-data-lokasi",
          "title": "12. DATA LOKASI",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "12.1 Dengan izin perangkat atau berdasarkan fungsi yang digunakan, Kahade dapat memproses lokasi presisi berupa lintang, bujur, akurasi, sumber lokasi, dan waktu. Kami juga dapat memperkirakan lokasi dari alamat IP atau data jaringan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "12.2 Lokasi dapat diminta pada pendaftaran, login, pemulihan akun, perubahan keamanan, transaksi berisiko, penarikan, transfer, pengajuan sengketa, penghapusan akun, atau tindakan lain yang memerlukan verifikasi konteks."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "12.3 Tujuannya adalah melindungi akun, mendeteksi aktivitas tidak wajar, menilai risiko, menangani sengketa, mencegah penipuan, dan memenuhi kewajiban kepatuhan. Lokasi tidak digunakan untuk menampilkan pergerakan Anda kepada pengguna lain kecuali fitur tertentu secara jelas meminta dan menjelaskan hal tersebut."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "12.4 Anda dapat menolak atau mencabut izin lokasi melalui pengaturan perangkat. Akibatnya, tindakan berisiko tertentu dapat memerlukan metode verifikasi lain, tertunda, dibatasi, atau tidak tersedia apabila lokasi secara wajar diperlukan untuk keamanan atau kepatuhan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "12.5 Kami dapat mencatat bahwa izin ditolak tanpa menyimpan koordinat. Catatan ini membantu menjelaskan mengapa suatu kontrol keamanan tidak dapat dijalankan."
                }
              ]
            }
          ]
        },
        {
          "id": "13-chat-panggilan-fitur-dan-lampiran",
          "title": "13. CHAT, PANGGILAN FITUR, DAN LAMPIRAN",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "13.1 Kami memproses isi pesan, pengirim, penerima atau anggota ruang, waktu, status terkirim dan terbaca, balasan, edit, reaksi, pin, penerusan, serta metadata teknis percakapan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "13.2 Lampiran dapat memuat nama file, ukuran, tipe berkas, foto, video, rekaman suara, dokumen, thumbnail, dan alamat penyimpanan. Jangan mengirim data pribadi yang tidak diperlukan, kredensial, PIN, OTP, atau informasi sensitif pihak lain melalui chat."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "13.3 Chat transaksi dapat menjadi bagian dari bukti pelaksanaan kesepakatan. Jika pesan dihapus dari tampilan pengguna, salinan terbatas dapat tetap dipertahankan ketika transaksi sedang berlangsung, sengketa mungkin timbul, laporan moderasi diajukan, atau penyimpanan diperlukan untuk hukum dan keamanan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "13.4 Personel berwenang dapat mengakses percakapan dalam konteks sengketa, laporan, keselamatan, pencegahan penipuan, dukungan, atau penegakan ketentuan. Akses tersebut dibatasi berdasarkan peran dan dicatat sejauh sistem mendukungnya."
                }
              ]
            }
          ]
        },
        {
          "id": "14-sengketa-laporan-dan-bukti",
          "title": "14. SENGKETA, LAPORAN, DAN BUKTI",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "14.1 Saat sengketa diajukan, kami dapat memproses pernyataan para pihak, kronologi, tuntutan, tanggapan, bukti foto atau video, dokumen, resi, pesan, status transaksi, data pembayaran, lokasi tindakan, keputusan, dan catatan petugas."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "14.2 Data sengketa dapat dibagikan secara proporsional kepada pihak lawan, mediator atau petugas berwenang, penyedia pembayaran, kurir, penasihat profesional, atau otoritas apabila diperlukan untuk memeriksa fakta dan menjalankan keputusan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "14.3 Kami dapat membatasi pengungkapan bukti jika mengandung data pihak ketiga, rahasia keamanan, materi ilegal, atau informasi yang pengungkapannya dapat membahayakan seseorang. Ringkasan atau versi yang disamarkan dapat digunakan sebagai gantinya."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "14.4 Laporan tentang pengguna atau konten dapat memuat identitas pelapor, terlapor, kategori, alasan, uraian, bukti, waktu, serta hasil moderasi. Identitas pelapor tidak otomatis diberikan kepada terlapor, kecuali diwajibkan hukum atau diperlukan untuk proses yang sah."
                }
              ]
            }
          ]
        },
        {
          "id": "15-etalase-profil-sosial-dan-utas",
          "title": "15. ETALASE, PROFIL SOSIAL, DAN UTAS",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "15.1 Fitur sosial-commerce memungkinkan Anda menerbitkan judul, deskripsi, kategori, harga atau rentang harga, foto, statistik tampilan, suka, komentar, bagikan, dan hubungan dengan transaksi. Konten yang disetel publik dapat dilihat, disalin, ditangkap layar, atau dibagikan oleh orang lain di luar kendali Kahade."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "15.2 Anda dapat mengatur visibilitas fitur tertentu jika pilihan tersedia. Konten privat dibatasi dari tampilan publik, tetapi tetap dapat diakses oleh Anda, personel yang berwenang, dan sistem untuk penyimpanan, keamanan, dukungan, atau moderasi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "15.3 Nama, username, foto, bio, lencana, jumlah pengikut, akun yang diikuti, ulasan, dan statistik tertentu dapat menjadi bagian profil publik. Anda harus menilai informasi apa yang aman untuk ditampilkan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "15.4 Komentar, jawaban, dan balasan berutas dapat dilihat bersama identitas profil publik dan waktu publikasi. Menghapus akun atau konten tidak selalu menghapus kutipan, tangkapan layar, atau salinan yang telah dibuat pengguna lain secara sah."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "15.5 Etalase yang dihapus secara normal dapat masuk masa pemulihan selama 30 hari. Selama masa itu, data tidak tampil sebagai etalase aktif namun disimpan agar pemilik dapat memulihkannya dan agar pemeriksaan keamanan atau sengketa dapat dilakukan. Setelah masa pemulihan, data dijadwalkan untuk penghapusan permanen, kecuali ada kewajiban retensi yang sah."
                }
              ]
            }
          ]
        },
        {
          "id": "16-ulasan-reputasi-dan-lencana",
          "title": "16. ULASAN, REPUTASI, DAN LENCANA",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "16.1 Kami dapat memproses penilaian, ulasan, jumlah transaksi selesai, peran transaksi, rata-rata rating, jumlah penilai, status verifikasi, keanggotaan, dan indikator reputasi lain."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "16.2 Sebagian informasi tersebut dapat ditampilkan kepada pengguna lain untuk mendukung kepercayaan dan pengambilan keputusan. Kami berupaya membatasi informasi pada yang relevan dan tidak menampilkan rincian finansial yang tidak diperlukan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "16.3 Lencana atau status tertentu dapat dihasilkan dari pemenuhan syarat, misalnya verifikasi nomor telepon, email, KYC, profil, keanggotaan, atau keputusan administratif. Lencana bukan jaminan bahwa pengguna bebas risiko dan tidak menggantikan kewaspadaan Anda."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "16.4 Kami dapat menyelidiki manipulasi ulasan, transaksi palsu, atau rekayasa reputasi dengan menganalisis keterkaitan akun, perangkat, transaksi, waktu, dan pola interaksi."
                }
              ]
            }
          ]
        },
        {
          "id": "17-notifikasi-dan-komunikasi",
          "title": "17. NOTIFIKASI DAN KOMUNIKASI",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "17.1 Kami dapat mengirim notifikasi dalam aplikasi, push, WhatsApp, SMS, email, atau kanal lain yang tersedia mengenai OTP, keamanan, status transaksi, dompet, sengketa, chat, perubahan akun, layanan, promosi, dan informasi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "17.2 Komunikasi yang diperlukan untuk keamanan, kontrak, transaksi, atau perubahan hukum tidak selalu dapat dinonaktifkan selama akun aktif. Komunikasi promosi dapat dikelola melalui preferensi yang tersedia atau instruksi berhenti berlangganan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "17.3 Kami mencatat status dikirim, diterima, dibuka jika didukung, gagal, waktu, kategori, perangkat tujuan, dan referensi agar komunikasi dapat diaudit dan diperbaiki."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "17.4 Jangan membalas OTP atau informasi rahasia ke pesan yang mengaku berasal dari Kahade. Petugas Kahade tidak akan meminta PIN, kata sandi, atau OTP lengkap."
                }
              ]
            }
          ]
        },
        {
          "id": "18-dukungan-pelanggan-dan-rekaman-layanan",
          "title": "18. DUKUNGAN PELANGGAN DAN REKAMAN LAYANAN",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "18.1 Saat Anda menghubungi CS, kami dapat memproses identitas akun, detail kontak, isi pertanyaan, lampiran, rekaman interaksi, transaksi terkait, langkah pemecahan masalah, hasil penanganan, kepuasan, dan catatan eskalasi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "18.2 Kami dapat meminta informasi tambahan untuk memverifikasi bahwa pemohon berhak mengakses akun atau transaksi. Jangan mengirim lebih banyak data daripada yang diminta, terutama dokumen identitas melalui kanal yang tidak aman."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "18.3 Percakapan dukungan dapat digunakan untuk menangani permintaan, menjaga mutu, melatih petugas, mengidentifikasi pola masalah, mencegah penyalahgunaan, dan membuktikan penanganan keluhan. Jika materi digunakan untuk pelatihan internal, akses dibatasi dan data diminimalkan bila memungkinkan."
                }
              ]
            }
          ]
        },
        {
          "id": "19-data-teknis-penggunaan-dan-diagnostik",
          "title": "19. DATA TEKNIS, PENGGUNAAN, DAN DIAGNOSTIK",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "19.1 Kami dapat memproses halaman atau layar yang dibuka, tombol atau fitur yang digunakan, waktu akses, rujukan, versi aplikasi, konfigurasi bahasa, zona waktu, jaringan, crash, performa, latensi, error, log API, dan pengenal diagnostik."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "19.2 Data ini digunakan untuk menjalankan Layanan, menemukan kegagalan, meningkatkan kecepatan dan aksesibilitas, memahami adopsi fitur, menjaga kompatibilitas, mengukur keberhasilan perubahan, serta mendeteksi serangan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "19.3 Jika analitik dapat dijalankan dengan data agregat atau pseudonim, kami berupaya menggunakan bentuk tersebut. Data agregat yang tidak dapat dikaitkan secara wajar dengan individu tidak diperlakukan sebagai Data Pribadi, selama anonimisasi tetap efektif."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "19.4 Kami tidak menggunakan log teknis sebagai alasan untuk mengumpulkan isi pribadi yang tidak relevan. Akses log dibatasi dan masa simpannya disesuaikan dengan kebutuhan operasional dan keamanan."
                }
              ]
            }
          ]
        },
        {
          "id": "20-izin-perangkat",
          "title": "20. IZIN PERANGKAT",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "20.1 "
                },
                {
                  "text": "Kamera dan galeri.",
                  "bold": true
                },
                {
                  "text": " Digunakan ketika Anda mengambil atau memilih foto profil, gambar etalase, bukti transaksi, dokumen KYC, selfie, bukti sengketa, atau lampiran chat."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "20.2 "
                },
                {
                  "text": "Mikrofon.",
                  "bold": true
                },
                {
                  "text": " Digunakan ketika Anda secara aktif merekam pesan suara, video, atau bukti yang memerlukan audio."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "20.3 "
                },
                {
                  "text": "Lokasi.",
                  "bold": true
                },
                {
                  "text": " Digunakan untuk pengamanan dan konteks tindakan sebagaimana dijelaskan pada bagian lokasi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "20.4 "
                },
                {
                  "text": "Notifikasi.",
                  "bold": true
                },
                {
                  "text": " Digunakan untuk mengirim informasi transaksi, keamanan, komunikasi, dan promosi sesuai preferensi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "20.5 "
                },
                {
                  "text": "Penyimpanan atau berkas.",
                  "bold": true
                },
                {
                  "text": " Digunakan untuk memilih, mengunggah, mengunduh, atau membagikan dokumen dan media atas tindakan Anda."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "20.6 Izin perangkat dapat dikelola melalui pengaturan sistem operasi. Penolakan izin hanya memengaruhi fitur yang memerlukan akses tersebut, kecuali akses merupakan syarat keamanan atau hukum bagi tindakan tertentu."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "20.7 Kahade tidak mengaktifkan kamera, mikrofon, atau lokasi presisi secara diam-diam. Sistem operasi dapat menampilkan indikator atau dialog izin tersendiri."
                }
              ]
            }
          ]
        },
        {
          "id": "21-cookie-dan-teknologi-serupa",
          "title": "21. COOKIE DAN TEKNOLOGI SERUPA",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "21.1 Pada situs web, kami dapat menggunakan cookie, local storage, session storage, pixel, atau teknologi serupa untuk mempertahankan sesi, mengingat preferensi, mengamankan permintaan, mencegah penyalahgunaan, dan mengukur performa."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "21.2 Cookie yang benar-benar diperlukan mendukung fungsi inti dan keamanan. Cookie analitik atau pemasaran, apabila digunakan dan diwajibkan hukum, akan dikelola berdasarkan pilihan atau persetujuan yang sesuai."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "21.3 Pada aplikasi, Software Development Kit (SDK), token perangkat, atau penyimpanan lokal dapat menjalankan fungsi yang serupa. Informasi tentang pihak penyedia yang relevan dapat diberikan melalui pemberitahuan fitur, daftar mitra, atau pembaruan Kebijakan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "21.4 Penghapusan cookie atau data aplikasi dapat mengeluarkan Anda dari akun, menghapus preferensi lokal, atau mengharuskan verifikasi ulang perangkat."
                }
              ]
            }
          ]
        },
        {
          "id": "22-sumber-data",
          "title": "22. SUMBER DATA",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "22.1 "
                },
                {
                  "text": "Dari Anda.",
                  "bold": true
                },
                {
                  "text": " Data yang Anda masukkan, unggah, sampaikan, pilih, atau konfirmasi ketika mendaftar, bertransaksi, melakukan KYC, mengelola profil, menghubungi CS, atau menggunakan fitur."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "22.2 "
                },
                {
                  "text": "Dari perangkat dan penggunaan.",
                  "bold": true
                },
                {
                  "text": " Data sesi, IP, perangkat, versi, lokasi dengan izin atau perkiraan jaringan, crash, log, dan interaksi dengan Layanan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "22.3 "
                },
                {
                  "text": "Dari pengguna lain.",
                  "bold": true
                },
                {
                  "text": " Data yang pihak lain masukkan mengenai transaksi, alamat pengiriman, chat, ulasan, tag, laporan, sengketa, atau interaksi sosial yang melibatkan Anda."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "22.4 "
                },
                {
                  "text": "Dari mitra.",
                  "bold": true
                },
                {
                  "text": " Status pembayaran, verifikasi rekening, hasil pengiriman, konfirmasi komunikasi, informasi verifikasi identitas, atau sinyal penipuan dari penyedia yang sah."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "22.5 "
                },
                {
                  "text": "Dari sumber publik atau otoritatif.",
                  "bold": true
                },
                {
                  "text": " Informasi yang sah dari daftar sanksi, putusan, registri, sumber pemerintah, atau informasi publik lain jika relevan untuk kepatuhan dan keamanan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "22.6 "
                },
                {
                  "text": "Data turunan.",
                  "bold": true
                },
                {
                  "text": " Status risiko, skor atau sinyal keamanan, kategori perilaku, ringkasan reputasi, status verifikasi, pola transaksi, dan indikator anomali yang diturunkan dari data lain. Data turunan tetap diperlakukan sebagai Data Pribadi bila dapat dikaitkan dengan individu."
                }
              ]
            }
          ]
        },
        {
          "id": "23-tujuan-pemrosesan",
          "title": "23. TUJUAN PEMROSESAN",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "23.1 "
                },
                {
                  "text": "Menyediakan Layanan:",
                  "bold": true
                },
                {
                  "text": " membuat akun, mengelola profil, menjalankan fitur sosial, komunikasi, etalase, transaksi, pengamanan dana, dompet, dan dukungan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "23.2 "
                },
                {
                  "text": "Melaksanakan perjanjian:",
                  "bold": true
                },
                {
                  "text": " membentuk instruksi transaksi, memproses pembayaran, menahan atau melepaskan dana sesuai status, mengirim barang, menarik dana, mengembalikan pembayaran, dan menyediakan catatan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "23.3 "
                },
                {
                  "text": "Memverifikasi identitas:",
                  "bold": true
                },
                {
                  "text": " memastikan pengguna adalah pihak yang sah, memenuhi persyaratan fitur, dan mencegah penggunaan identitas ganda atau palsu."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "23.4 "
                },
                {
                  "text": "Menjaga keamanan:",
                  "bold": true
                },
                {
                  "text": " mencegah pengambilalihan akun, phishing, bot, spam, pencucian uang, penipuan, manipulasi reputasi, penyalahgunaan promo, transaksi tidak sah, dan serangan terhadap sistem."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "23.5 "
                },
                {
                  "text": "Menyelesaikan sengketa:",
                  "bold": true
                },
                {
                  "text": " menilai bukti, berkomunikasi dengan pihak terkait, menjalankan keputusan, dan mempertahankan hak hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "23.6 "
                },
                {
                  "text": "Mematuhi hukum:",
                  "bold": true
                },
                {
                  "text": " memenuhi perintah yang sah, kewajiban pajak, akuntansi, audit, pelaporan, penyimpanan, pencegahan kejahatan, dan permintaan regulator."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "23.7 "
                },
                {
                  "text": "Berkomunikasi:",
                  "bold": true
                },
                {
                  "text": " mengirim OTP, notifikasi keamanan, pembaruan transaksi, pesan layanan, informasi hukum, dukungan, survei, dan promosi yang diizinkan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "23.8 "
                },
                {
                  "text": "Memperbaiki Layanan:",
                  "bold": true
                },
                {
                  "text": " menganalisis kinerja, memperbaiki bug, mengembangkan fitur, menguji perubahan, mengukur pengalaman, dan merencanakan kapasitas."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "23.9 "
                },
                {
                  "text": "Melindungi hak dan keselamatan:",
                  "bold": true
                },
                {
                  "text": " melindungi Kahade, pengguna, mitra, dan publik; menegakkan ketentuan; serta merespons keadaan darurat."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "23.10 "
                },
                {
                  "text": "Transaksi korporasi:",
                  "bold": true
                },
                {
                  "text": " melakukan uji tuntas dan transisi apabila terdapat restrukturisasi, penggabungan, akuisisi, investasi, pengalihan usaha, atau kepailitan, dengan perlindungan kerahasiaan yang sesuai."
                }
              ]
            }
          ]
        },
        {
          "id": "24-dasar-pemrosesan-yang-sah",
          "title": "24. DASAR PEMROSESAN YANG SAH",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "24.1 "
                },
                {
                  "text": "Persetujuan.",
                  "bold": true
                },
                {
                  "text": " Digunakan ketika hukum mensyaratkannya, misalnya untuk izin tertentu, pemasaran tertentu, atau pemrosesan opsional. Anda dapat menarik persetujuan untuk masa mendatang."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "24.2 "
                },
                {
                  "text": "Perjanjian.",
                  "bold": true
                },
                {
                  "text": " Digunakan ketika pemrosesan diperlukan untuk mengambil langkah atas permintaan Anda, menyediakan Layanan, atau melaksanakan kontrak."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "24.3 "
                },
                {
                  "text": "Kewajiban hukum.",
                  "bold": true
                },
                {
                  "text": " Digunakan untuk memenuhi penyimpanan, pelaporan, pencegahan tindak pidana, perlindungan konsumen, perpajakan, audit, dan perintah sah."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "24.4 "
                },
                {
                  "text": "Kepentingan vital.",
                  "bold": true
                },
                {
                  "text": " Digunakan secara terbatas ketika diperlukan untuk melindungi nyawa, kesehatan, atau keselamatan seseorang."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "24.5 "
                },
                {
                  "text": "Kepentingan umum atau kewenangan.",
                  "bold": true
                },
                {
                  "text": " Digunakan jika pemrosesan diperlukan untuk tugas yang ditetapkan hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "24.6 "
                },
                {
                  "text": "Kepentingan sah.",
                  "bold": true
                },
                {
                  "text": " Digunakan setelah mempertimbangkan tujuan, kebutuhan, dampak, dan ekspektasi wajar, misalnya keamanan, pencegahan penipuan, perbaikan layanan, pembelaan klaim, dan administrasi internal."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "24.7 Satu kegiatan dapat memiliki lebih dari satu dasar. Penarikan persetujuan tidak menghapus pemrosesan sebelumnya yang sah dan tidak menghentikan pemrosesan yang berdasar pada kewajiban hukum atau dasar lain."
                }
              ]
            }
          ]
        },
        {
          "id": "25-kepada-siapa-data-diungkapkan",
          "title": "25. KEPADA SIAPA DATA DIUNGKAPKAN",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "25.1 "
                },
                {
                  "text": "Pihak transaksi.",
                  "bold": true
                },
                {
                  "text": " Pembeli, penjual, penerima, pengirim, atau anggota transaksi menerima informasi yang diperlukan untuk mengenali pihak, berkomunikasi, mengirim, menerima, mengonfirmasi, dan menyelesaikan transaksi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "25.2 "
                },
                {
                  "text": "Penyedia pembayaran dan lembaga keuangan.",
                  "bold": true
                },
                {
                  "text": " Data yang diperlukan untuk top up, pengamanan dana, transfer, penarikan, refund, verifikasi rekening, rekonsiliasi, dan penanganan transaksi gagal."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "25.3 "
                },
                {
                  "text": "Penyedia logistik.",
                  "bold": true
                },
                {
                  "text": " Nama, kontak, alamat, detail pengiriman, dan referensi transaksi yang diperlukan untuk mengirim dan melacak barang."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "25.4 "
                },
                {
                  "text": "Penyedia komunikasi.",
                  "bold": true
                },
                {
                  "text": " Nomor telepon, alamat email, token perangkat, isi template, dan status pengiriman yang diperlukan untuk OTP, notifikasi, serta komunikasi layanan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "25.5 "
                },
                {
                  "text": "Penyedia verifikasi dan keamanan.",
                  "bold": true
                },
                {
                  "text": " Data identitas, dokumen, perangkat, jaringan, transaksi, dan sinyal yang diperlukan untuk KYC, autentikasi, pencegahan penipuan, moderasi, atau pemantauan keamanan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "25.6 "
                },
                {
                  "text": "Penyedia infrastruktur dan profesional.",
                  "bold": true
                },
                {
                  "text": " Penyedia hosting, penyimpanan, jaringan, analitik, pemantauan, pencadangan, auditor, konsultan, penasihat hukum, dan akuntan dapat menerima data sesuai kebutuhan tugas mereka."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "25.7 "
                },
                {
                  "text": "Afiliasi dan penerus usaha.",
                  "bold": true
                },
                {
                  "text": " Data dapat dialihkan dalam restrukturisasi atau transaksi korporasi yang sah, dengan pemberitahuan dan perlindungan yang diwajibkan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "25.8 "
                },
                {
                  "text": "Instansi berwenang.",
                  "bold": true
                },
                {
                  "text": " Data dapat diberikan berdasarkan undang-undang, perintah, proses hukum, pemeriksaan, atau permintaan yang sah. Kami dapat menolak atau membatasi permintaan yang tidak jelas, berlebihan, atau tidak memiliki dasar memadai."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "25.9 "
                },
                {
                  "text": "Dengan instruksi Anda.",
                  "bold": true
                },
                {
                  "text": " Data dapat dibagikan saat Anda menekan Bagikan, menghubungkan layanan, menunjuk perwakilan, meminta dokumen dikirim, atau memberi instruksi sah lainnya."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "25.10 Kami mewajibkan penerima menjaga data sesuai peran dan hukum mereka. Namun, tindakan pengguna lain setelah menerima data yang Anda publikasikan atau kirim secara langsung dapat berada di luar kendali Kahade."
                }
              ]
            }
          ]
        },
        {
          "id": "26-publikasi-dan-pengungkapan-oleh-pengguna",
          "title": "26. PUBLIKASI DAN PENGUNGKAPAN OLEH PENGGUNA",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "26.1 Informasi pada profil publik, etalase, komentar, ulasan, dan utas dirancang untuk dilihat orang lain. Jangan menerbitkan alamat rumah, nomor identitas, nomor rekening lengkap, dokumen, OTP, PIN, informasi kesehatan, atau data sensitif lain."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "26.2 Saat membagikan tautan transaksi, struk, profil, atau etalase, periksa informasi yang tercantum. Tautan yang dapat diakses publik dapat diteruskan oleh penerima."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "26.3 Fitur tangkapan layar dapat dibatasi pada layar yang sangat sensitif, tetapi pembatasan teknis tidak menjamin bahwa pihak lain tidak dapat merekam informasi dengan perangkat lain. Perlakukan setiap informasi yang Anda kirim kepada pengguna lain sebagai informasi yang mungkin dapat disimpan penerima."
                }
              ]
            }
          ]
        },
        {
          "id": "27-pemrosesan-otomatis-dan-profiling",
          "title": "27. PEMROSESAN OTOMATIS DAN PROFILING",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "27.1 Kahade dapat menggunakan aturan, model statistik, atau indikator otomatis untuk mendeteksi spam, transaksi abnormal, perangkat berisiko, lokasi yang tidak wajar, penyalahgunaan promo, duplikasi identitas, konten berbahaya, atau pelanggaran ketentuan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "27.2 Hasil otomatis dapat berupa penanda risiko, permintaan verifikasi tambahan, antrean tinjauan, penundaan sementara, atau pembatasan yang dirancang untuk mencegah kerugian. Apabila keputusan otomatis menimbulkan akibat hukum atau dampak signifikan bagi Anda, kami akan menyediakan perlindungan yang diwajibkan hukum, termasuk tinjauan manusia atau mekanisme keberatan jika berlaku."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "27.3 Kami tidak menjamin bahwa sistem otomatis selalu akurat. Anda dapat menghubungi CS untuk meminta peninjauan terhadap hasil yang menurut Anda keliru, dengan menyertakan informasi pendukung yang relevan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "27.4 Kami dapat menggunakan data agregat untuk memahami pola keseluruhan tanpa menargetkan individu. Jika data kembali dapat diidentifikasi, data tersebut kembali diperlakukan sebagai Data Pribadi."
                }
              ]
            }
          ]
        },
        {
          "id": "28-transfer-data-ke-luar-indonesia",
          "title": "28. TRANSFER DATA KE LUAR INDONESIA",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "28.1 Sebagian penyedia infrastruktur, komunikasi, analitik, keamanan, atau layanan teknologi dapat menyimpan atau mengakses data dari negara lain. Sebelum transfer lintas batas, kami menilai peran penerima, tujuan, kategori data, lokasi, dan perlindungan yang tersedia."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "28.2 Transfer dilakukan apabila negara penerima memiliki tingkat pelindungan yang setara atau lebih tinggi, tersedia perlindungan yang memadai dan mengikat, terdapat persetujuan yang sah jika diperlukan, atau terdapat dasar lain yang dibolehkan hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "28.3 Perlindungan dapat meliputi kontrak pemrosesan, pembatasan akses, enkripsi, audit, kewajiban insiden, penghapusan, dan penilaian penyedia. Informasi lebih lanjut mengenai kategori transfer dapat diminta melalui kanal privasi."
                }
              ]
            }
          ]
        },
        {
          "id": "29-retensi-data",
          "title": "29. RETENSI DATA",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "29.1 Masa simpan ditentukan berdasarkan tujuan awal, status akun dan transaksi, kemungkinan sengketa, kewajiban hukum, kebutuhan audit, risiko keamanan, masa kedaluwarsa klaim, instruksi otoritas, dan kemampuan menghapus data secara teknis."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "29.2 Data akun inti disimpan selama akun aktif. Setelah penutupan, sebagian data dapat tetap disimpan untuk menyelesaikan saldo, transaksi, refund, sengketa, laporan, permintaan hak, pencegahan akun bermasalah dibuat ulang, atau kewajiban hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "29.3 Data transaksi, dompet, pembayaran, dan pencairan dapat disimpan lebih lama daripada profil biasa karena berfungsi sebagai catatan keuangan dan bukti. Jangka waktu mengikuti ketentuan yang berlaku serta kebutuhan pembelaan klaim yang wajar."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "29.4 Data KYC disimpan selama diperlukan untuk verifikasi, pemenuhan kewajiban, audit, pencegahan identitas ganda, dan pembuktian. Aksesnya dibatasi lebih ketat."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "29.5 Chat, bukti, dan lampiran yang berhubungan dengan transaksi atau sengketa dapat dipertahankan sampai perkara selesai dan selama periode retensi yang relevan. Konten yang tidak terkait dapat memiliki masa simpan berbeda."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "29.6 Log keamanan biasanya dipertahankan selama diperlukan untuk mendeteksi pola serangan, menginvestigasi insiden, dan memenuhi audit. Masa simpan dapat diperpanjang jika log menjadi bukti insiden."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "29.7 Cadangan dapat mempertahankan salinan terbatas untuk jangka waktu siklus pencadangan. Data yang telah dijadwalkan untuk dihapus tidak dikembalikan ke sistem aktif kecuali pemulihan diperlukan; penghapusan efektif setelah cadangan berputar atau dimusnahkan sesuai jadwal."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "29.8 Ketika retensi berakhir, data dihapus, dimusnahkan, atau dianonimkan. Anonimisasi harus dirancang agar identitas tidak dapat dipulihkan secara wajar dengan sarana yang tersedia."
                }
              ]
            }
          ]
        },
        {
          "id": "30-penghapusan-konten-dan-akun",
          "title": "30. PENGHAPUSAN KONTEN DAN AKUN",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "30.1 Penghapusan dari tampilan tidak selalu sama dengan pemusnahan langsung. Konten dapat melewati masa pemulihan, antrean penghapusan, pencadangan, atau retensi karena kewajiban hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "30.2 Etalase yang dihapus dapat dipulihkan selama 30 hari. Setelah itu, etalase dihapus permanen kecuali terkait transaksi, sengketa, laporan, atau kewajiban retensi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "30.3 Permintaan penghapusan akun akan melalui verifikasi identitas dan pemeriksaan saldo, transaksi terbuka, penarikan tertunda, sengketa, pembatasan, serta kewajiban lain. Kami dapat meminta Anda menyelesaikan kondisi tersebut sebelum penutupan efektif."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "30.4 Setelah akun ditutup, profil publik dinonaktifkan atau disamarkan secara wajar. Catatan yang harus dipertahankan dapat dipisahkan dari penggunaan aktif dan dibatasi aksesnya."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "30.5 Kami dapat mempertahankan daftar minimal, misalnya hash identitas, nomor telepon, perangkat, atau alasan pelarangan, jika diperlukan untuk mencegah penipuan atau penghindaran sanksi. Retensi tersebut harus proporsional dan dibatasi tujuan."
                }
              ]
            }
          ]
        },
        {
          "id": "31-keamanan-data",
          "title": "31. KEAMANAN DATA",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "31.1 Kahade menerapkan pengamanan berdasarkan risiko, sifat data, konteks pemrosesan, dan dampak yang mungkin terjadi. Pengamanan ditinjau dan diperbarui seiring perubahan ancaman dan sistem."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "31.2 "
                },
                {
                  "text": "Enkripsi.",
                  "bold": true
                },
                {
                  "text": " Data tertentu seperti identitas, nomor rekening, dan dokumen dapat dienkripsi saat disimpan. Komunikasi jaringan menggunakan protokol aman sejauh didukung. Kunci dikelola terpisah dari kode aplikasi dan aksesnya dibatasi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "31.3 "
                },
                {
                  "text": "Hash dan tokenisasi.",
                  "bold": true
                },
                {
                  "text": " Kata sandi dan PIN disimpan sebagai hash. Nilai hash atau pengenal pengganti dapat digunakan untuk pencocokan tanpa membuka nilai asli."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "31.4 "
                },
                {
                  "text": "Kontrol akses.",
                  "bold": true
                },
                {
                  "text": " Akses internal mengikuti kebutuhan tugas dan peran. Fitur administratif sensitif memerlukan autentikasi dan otorisasi; tindakan penting dicatat untuk audit."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "31.5 "
                },
                {
                  "text": "Keamanan aplikasi.",
                  "bold": true
                },
                {
                  "text": " Kami menerapkan validasi input, pembatasan permintaan, perlindungan sesi, verifikasi status, pengamanan unggahan, pembatasan jenis dan ukuran file, serta pengujian terhadap kerentanan yang relevan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "31.6 "
                },
                {
                  "text": "Keamanan finansial.",
                  "bold": true
                },
                {
                  "text": " Operasi saldo dirancang menggunakan pencatatan konsisten, kontrol transaksi basis data, idempotensi, rekonsiliasi, dan pemisahan status agar instruksi yang sama tidak dibukukan berulang."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "31.7 "
                },
                {
                  "text": "Pemantauan.",
                  "bold": true
                },
                {
                  "text": " Log, alarm, dan indikator anomali digunakan untuk mendeteksi penyalahgunaan, kegagalan, atau perubahan tidak sah. Aktivitas yang tampak mencurigakan dapat diperiksa atau dibatasi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "31.8 "
                },
                {
                  "text": "Pencadangan dan pemulihan.",
                  "bold": true
                },
                {
                  "text": " Cadangan dilindungi dengan kontrol akses dan, jika diterapkan, enkripsi. Proses pemulihan diuji secara berkala sesuai tingkat kritikalitas."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "31.9 "
                },
                {
                  "text": "Personel dan penyedia.",
                  "bold": true
                },
                {
                  "text": " Personel diberi akses sesuai kebutuhan dan kewajiban kerahasiaan. Penyedia dinilai berdasarkan kemampuan dan kewajiban keamanan yang relevan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "31.10 "
                },
                {
                  "text": "Tidak ada jaminan absolut.",
                  "bold": true
                },
                {
                  "text": " Meskipun kami menggunakan pengamanan berlapis, tidak ada transmisi atau penyimpanan elektronik yang bebas risiko. Anda harus menjaga perangkat, memperbarui aplikasi, menggunakan kata sandi unik, mengaktifkan fitur keamanan, dan segera melapor jika melihat aktivitas tidak dikenal."
                }
              ]
            }
          ]
        },
        {
          "id": "32-insiden-pelindungan-data",
          "title": "32. INSIDEN PELINDUNGAN DATA",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "32.1 Insiden dapat berupa akses, pengungkapan, perubahan, kehilangan, penghancuran, atau ketidaktersediaan Data Pribadi tanpa wewenang. Dugaan insiden ditangani melalui proses identifikasi, pembatasan, pemulihan, analisis, dan pencegahan berulang."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "32.2 Jika terjadi kegagalan pelindungan Data Pribadi yang wajib diberitahukan, kami akan menyampaikan pemberitahuan tertulis kepada pihak yang diwajibkan hukum dalam jangka waktu yang berlaku. Pemberitahuan sekurang-kurangnya menjelaskan data yang terungkap, kapan dan bagaimana insiden terjadi sejauh diketahui, serta langkah penanganan dan pemulihan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "32.3 Pemberitahuan dapat dilakukan melalui aplikasi, email, WhatsApp, surat, pengumuman, atau kanal lain yang patut berdasarkan data kontak dan tingkat risiko. Kami dapat memperbarui informasi ketika investigasi berkembang."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "32.4 Jika Anda menduga akun atau data terkompromi, segera ganti kata sandi, hentikan sesi yang tidak dikenal, jangan bagikan OTP, dan hubungi CS melalui kanal resmi. Simpan bukti tanpa menyebarluaskan data sensitif."
                }
              ]
            }
          ]
        },
        {
          "id": "33-kerahasiaan-kredensial",
          "title": "33. KERAHASIAAN KREDENSIAL",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "33.1 Kata sandi, PIN, OTP, tautan pemulihan, token sesi, dan kode keamanan adalah rahasia. Jangan memberikannya kepada siapa pun, termasuk pihak yang mengaku sebagai pegawai Kahade."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "33.2 Kahade dapat meminta Anda mengonfirmasi informasi tertentu untuk verifikasi, tetapi tidak akan meminta kata sandi atau PIN lengkap. OTP hanya digunakan pada langkah yang Anda mulai dan harus dimasukkan pada antarmuka resmi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "33.3 Anda bertanggung jawab atas keamanan perangkat dan akun selama tidak ada kegagalan yang menjadi tanggung jawab Kahade menurut hukum. Tanggung jawab pengguna tidak menghapus kewajiban Kahade untuk melindungi sistem."
                }
              ]
            }
          ]
        },
        {
          "id": "34-hak-anda-atas-data-pribadi",
          "title": "34. HAK ANDA ATAS DATA PRIBADI",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "34.1 "
                },
                {
                  "text": "Hak memperoleh informasi.",
                  "bold": true
                },
                {
                  "text": " Anda dapat meminta kejelasan mengenai identitas dan dasar kepentingan hukum, tujuan pemrosesan, jenis data yang diproses, periode penyimpanan, dan pihak yang dapat menerima data."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "34.2 "
                },
                {
                  "text": "Hak akses dan salinan.",
                  "bold": true
                },
                {
                  "text": " Anda dapat meminta akses atau salinan Data Pribadi tentang Anda sesuai ruang lingkup yang diwajibkan hukum. Kami dapat menyamarkan data pihak lain dan rahasia keamanan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "34.3 "
                },
                {
                  "text": "Hak melengkapi, memperbarui, dan memperbaiki.",
                  "bold": true
                },
                {
                  "text": " Anda dapat memperbaiki data yang tidak akurat atau tidak lengkap. Data identitas atau finansial tertentu memerlukan bukti dan verifikasi ulang."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "34.4 "
                },
                {
                  "text": "Hak mengakhiri pemrosesan, menghapus, atau memusnahkan.",
                  "bold": true
                },
                {
                  "text": " Anda dapat mengajukan permintaan jika syarat hukum terpenuhi. Hak ini dapat dibatasi ketika pemrosesan masih diperlukan untuk kewajiban hukum, transaksi, sengketa, penegakan hak, keselamatan, atau kepentingan sah yang mengatasi permintaan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "34.5 "
                },
                {
                  "text": "Hak menarik persetujuan.",
                  "bold": true
                },
                {
                  "text": " Anda dapat menarik persetujuan kapan saja untuk pemrosesan yang memang hanya didasarkan pada persetujuan. Penarikan berlaku ke depan dan dapat menyebabkan fitur opsional tidak tersedia."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "34.6 "
                },
                {
                  "text": "Hak keberatan.",
                  "bold": true
                },
                {
                  "text": " Anda dapat mengajukan keberatan atas tindakan pengambilan keputusan yang hanya didasarkan pada pemrosesan otomatis dan menimbulkan akibat hukum atau dampak signifikan, sesuai hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "34.7 "
                },
                {
                  "text": "Hak menunda atau membatasi pemrosesan.",
                  "bold": true
                },
                {
                  "text": " Anda dapat meminta pembatasan secara proporsional, misalnya selama akurasi data dipersoalkan atau keberatan ditinjau."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "34.8 "
                },
                {
                  "text": "Hak portabilitas.",
                  "bold": true
                },
                {
                  "text": " Jika berlaku dan secara teknis memungkinkan, Anda dapat memperoleh atau memindahkan data yang Anda berikan dalam format yang lazim digunakan dan dapat dibaca sistem."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "34.9 "
                },
                {
                  "text": "Hak menggugat dan menerima ganti rugi.",
                  "bold": true
                },
                {
                  "text": " Anda dapat menggunakan upaya penyelesaian sengketa atau hak lain yang tersedia berdasarkan peraturan perundang-undangan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "34.10 Pelaksanaan hak tidak dipungut biaya kecuali hukum memperbolehkan biaya yang wajar untuk permintaan berulang, berlebihan, atau memerlukan media tertentu. Kami akan memberitahukan dasar biaya sebelum memprosesnya."
                }
              ]
            }
          ]
        },
        {
          "id": "35-cara-mengajukan-permintaan-privasi",
          "title": "35. CARA MENGAJUKAN PERMINTAAN PRIVASI",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "35.1 Ajukan permintaan melalui fitur bantuan atau Chat dengan CS dalam aplikasi, kanal resmi yang ditampilkan pada Layanan, atau surat ke alamat PT Kawal Hak Dengan Aman."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "35.2 Jelaskan hak yang ingin digunakan, ruang lingkup data, akun atau transaksi terkait, dan hasil yang diharapkan. Jangan mengirim kata sandi, PIN, atau OTP."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "35.3 Kami akan memverifikasi identitas dan kewenangan pemohon. Verifikasi dapat menggunakan sesi akun, nomor telepon, pertanyaan terkait transaksi, dokumen terbatas, atau metode lain yang proporsional dengan risiko."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "35.4 Jika permintaan diajukan oleh kuasa, orang tua, wali, atau ahli waris, kami dapat meminta bukti kewenangan dan identitas. Informasi hanya diberikan sejauh kewenangan tersebut sah."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "35.5 Kami akan merespons dalam jangka waktu yang diwajibkan hukum. Jika permintaan kompleks atau berjumlah banyak, kami dapat meminta klarifikasi atau memberi informasi mengenai perpanjangan yang dibolehkan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "35.6 Permintaan dapat ditolak atau dibatasi jika identitas tidak dapat diverifikasi, permintaan melanggar hukum, mengganggu hak orang lain, mengungkap rahasia keamanan, menghambat investigasi, atau termasuk pengecualian hukum. Kami akan menjelaskan alasan sejauh diperbolehkan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "35.7 Anda dapat mengajukan keluhan atau meminta eskalasi apabila tidak puas dengan respons. Hak untuk menghubungi otoritas atau menempuh upaya hukum tetap tersedia sesuai peraturan."
                }
              ]
            }
          ]
        },
        {
          "id": "36-anak-dan-pengguna-yang-belum-cakap",
          "title": "36. ANAK DAN PENGGUNA YANG BELUM CAKAP",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "36.1 Layanan finansial dan kontraktual Kahade ditujukan bagi orang yang cakap melakukan perbuatan hukum atau memiliki persetujuan yang sah dari orang tua atau wali sesuai hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "36.2 Jika Data Pribadi anak diproses, persetujuan orang tua atau wali dan perlindungan khusus akan diterapkan sebagaimana diwajibkan. Kami dapat meminta bukti usia atau hubungan perwalian."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "36.3 Orang tua atau wali yang mengetahui anak memberikan data tanpa persetujuan yang sesuai dapat menghubungi kami. Setelah verifikasi, kami akan membatasi, menghapus, atau menangani data sesuai hukum serta memperhatikan transaksi atau kewajiban yang masih berjalan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "36.4 Pengguna dilarang mempublikasikan identitas, lokasi, dokumen, atau informasi sensitif anak pada etalase, chat, ulasan, dan bukti kecuali benar-benar diperlukan, sah, dan aman."
                }
              ]
            }
          ]
        },
        {
          "id": "37-data-tentang-orang-lain",
          "title": "37. DATA TENTANG ORANG LAIN",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "37.1 Jika Anda memberikan nama, nomor telepon, alamat pengiriman, rekening, dokumen, foto, atau data pihak lain, Anda menyatakan memiliki kewenangan atau dasar yang sah untuk melakukannya dan telah memberi informasi yang diperlukan kepada pihak tersebut."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "37.2 Gunakan data pihak lain hanya untuk tujuan transaksi yang sah. Dilarang menyalin, menggunakan, atau menyebarkannya untuk pemasaran, intimidasi, doxing, penipuan, atau tujuan di luar transaksi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "37.3 Kami dapat menghapus, menyamarkan, atau membatasi data pihak ketiga yang dibagikan tanpa dasar, serta mengambil tindakan terhadap akun yang menyalahgunakannya."
                }
              ]
            }
          ]
        },
        {
          "id": "38-tautan-dan-layanan-pihak-ketiga",
          "title": "38. TAUTAN DAN LAYANAN PIHAK KETIGA",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "38.1 Layanan dapat memuat tautan, tombol berbagi, peta, pembayaran, pengiriman, atau konten pihak ketiga. Ketika Anda berpindah ke layanan tersebut, pihak ketiga dapat mengumpulkan data berdasarkan kebijakannya sendiri."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "38.2 Kehadiran integrasi tidak berarti Kahade mengendalikan seluruh praktik pihak ketiga. Bacalah kebijakan privasi mereka sebelum memberikan data."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "38.3 Jika Anda memilih menghubungkan akun atau layanan pihak ketiga, kami akan memproses data yang dikirim berdasarkan izin yang Anda berikan dan fungsi integrasi. Anda dapat mencabut koneksi jika fitur tersedia, tanpa menghapus data yang telah diproses secara sah."
                }
              ]
            }
          ]
        },
        {
          "id": "39-perubahan-kepemilikan-atau-struktur-usaha",
          "title": "39. PERUBAHAN KEPEMILIKAN ATAU STRUKTUR USAHA",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "39.1 Jika terjadi merger, akuisisi, pendanaan, reorganisasi, pengalihan aset, atau kepailitan, Data Pribadi dapat menjadi bagian dari pemeriksaan dan pengalihan yang sah."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "39.2 Sebelum transaksi selesai, calon penerima hanya mendapat data yang diperlukan dan terikat kerahasiaan. Setelah pengalihan, penerima wajib menggunakan data sesuai Kebijakan ini atau memberi pemberitahuan baru jika tujuan berubah."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "39.3 Jika perubahan mengakibatkan pemrosesan baru yang material, kami akan memberikan pemberitahuan dan meminta persetujuan baru apabila diwajibkan."
                }
              ]
            }
          ]
        },
        {
          "id": "40-perubahan-kebijakan",
          "title": "40. PERUBAHAN KEBIJAKAN",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "40.1 Kami dapat mengubah Kebijakan untuk menyesuaikan fitur, risiko, teknologi, struktur usaha, mitra, atau hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "40.2 Versi terbaru akan memuat tanggal berlaku. Perubahan material akan diberitahukan melalui aplikasi, situs, email, WhatsApp, atau kanal lain yang patut sebelum atau ketika berlaku sesuai hukum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "40.3 Jika perubahan memerlukan persetujuan, kami akan meminta persetujuan yang baru. Penggunaan berkelanjutan tidak dianggap sebagai persetujuan apabila hukum mensyaratkan tindakan persetujuan yang tegas."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "40.4 Versi lama dapat disimpan untuk audit dan pembuktian tentang ketentuan yang berlaku pada waktu tertentu."
                }
              ]
            }
          ]
        },
        {
          "id": "41-hukum-dan-bahasa",
          "title": "41. HUKUM DAN BAHASA",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "41.1 Kebijakan ini ditafsirkan berdasarkan hukum Republik Indonesia. Hak wajib yang diberikan hukum tidak dikesampingkan oleh dokumen ini."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "41.2 Kebijakan disusun dalam Bahasa Indonesia. Jika diterjemahkan, versi Bahasa Indonesia berlaku sepanjang diperbolehkan hukum dan kecuali terjemahan diwajibkan memiliki kedudukan yang sama."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "41.3 Judul bagian membantu navigasi dan tidak membatasi makna ketentuan."
                }
              ]
            }
          ]
        },
        {
          "id": "42-kontak-dan-pengaduan",
          "title": "42. KONTAK DAN PENGADUAN",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "42.1 Pengendali Data Pribadi: "
                },
                {
                  "text": "PT Kawal Hak Dengan Aman",
                  "bold": true
                },
                {
                  "text": "."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "42.2 Alamat korespondensi: "
                },
                {
                  "text": "Jl. Cihideung Udik, Kecamatan Ciampea, Kabupaten Bogor, Jawa Barat 16620, Indonesia",
                  "bold": true
                },
                {
                  "text": "."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "42.3 Kanal elektronik: fitur "
                },
                {
                  "text": "Bantuan",
                  "bold": true
                },
                {
                  "text": " atau "
                },
                {
                  "text": "Chat dengan CS",
                  "bold": true
                },
                {
                  "text": " di aplikasi dan kanal resmi yang ditampilkan pada situs atau aplikasi Kahade. Gunakan hanya kanal yang dapat Anda verifikasi berasal dari Kahade."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "42.4 Agar permintaan dapat ditangani, sertakan nama, username atau nomor telepon akun yang disamarkan seperlunya, jenis permintaan, dan uraian yang jelas. Jangan sertakan PIN, kata sandi, OTP, atau kunci pemulihan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "42.5 Untuk laporan keamanan yang mendesak, nyatakan bahwa laporan berkaitan dengan dugaan pengambilalihan akun, transaksi tidak sah, atau kebocoran data agar dapat diarahkan ke tim terkait. Jangan mengirim data sensitif melalui komentar publik."
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "lampiran-a-peta-kategori-data",
      "title": "LAMPIRAN A — PETA KATEGORI DATA",
      "sections": [
        {
          "id": "a-1-identitas-dan-kontak",
          "title": "A.1 Identitas dan kontak",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Data dapat meliputi nama lengkap, username, nomor telepon, email, tanggal lahir, jenis kelamin, alamat, dan informasi kontak yang dipilih untuk ditampilkan. Data digunakan untuk pendaftaran, identifikasi, komunikasi, KYC, transaksi, keamanan, dan dukungan. Penerima dapat meliputi pihak transaksi, penyedia komunikasi, verifikasi, pembayaran, dan otoritas sesuai kebutuhan."
                }
              ]
            }
          ]
        },
        {
          "id": "a-2-kredensial-dan-autentikasi",
          "title": "A.2 Kredensial dan autentikasi",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Data dapat meliputi hash kata sandi, hash PIN, status OTP, token sesi, waktu login, perangkat tepercaya, dan status penguncian. Data digunakan untuk autentikasi, pemulihan, pencegahan pengambilalihan, dan audit. Kredensial rahasia tidak dibagikan kepada pengguna lain."
                }
              ]
            }
          ]
        },
        {
          "id": "a-3-kyc-dan-verifikasi",
          "title": "A.3 KYC dan verifikasi",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Data dapat meliputi nomor identitas, jenis dokumen, foto dokumen, selfie, liveness, hash identitas, status, alasan hasil, dan catatan pemeriksaan. Data digunakan untuk verifikasi, kepatuhan, pencegahan akun ganda, dan keamanan finansial. Akses dibatasi pada petugas serta penyedia yang memerlukan."
                }
              ]
            }
          ]
        },
        {
          "id": "a-4-profil-dan-sosial",
          "title": "A.4 Profil dan sosial",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Data dapat meliputi foto, header, bio, lencana, statistik, pengikut, akun diikuti, suka, komentar, ulasan, etalase, dan interaksi. Data digunakan untuk menampilkan identitas, reputasi, penemuan konten, dan komunitas. Elemen publik dapat dilihat siapa pun sesuai pengaturan."
                }
              ]
            }
          ]
        },
        {
          "id": "a-5-escrow-dan-pesanan",
          "title": "A.5 Pengamanan dana dan pesanan",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Data dapat meliputi pihak transaksi, objek, harga, biaya, instruksi, status, tenggat, konfirmasi, pembatalan, refund, pengiriman, dan riwayat. Data digunakan untuk menjalankan perjanjian, melepaskan atau mengembalikan dana, menyelesaikan sengketa, dan audit."
                }
              ]
            }
          ]
        },
        {
          "id": "a-6-dompet-dan-pembayaran",
          "title": "A.6 Dompet dan pembayaran",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Data dapat meliputi saldo, mutasi, top up, penarikan, transfer, fee, referensi, metode, rekening, nama pemilik, status, dan rekonsiliasi. Data digunakan untuk pencatatan nilai, pemrosesan pembayaran, keamanan, pembukuan, dan kepatuhan."
                }
              ]
            }
          ]
        },
        {
          "id": "a-7-komunikasi",
          "title": "A.7 Komunikasi",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Data dapat meliputi chat, lampiran, pesan suara, reaksi, edit, status baca, komunikasi CS, notifikasi, dan konfirmasi pengiriman. Data digunakan untuk komunikasi, dukungan, bukti, moderasi, keamanan, dan peningkatan mutu."
                }
              ]
            }
          ]
        },
        {
          "id": "a-8-sengketa-dan-moderasi",
          "title": "A.8 Sengketa dan moderasi",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Data dapat meliputi laporan, kronologi, bukti, pihak terkait, kategori, keputusan, catatan admin, dan tindakan. Data digunakan untuk menilai sengketa, melindungi pengguna, menangani konten, dan menegakkan ketentuan."
                }
              ]
            }
          ]
        },
        {
          "id": "a-9-perangkat-jaringan-dan-lokasi",
          "title": "A.9 Perangkat, jaringan, dan lokasi",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Data dapat meliputi pengenal perangkat, sistem operasi, browser, versi aplikasi, IP, token push, koordinat, akurasi, sumber lokasi, dan waktu. Data digunakan untuk sesi, keamanan, notifikasi, pencegahan penipuan, dan diagnosis."
                }
              ]
            }
          ]
        },
        {
          "id": "a-10-penggunaan-dan-diagnostik",
          "title": "A.10 Penggunaan dan diagnostik",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Data dapat meliputi event fitur, halaman, crash, error, performa, log API, bahasa, zona waktu, dan metrik agregat. Data digunakan untuk operasi, pengujian, kapasitas, analitik, dan perbaikan."
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "lampiran-b-pemrosesan-menurut-fitur",
      "title": "LAMPIRAN B — PEMROSESAN MENURUT FITUR",
      "sections": [
        {
          "id": "b-1-pendaftaran-dengan-nomor-telepon",
          "title": "B.1 Pendaftaran dengan nomor telepon",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Kahade meminta nomor telepon, nama, username, kata sandi, dan data profil minimum. Nomor diverifikasi melalui OTP WhatsApp. Log permintaan dan verifikasi dipakai untuk mencegah penyalahgunaan. Jika registrasi tidak selesai, data sementara dapat disimpan terbatas untuk keamanan dan kemudian dihapus sesuai jadwal."
                }
              ]
            }
          ]
        },
        {
          "id": "b-2-login-dengan-username-nomor-telepon-atau-ema",
          "title": "B.2 Login dengan username, nomor telepon, atau email",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Identifier yang Anda masukkan dicocokkan dengan akun. Sistem memproses hash kata sandi, IP, perangkat, waktu, lokasi jika diminta, dan hasil percobaan. Percobaan gagal berulang dapat menyebabkan pembatasan sementara."
                }
              ]
            }
          ]
        },
        {
          "id": "b-3-pemulihan-akses",
          "title": "B.3 Pemulihan akses",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Kami dapat memproses nomor telepon, status verifikasi, lokasi, perangkat, riwayat akun, dan langkah pemulihan. Perubahan kata sandi dapat mencabut sesi lama. Catatan pemulihan dipertahankan untuk audit keamanan."
                }
              ]
            }
          ]
        },
        {
          "id": "b-4-verifikasi-kyc",
          "title": "B.4 Verifikasi KYC",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Anda mengunggah dokumen dan selfie atau liveness. Sistem dan petugas menilai kelengkapan, keaslian, kecocokan, duplikasi, dan risiko. Hasil dapat berupa disetujui, ditolak, atau diminta perbaikan. Data tidak digunakan untuk meniru identitas atau tujuan yang tidak diberitahukan."
                }
              ]
            }
          ]
        },
        {
          "id": "b-5-membuat-transaksi-escrow",
          "title": "B.5 Membuat transaksi",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Pembuat transaksi memasukkan pihak, objek, nilai, syarat, pengiriman, dan tenggat. Data ditampilkan kepada pihak yang diundang untuk ditinjau. Setelah disetujui, catatan digunakan untuk mengendalikan status dan dana."
                }
              ]
            }
          ]
        },
        {
          "id": "b-6-membayar-dan-mengisi-saldo",
          "title": "B.6 Membayar dan mengisi saldo",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Kahade mengirim data minimum kepada kanal pembayaran dan menerima referensi serta status. Sistem mencocokkan pemberitahuan mitra dengan transaksi internal, menjaga idempotensi, dan mencatat hasil rekonsiliasi."
                }
              ]
            }
          ]
        },
        {
          "id": "b-7-mengirim-atau-menerima-barang",
          "title": "B.7 Mengirim atau menerima barang",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Alamat, nama penerima, kontak, kurir, dan resi diberikan kepada pihak yang memerlukan. Informasi pelacakan digunakan untuk memperbarui status dan dapat menjadi bukti bila terjadi sengketa."
                }
              ]
            }
          ]
        },
        {
          "id": "b-8-mengonfirmasi-dan-melepaskan-dana",
          "title": "B.8 Mengonfirmasi dan melepaskan dana",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Konfirmasi, waktu, perangkat, PIN, lokasi jika diminta, dan status transaksi diproses untuk memastikan tindakan dilakukan pihak berwenang. Catatan pelepasan dana dipertahankan sebagai bukti finansial."
                }
              ]
            }
          ]
        },
        {
          "id": "b-9-penarikan-dana",
          "title": "B.9 Penarikan dana",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Kahade memproses rekening tujuan, nominal, biaya, PIN atau autentikasi, lokasi jika diminta, pemeriksaan risiko, dan hasil mitra. Penarikan dapat ditangguhkan sementara untuk verifikasi atau kepatuhan."
                }
              ]
            }
          ]
        },
        {
          "id": "b-10-mengajukan-sengketa",
          "title": "B.10 Mengajukan sengketa",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Para pihak memasukkan kronologi dan bukti. Admin dapat melihat transaksi, chat, pembayaran, pengiriman, dan catatan relevan. Keputusan dan alasannya dicatat. Data yang tidak relevan dapat disamarkan."
                }
              ]
            }
          ]
        },
        {
          "id": "b-11-membuat-etalase",
          "title": "B.11 Membuat etalase",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Judul, deskripsi, harga, kategori, gambar, dan visibilitas diproses untuk publikasi dan penemuan. Statistik interaksi dihitung. Konten publik dapat dibagikan ke luar aplikasi oleh pengguna."
                }
              ]
            }
          ]
        },
        {
          "id": "b-12-mengikuti-menyukai-dan-berkomentar",
          "title": "B.12 Mengikuti, menyukai, dan berkomentar",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Identitas profil, objek interaksi, waktu, dan isi komentar diproses agar fitur bekerja dan untuk moderasi. Pengguna lain dapat melihat interaksi sesuai desain dan pengaturan."
                }
              ]
            }
          ]
        },
        {
          "id": "b-13-mengirim-pesan-langsung",
          "title": "B.13 Mengirim pesan langsung",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Identitas para pihak, isi, lampiran, reaksi, waktu, dan status baca diproses untuk menyampaikan percakapan. Pesan dapat ditinjau jika dilaporkan atau berkaitan dengan sengketa dan keamanan."
                }
              ]
            }
          ]
        },
        {
          "id": "b-14-menghubungi-cs",
          "title": "B.14 Menghubungi CS",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Kahade menghubungkan pertanyaan dengan akun dan transaksi yang relevan. Petugas dapat meminta verifikasi tambahan sebelum membahas data sensitif. Percakapan dicatat untuk kelanjutan penanganan."
                }
              ]
            }
          ]
        },
        {
          "id": "b-15-menghapus-akun",
          "title": "B.15 Menghapus akun",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Sistem memverifikasi pemohon, memeriksa saldo dan kewajiban, menutup akses, menyamarkan profil, dan menjadwalkan data yang dapat dihapus. Catatan wajib tetap dibatasi dan tidak digunakan untuk tujuan baru yang tidak kompatibel."
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "lampiran-c-pilihan-dan-konsekuensi",
      "title": "LAMPIRAN C — PILIHAN DAN KONSEKUENSI",
      "sections": [
        {
          "id": "c-1-tidak-memberikan-nomor-telepon",
          "title": "C.1 Tidak memberikan nomor telepon",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Tanpa nomor telepon yang dapat diverifikasi, Anda tidak dapat membuat akun baru karena nomor telepon merupakan identitas utama pendaftaran."
                }
              ]
            }
          ]
        },
        {
          "id": "c-2-tidak-menyelesaikan-kyc",
          "title": "C.2 Tidak menyelesaikan KYC",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Anda tetap dapat menggunakan fitur yang tidak mensyaratkan KYC, jika tersedia. Fitur finansial, batas, penarikan, atau transaksi tertentu dapat dibatasi sesuai risiko dan ketentuan."
                }
              ]
            }
          ]
        },
        {
          "id": "c-3-tidak-memberikan-lokasi",
          "title": "C.3 Tidak memberikan lokasi",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Kahade dapat menggunakan verifikasi alternatif jika tersedia. Tindakan berisiko dapat ditunda atau ditolak apabila lokasi diperlukan untuk keamanan atau kepatuhan."
                }
              ]
            }
          ]
        },
        {
          "id": "c-4-menonaktifkan-notifikasi",
          "title": "C.4 Menonaktifkan notifikasi",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Anda mungkin tidak menerima pemberitahuan segera pada perangkat. Informasi penting tetap tersedia di aplikasi atau dikirim melalui kanal lain jika diperlukan."
                }
              ]
            }
          ]
        },
        {
          "id": "c-5-menyembunyikan-profil-atau-konten",
          "title": "C.5 Menyembunyikan profil atau konten",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Konten yang disetel privat tidak muncul di area publik, tetapi dapat tetap diproses untuk penyimpanan, keamanan, dukungan, atau kewajiban. Interaksi lama yang telah dilihat pihak lain tidak dapat ditarik dari perangkat mereka."
                }
              ]
            }
          ]
        },
        {
          "id": "c-6-menarik-persetujuan-pemasaran",
          "title": "C.6 Menarik persetujuan pemasaran",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Anda berhenti menerima pemasaran melalui kanal terkait setelah preferensi diproses. Pesan transaksi, keamanan, dan hukum tetap dapat dikirim."
                }
              ]
            }
          ]
        },
        {
          "id": "c-7-meminta-penghapusan",
          "title": "C.7 Meminta penghapusan",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Data yang tidak lagi diperlukan akan dijadwalkan untuk dihapus. Catatan finansial, sengketa, audit, keamanan, dan data yang diwajibkan hukum dapat dipertahankan secara terbatas."
                }
              ]
            }
          ]
        },
        {
          "id": "c-8-meminta-portabilitas",
          "title": "C.8 Meminta portabilitas",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Kami dapat menyediakan data yang Anda berikan dan yang memenuhi syarat dalam format yang tersedia. Data internal, rahasia keamanan, hak pihak lain, dan analisis yang bukan cakupan hak dapat dikecualikan."
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "lampiran-d-standar-penanganan-permintaan",
      "title": "LAMPIRAN D — STANDAR PENANGANAN PERMINTAAN",
      "sections": [
        {
          "id": "d-1-penerimaan",
          "title": "D.1 Penerimaan",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Permintaan dicatat dengan waktu, kanal, ruang lingkup, dan identitas akun. Petugas tidak boleh meminta kredensial rahasia."
                }
              ]
            }
          ]
        },
        {
          "id": "d-2-verifikasi",
          "title": "D.2 Verifikasi",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Tingkat verifikasi disesuaikan dengan risiko. Permintaan salinan data KYC atau finansial memerlukan verifikasi lebih kuat daripada pembaruan preferensi biasa."
                }
              ]
            }
          ]
        },
        {
          "id": "d-3-pencarian",
          "title": "D.3 Pencarian",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Tim menelusuri sistem aktif, arsip yang relevan, penyedia yang bertindak sebagai prosesor, serta data yang secara wajar dapat dikaitkan dengan pemohon."
                }
              ]
            }
          ]
        },
        {
          "id": "d-4-penilaian",
          "title": "D.4 Penilaian",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Data pihak lain, rahasia dagang, informasi keamanan, kewajiban retensi, sengketa, dan pengecualian hukum ditinjau sebelum respons."
                }
              ]
            }
          ]
        },
        {
          "id": "d-5-tindakan",
          "title": "D.5 Tindakan",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Data dapat diberikan, dikoreksi, dibatasi, dihapus, dianonimkan, atau dipertahankan dengan alasan. Perubahan penting dicatat untuk audit."
                }
              ]
            }
          ]
        },
        {
          "id": "d-6-respons",
          "title": "D.6 Respons",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Pemohon menerima hasil dan penjelasan yang dapat dipahami, termasuk bagian yang tidak dapat dipenuhi dan jalur eskalasi yang tersedia."
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "lampiran-e-tanggung-jawab-pengguna",
      "title": "LAMPIRAN E — TANGGUNG JAWAB PENGGUNA",
      "sections": [
        {
          "id": "lampiran-e-tanggung-jawab-pengguna-2",
          "title": "LAMPIRAN E — TANGGUNG JAWAB PENGGUNA",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "E.1 Berikan data yang benar, relevan, dan mutakhir."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "E.2 Gunakan kata sandi unik dan jangan membagikan PIN atau OTP."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "E.3 Pastikan nomor telepon dan perangkat tetap berada dalam kendali Anda."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "E.4 Tinjau penerima, nilai, biaya, dan detail sebelum menyetujui transaksi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "E.5 Jangan menaruh data sensitif pada profil, etalase, komentar, atau utas publik."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "E.6 Hanya berikan data pihak lain jika Anda berwenang."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "E.7 Laporkan perangkat, sesi, pesan, atau transaksi yang tidak dikenal."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "E.8 Perbarui aplikasi dan sistem operasi untuk menerima perbaikan keamanan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "E.9 Gunakan kanal resmi dan waspadai tautan atau akun yang meniru Kahade."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "E.10 Simpan bukti transaksi dan sengketa secara aman serta jangan menyebarluaskannya tanpa dasar."
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "lampiran-f-glosarium-operasional",
      "title": "LAMPIRAN F — GLOSARIUM OPERASIONAL",
      "sections": [
        {
          "id": "lampiran-f-glosarium-operasional-2",
          "title": "LAMPIRAN F — GLOSARIUM OPERASIONAL",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Akun:",
                  "bold": true
                },
                {
                  "text": " identitas digital pengguna beserta profil, pengaturan, sesi, dan hak aksesnya."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Alamat IP:",
                  "bold": true
                },
                {
                  "text": " nomor jaringan yang dapat digunakan untuk menghubungkan perangkat ke internet dan memperkirakan lokasi umum."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Anonimisasi:",
                  "bold": true
                },
                {
                  "text": " proses mengubah data agar tidak dapat lagi dikaitkan secara wajar dengan individu tertentu."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Data biometrik:",
                  "bold": true
                },
                {
                  "text": " data yang berasal dari pemrosesan teknis karakteristik fisik, fisiologis, atau perilaku untuk memungkinkan identifikasi unik."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Hash:",
                  "bold": true
                },
                {
                  "text": " hasil fungsi satu arah yang digunakan antara lain untuk membandingkan nilai tanpa menyimpan nilai asli dalam bentuk terbaca."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Idempotensi:",
                  "bold": true
                },
                {
                  "text": " mekanisme agar instruksi yang sama tidak menghasilkan pembukuan atau tindakan berulang."
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
                  "text": " proses mengenali dan memverifikasi identitas pengguna."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Liveness:",
                  "bold": true
                },
                {
                  "text": " pemeriksaan untuk menilai bahwa materi wajah berasal dari orang nyata yang hadir pada saat verifikasi, bukan sekadar salinan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Penganoniman:",
                  "bold": true
                },
                {
                  "text": " lihat Anonimisasi."
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
                  "text": " pihak yang menentukan tujuan dan melakukan kendali atas pemrosesan Data Pribadi."
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
                  "text": " pihak yang memproses Data Pribadi atas nama dan berdasarkan instruksi pengendali."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Profiling:",
                  "bold": true
                },
                {
                  "text": " pemrosesan untuk menilai aspek tertentu tentang seseorang, seperti risiko transaksi atau pola penggunaan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Pseudonimisasi:",
                  "bold": true
                },
                {
                  "text": " pemisahan pengenal langsung dari data dan penggantian dengan kode; data masih dapat dikaitkan kembali dengan informasi tambahan yang dilindungi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Rekonsiliasi:",
                  "bold": true
                },
                {
                  "text": " pencocokan catatan antara Kahade, bank, penyedia pembayaran, dan transaksi untuk memastikan jumlah dan status konsisten."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Sengketa:",
                  "bold": true
                },
                {
                  "text": " proses penanganan ketidaksepakatan mengenai pelaksanaan transaksi, pengiriman, penerimaan, kualitas, pembayaran, atau pelepasan dana."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Token sesi:",
                  "bold": true
                },
                {
                  "text": " pengenal teknis yang memungkinkan sistem mengenali sesi pengguna yang telah diautentikasi."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Webhooks:",
                  "bold": true
                },
                {
                  "text": " pemberitahuan sistem-ke-sistem yang digunakan mitra untuk menyampaikan perubahan status, misalnya pembayaran berhasil atau gagal."
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "lampiran-g-rujukan-hukum-utama",
      "title": "LAMPIRAN G — RUJUKAN HUKUM UTAMA",
      "sections": [
        {
          "id": "lampiran-g-rujukan-hukum-utama-2",
          "title": "LAMPIRAN G — RUJUKAN HUKUM UTAMA",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "1. Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi. Sumber resmi JDIH BPK:"
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "2. Peraturan Pemerintah Nomor 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik. Sumber resmi JDIH BPK:"
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Rujukan ini dicantumkan untuk memudahkan pembaca. Peraturan pelaksana, perubahan, putusan pengadilan, serta ketentuan sektoral lain dapat berlaku sesuai jenis layanan dan keadaan pemrosesan."
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "lampiran-h-komitmen-transparansi-per-fitur-baru",
      "title": "LAMPIRAN H — KOMITMEN TRANSPARANSI PER FITUR BARU",
      "sections": [
        {
          "id": "lampiran-h-komitmen-transparansi-per-fitur-baru-2",
          "title": "LAMPIRAN H — KOMITMEN TRANSPARANSI PER FITUR BARU",
          "paragraphs": [
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Sebelum meluncurkan fitur yang secara material memperluas kategori data, tujuan, penerima, lokasi pemrosesan, atau dampak terhadap pengguna, Kahade akan menilai kebutuhan pembaruan pemberitahuan privasi. Pemberitahuan singkat pada layar fitur dapat menjelaskan data yang diminta, alasan, apakah wajib atau opsional, dan konsekuensi jika ditolak."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Fitur yang menggunakan kamera, mikrofon, lokasi, identitas, rekening, atau otomatisasi berisiko tinggi harus meminta akses pada saat relevan, bukan semata-mata saat aplikasi pertama dibuka. Data tidak boleh digunakan untuk tujuan baru yang tidak kompatibel tanpa dasar yang sah dan pemberitahuan yang layak."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Jika fitur baru melibatkan keputusan otomatis yang berdampak signifikan, Data Pribadi yang bersifat spesifik, pemantauan sistematis, atau transfer lintas batas berisiko tinggi, Kahade akan melakukan penilaian dampak pelindungan data apabila diwajibkan atau secara wajar diperlukan."
                }
              ]
            },
            {
              "kind": "p",
              "segments": [
                {
                  "text": "Akhir Kebijakan Privasi Kahade — Draf Versi 1.0, disusun 27 September 2026; berlaku sejak tanggal publikasi resmi.",
                  "bold": true
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
