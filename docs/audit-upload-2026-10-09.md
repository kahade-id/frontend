# Audit upload — temuan (2026-10-09)

Simptom user: upload foto etalase & avatar profil gagal "Tidak ada koneksi internet"
padahal 4G aktif. Audit seluruh titik upload (foto, video, dokumen, avatar, voice note).
Semua temuan di bawah terbukti dari kode; baris merujuk commit `7ce4e37`.

## A. Akar penyebab "semua kegagalan jadi 'Tidak ada koneksi internet'"

1. **A1 — `lib/api/errors.ts:620-629` (`userMessage`)**: untuk kode `NETWORK`,
   `TIMEOUT`, `SERVER`, `PARSE`, pesan yang sudah dikarang upload layer
   DISAMPINGKAN dan diganti `DEFAULT_ERROR_MESSAGES[code]`. Akibatnya:
   - timeout upload → "Server terlalu lama merespons." (salah: yang lambat
     koneksi pengirim, bukan server — syarat minta "Koneksi lambat, coba lagi");
   - 413 → "Ukuran berkas terlalu besar." (tanpa batas "maks X MB");
   - 5xx → "Terjadi gangguan di server kami." (bukan "Server bermasalah");
   - kegagalan transport → "Tidak ada koneksi internet. Periksa jaringan
     lalu coba lagi." — **meski perangkat online** (lihat A2).
   Pesan-pesan ini juga tidak membedakan offline TERVERIFIKASI vs transport
   yang terputus di jaringan yang tidak stabil.

2. **A2 — `lib/api/client.ts` `bounded()` (±baris 190-215)**: setiap error
   non-`ApiError` dari `fetch` (TypeError "Network request failed" — socket
   reset di 4G tidak stabil, TLS drop, kegagalan baca `content://` saat
   menyusun multipart) dibungkus sebagai `code: "NETWORK"` → A1 →
   "Tidak ada koneksi internet". Tidak ada pengecekan NetInfo saat
   klasifikasi — offline disimpulkan dari kegagalan request, persis kebalikan
   dari yang disyaratkan.

3. **A3 — Jalur XHR tanpa cek NetInfo pra-upload**: `uploadDirectVideo`
   (`lib/api/upload.ts` `sendOnce`, ±baris 330-420), `xhrPostMultipart`
   (±baris 660-760), `uploadChatAttachmentProgress`
   (`lib/api/chat.ts:960-1060`) tidak pernah mengecek `isOfflineKnown()`
   sebelum mengirim. Perangkat offline → XHR `onerror` → `NETWORK` → A1.
   (Jalur fetch via `http.*` TIDAK kena ini — ada gerbang offline di
   `request()` `lib/api/client.ts:±460` → `OfflineError` — sehingga perilaku
   antar jalur upload tidak konsisten.)

## B. Timeout tidak proporsional (default 20 detik)

`API_TIMEOUT_MS = 20_000` (`lib/api/config.ts:19`). Panggilan upload yang
TIDAK mengirim `timeoutMs` eksplisit:

4. **B1 — `lib/showcase-upload.ts:76`**: `uploadDirect(formData, signal)`
   tanpa `timeoutMs` — foto etalase (sampai 5 MB) di 4G lambat lewat 20 detik
   → `TIMEOUT`. **Ini jalur foto etalase yang dilaporkan user.**
5. **B2 — `app/(auth)/setup-profile.tsx:222`**: `uploadAvatarDirect(formData)`
   tanpa `timeoutMs` — jalur avatar saat onboarding setup profil (avatar dari
   `use-avatar-upload.ts` & `edit-profile.tsx` sudah pass `timeoutMs`).
6. **B3 — `components/screens/dispute-detail-screen.tsx:476`**:
   `uploadDirect(formData)` (dokumen lampiran pesan sengketa) tanpa `timeoutMs`.
7. **B4 — `lib/api/story.ts:555`**: `uploadStoryMedia` via `http.post` tanpa
   `timeoutMs` — foto story sampai 10 MB (kontrak `docs/integrasi_backend.md:287`)
   mustahil lolos 20 detik di koneksi lambat.
8. **B5 — `lib/api/chat.ts:873-879`**: `uploadChatAttachment` (jalur fetch,
   tanpa `timeoutMs`) — **dead code** (nol pemanggil; yang dipakai
   `uploadChatAttachmentProgress` baris 923, sudah adaptif). Dibiarkan hidup
   = undangan regresi ke jalur 20 detik.
9. **B6 — rumus timeout ganda & tidak konsisten**:
   `lib/photo-upload-guards.ts:53-55` (`photoUploadTimeoutMs`: basis 20 dtk,
   cap 120 dtk) vs `lib/api/upload.ts:1011-1013` (`uploadDirectImage`: basis
   60 dtk, cap 300 dtk) vs `lib/api/upload.ts:301-303` & `lib/api/chat.ts:950-952`
   (video: basis 120 dtk, cap 30 mnt). Avatar memakai rumus paling lemah:
   2 MB @ 100 KB/s ≈ 20,5 dtk transfer + proses server > batas 23 dtk rumus.

## C. Kompresi & progress

10. **C1 — Story tidak dikompresi**: `components/screens/story-create-screen.tsx:217`
    mengirim aset mentah (kamera 4000 px) tanpa `resizePickedImage` — semua
    jalur foto lain (etalase, avatar, header, chat, KYC, dsb.) sudah resize
    1920 px / JPEG 0.8 di `lib/image-picker.ts:99-135`.
