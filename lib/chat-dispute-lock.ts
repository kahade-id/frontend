/**
 * Kahade — kunci pesan selama sengketa (audit Pesan 2026-10-10, #9d).
 *
 * Kontrak backend (openapi PATCH/DELETE /v1/chat/rooms/{roomId}/messages/
 * {messageId}): edit & hapus-untuk-semua DITOLAK selama order ruang
 * berstatus DISPUTED (kode `CHAT_MESSAGE_LOCKED_DISPUTE`) — isi percakapan
 * adalah bukti bagi penyelesai sengketa.
 *
 * Dulu frontend tidak tahu aturan ini: aksi "Ubah"/"Hapus untuk semua orang"
 * tetap ditawarkan, pengguna mengetik ulang pesan, lalu dapat toast galat
 * generik. Aturannya dipusatkan di sini (murni) supaya bar seleksi, sheet
 * cakupan hapus, dan pemetaan galat sepakat.
 *
 * "Hapus untuk saya" (lokal) TIDAK terkunci — itu hanya menyembunyikan di
 * perangkat ini, server tidak terlibat.
 */
export function isChatMessageLockedByDispute(orderStatus: string | null | undefined): boolean {
  return orderStatus === "DISPUTED"
}
