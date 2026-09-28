/**
 * ST-008 (PERF-FIX 2026-09-29) — deklarasi tipe untuk deep import
 * `qrcode/lib/core/qrcode`.
 *
 * Konteks: `import QRCode from "qrcode"` di-resolve Metro lewat field
 * `browser` package qrcode ke `lib/browser.js` — BUKAN ke server build
 * (`lib/server.js` + pngjs/yargs/fs). Jadi tidak ada polyfill Node
 * (buffer/stream/process) di bundle; klaim "polyfill ~260KB" tidak
 * terbukti di bundle hasil `expo export` (baseline .hbc 10.119.461 byte,
 * 2026-09-29: nol kemunculan marker buffer/readable-stream/process).
 *
 * Yang masih bisa dirampingkan: `lib/browser.js` ikut menarik renderer
 * canvas (butuh DOM — tidak pernah jalan di native) dan svg-tag (tidak
 * dipakai siapa pun; QRCodeDisplay membangun path SVG sendiri dari
 * matriks). Pemakaian yang hanya butuh `create()` — seperti
 * <QRCodeDisplay> — mengimpor inti langsung dari file ini sehingga dua
 * renderer mati itu keluar dari graf require.
 *
 * `lib/receipt.ts` tetap memakai entry utama karena butuh `toDataURL()`
 * (renderer canvas, hanya bermakna di web).
 */
declare module "qrcode/lib/core/qrcode" {
  import type { QRCode, QRCodeOptions } from "qrcode";

  /**
   * Sama dengan `QRCode.create` dari entry utama — hanya inti pembuatan
   * matriks QR ( Reed-Solomon, masking, dsb.), tanpa renderer apa pun.
   */
  export function create(data: string, options?: QRCodeOptions): QRCode;
}
