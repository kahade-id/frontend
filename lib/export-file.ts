/**
 * Kahade — menyimpan berkas hasil export (CSV / HTML-cetak) ke perangkat.
 *
 * Sebelumnya blok ini ditulis inline di `app/(tabs)/wallet.tsx` dan akan
 * disalin lagi ke `app/analytics.tsx` (unduh riwayat transaksi) serta
 * `app/wallet-history.tsx`. Tiga salinan = tiga tempat yang bisa lupa salah
 * satu detail di bawah ini, dan detailnya justru yang membuat unduhan batal:
 *
 *   - Web: anchor HARUS berada di dokumen agar Firefox menghormati `click()`,
 *     dan blob URL harus hidup lebih lama dari klik itu — `revokeObjectURL`
 *     sinkron membatalkan unduhan di Firefox (dan di Chromium untuk blob
 *     besar). Karena itu revoke dijadwalkan pada macrotask berikutnya.
 *   - Native: `expo-file-system` (API `File`/`Paths`) menulis ke cache, lalu
 *     `shareContent()` membuka share sheet OS — RN `Share` di Android tidak
 *     bisa melampirkan berkas, jadi jalur file selalu lewat expo-sharing.
 *
 * `toCsv()` disertakan di sini karena ekspor riwayat transaksi pesanan
 * dibangun di klien (backend tidak punya endpoint export order): pemisah
 * desimal Indonesia (koma) membuat CSV naive rusak, jadi quoting/escaping
 * harus satu implementasi yang diuji.
 */
import { Platform } from "react-native"
import { File, Paths } from "expo-file-system"

import { shareContent } from "@/lib/share"

export type SavedFile = {
  /** "downloaded" = browser menyimpan berkas; "shared" = share sheet native dibuka */
  kind: "downloaded" | "shared"
  filename: string
}

/** Simpan Blob sebagai berkas: unduhan di web, share sheet di native. */
export async function saveBlobFile(
  blob: Blob,
  filename: string,
  mimeType: string,
): Promise<SavedFile> {
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.rel = "noopener"
    a.style.display = "none"
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      a.remove()
      URL.revokeObjectURL(url)
    }, 0)
    return { kind: "downloaded", filename }
  }

  const file = new File(Paths.cache, filename)
  file.write(new Uint8Array(await blob.arrayBuffer()))
  await shareContent({ fileUri: file.uri, mimeType, dialogTitle: filename })
  return { kind: "shared", filename }
}

/**
 * Simpan TEKS sebagai berkas (struk HTML invoice, log, dsb).
 *
 * Kenapa bukan `saveBlobFile(new Blob([text]))`: konstruktor Blob + round-trip
 * `arrayBuffer()` tidak konsisten di semua runtime RN, sementara
 * `File.write(string)` adalah jalur yang didokumentasikan expo-file-system
 * untuk teks. Di web tetap lewat Blob + anchor (satu-satunya cara memicu
 * unduhan browser).
 */
export async function saveTextFile(
  text: string,
  filename: string,
  mimeType: string,
): Promise<SavedFile> {
  if (Platform.OS === "web") {
    return saveBlobFile(new Blob([text], { type: `${mimeType};charset=utf-8` }), filename, mimeType)
  }

  const file = new File(Paths.cache, filename)
  file.write(text)
  await shareContent({ fileUri: file.uri, mimeType, dialogTitle: filename })
  return { kind: "shared", filename }
}

/** Kutip satu sel CSV: pembatas selalu koma (RFC 4180), bukan titik-koma. */
function csvCell(value: string | number | boolean | null | undefined): string {
  if (value == null) return ""
  const text = String(value)
  // Angka diformat pemanggil (formatRupiah memakai titik ribuan) — tetap
  // dikutip agar Excel/LibreOffice tidak menebak ulang pemisah desimalnya.
  return `"${text.replace(/"/g, '""')}"`
}

/**
 * Susun CSV dari header + baris. Baris `\r\n` (RFC 4180) supaya Excel Windows
 * tidak menggabungkan semua sel ke satu baris.
 */
export function toCsv(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number | boolean | null | undefined>>,
): string {
  const lines = [headers.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))]
  return `${lines.join("\r\n")}\r\n`
}

/** Blob CSV siap simpan — BOM agar Excel membaca UTF-8 (rupiah, nama) dengan benar. */
export function csvBlob(csv: string): Blob {
  return new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" })
}