11. **C2 — Foto story tanpa guard 10 MB**: batas server
    (`docs/integrasi_backend.md:287`, 413 `STORY_MEDIA_TOO_LARGE`
    `docs/integrasi_backend.md:74`) tidak ditiru klien → gagal misterius
    di server (bandingkan `validateChatAttachment` / `validateAvatarAsset`
    yang sudah menolak dini dengan pesan menyebut batas).
12. **C3 — Progress foto tidak jujur-0-100**: foto diunggah via `fetch`
    (`http.post`/`uploadDirect`) yang tidak melaporkan progress byte, jadi UI
    etalase hanya menghitung "foto x dari y" (`showcase-create-screen.tsx`)
    dan avatar memakai bar indeterminate (`use-avatar-upload.ts`). Jalur
    video sudah XHR + progress byte jujur — foto seharusnya bisa sama.

## D. Batalkan per file

13. **D1 — Etalase**: `showcase-create-screen.tsx` &
    `showcase-management-screen.tsx` membuat `AbortController` tapi hanya
    dipakai saat unmount/back-blokir — **tidak ada tombol batalkan** untuk
    file yang sedang di-upload (photo batch maupun video).
14. **D2 — Avatar**: `lib/use-avatar-upload.ts` tidak meneruskan `AbortSignal`
    ke `uploadAvatarDirect` — avatar yang sedang di-upload tidak bisa
    dibatalkan.
15. **D3 — Lampiran pesan sengketa**: `dispute-detail-screen.tsx:446-486`
    (`uploadMessageFile`) tidak memakai signal sama sekali — tidak bisa
    dibatalkan (chip lampiran chat punya "Batal", sengketa tidak).

## E. Retry hanya yang gagal

16. **E1 — `showcase-management-screen.tsx:698-740`**: loop upload foto
    sekuer — satu gagal = seluruh batch berhenti, kunci yang SUKSES ikut
    dibersihkan, dan tidak ada retry per file (layar create punya
    `retryFailedPhotos`, management tidak).
17. **E2 — `app/kyc.tsx:247-262`**: submit KYC mengunggah KTP+SELFIE paralel;
    satu gagal → semua kunci dibersihkan (G-04) → submit ulang = KEDUA
    dokumen diunggah ulang dari nol.
18. **E3 — Backoff**: jalur XHR video (`uploadDirectVideo`) sudah retry
    transien dengan backoff eksponensial (NP-006, maks 2 ulang). Jalur foto
    (fetch) TIDAK pernah retry otomatis (kebijakan mutasi client.ts) padahal
    upload bukan mutasi keuangan — timeout sesaat di 4G gagal total padahal
    retry 1–2 kali biasanya berhasil.

## F. Pesan per tipe kegagalan (sel-syarat)

19. **F1 — 413 tanpa batas**: default `PAYLOAD_TOO_LARGE`
    ("Ukuran berkas terlalu besar.") tidak menyebut "maks X MB" seperti
    disyaratkan; batas per purpose sebenarnya diketahui klien
    (`AVATAR_MAX_MB=2`, `HEADER_MAX_MB=5`, `SHOWCASE_IMAGE_MAX_BYTES=5 MB`,
    `SHOWCASE_VIDEO_MAX_BYTES=100 MB`, `CHAT_ATTACHMENT_MAX_BYTES=50 MB`,
    KYC 5 MB, story 10 MB).
20. **F2 — copy error video terpotong**: `VIDEO_UPLOAD_ERROR_COPY`
    (`lib/api/upload.ts`) hanya dipakai jalur video; kegagalan 413/MIME di
    jalur foto (direct) jatuh ke A1 generik. `UPLOAD_FAILED` bahkan
    dipetakan ke "Periksa koneksi lalu coba lagi" padahal artinya umum.

## G. Kontrak API (verifikasi vs dokumen backend)

21. **G1 — spec basi**: `docs/api/kahade-api-mobile.json` (generasi lama):
    enum `purpose` `/v1/upload/direct` tak memuat `SHOWCASE_VIDEO` &
    `MILESTONE_EVIDENCE` (keduanya dikirim klien: `lib/showcase-upload.ts:169`,
    `app/milestones/[id].tsx:198`); endpoint `/v1/stories/media` &
    `/v1/upload/chunked/*` tidak ada di spec; presigned URL masih disebut
    "diuntungkan" padahal backend sudah mematikan (DEPRECATED 400, catatan
    BFE-115 di `lib/api/upload.ts`). Kontrak aktual terdokumentasi di kode
    (referensi file BE) & `docs/integrasi_backend.md` — **catatan saja,
    tidak mengubah purpose yang dikirim**.
22. **G2 — field yang dikirim**: diverifikasi sesuai — `file` + `purpose`
    (direct), `file` (avatar/header/chat/story), chunked: `chunk`+`chunkIndex`;
    MIME diturunkan dari ekstensi bila platform tak melaporkan
    (`lib/image-picker.ts:60-78, 117-133` — UMD-005/BFI-102) sehingga
    `MIME_TYPE_MISMATCH` magic-byte tidak terjadi karena label salah;
    Idempotency-Key dikirim di chat (BFE-001). Tidak ditemukan field salah.
23. **G3 — `uploadChatAttachment`** (`lib/api/chat.ts:873`) tidak mengirim
    Idempotency-Key (butuh untuk endpoint @Idempotency) — bukti lain jalur
    ini mati/tak pernah benar; dihapus.

## H. Tidak ditemukan (jujur)

- **Kompresi video**: tidak ada SDK transcoder di `package.json`; video
  100 MB dikirim apa adanya (sudah dijaga batas + chunked/resumable NP-006).
  Memasang transcoder = dependensi baru, di luar audit ini.
- Endpoint upload lain di luar daftar di atas tidak ditemukan (sweep
  `FormData`/`DocumentPicker` di `app/`, `components/`, `lib/`).
