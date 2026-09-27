/**
 * Kahade — unduh lampiran tiket dukungan (item mega-batch 128).
 *
 * Lampiran tiket disimpan sebagai fileKey privat. Satu-satunya jalur unduh
 * yang aman untuk user adalah `GET /v1/upload/my-file?key=…` (kepemilikan
 * dicek server: segmen userId pada key harus milik peminta).
 *
 * Batasan jujur: file milik STAFF (balasan CS) tidak lolos cek kepemilikan
 * itu — unduhan gagal dengan error eksplisit "tidak dapat dibuka", BUKAN
 * dengan menebak-nebak URL publik. Tidak ada endpoint signed-URL khusus
 * support, dan kami tidak mengarangnya.
 */
import { http } from "@/lib/api/client"

/**
 * Nama berkas untuk unduhan — segmen terakhir fileKey yang disanitasi.
 * Bukan nama asli (tidak disimpan backend), tapi cukup deskriptif.
 */
export function supportAttachmentFilename(fileKey: string, index: number): string {
  const last = String(fileKey ?? "").split("/").filter(Boolean).pop() ?? ""
  const safe = last.replace(/[^a-zA-Z0-9._-]/g, "").slice(-64)
  return safe || `lampiran-${index + 1}`
}

/**
 * Unduh blob lampiran lewat endpoint pemilik-terotentikasi. Melempar
 * ApiError bila gagal (mis. file staff → 400 FILE_ACCESS_DENIED) — pemanggil
 * menampilkannya sebagai pesan eksplisit.
 */
export function downloadSupportAttachment(fileKey: string): Promise<Blob> {
  return http.get<Blob>("/v1/upload/my-file", {
    query: { key: fileKey },
    auth: "required",
    responseType: "blob",
  })
}
