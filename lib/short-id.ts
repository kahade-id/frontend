/**
 * R2 (audit escrow ronde-2, butir #38/#45): label manusia untuk ID UUID.
 *
 * UUID mentah (36 char) sebagai judul kartu/header tidak bisa dikenali.
 * Label "Order a1b2c3d4" mempertahankan keunikan yang dapat diverifikasi
 * (8 hex pertama ≈ cukup untuk membedakan order milik satu pengguna) tanpa
 * mengklaim judul order yang belum termuat.
 */
export function shortId(id: string | null | undefined): string {
  if (typeof id !== "string" || id.length === 0) return "—"
  return id.length <= 8 ? id : id.slice(0, 8)
}

/** Label fallback "Order #xxxxxxxx" — hanya dipakai saat judul belum ada. */
export function orderFallbackLabel(orderId: string | null | undefined): string {
  return `Order #${shortId(orderId)}`
}
