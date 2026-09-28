/**
 * Kahade — "Langkah berikutnya" untuk area aksi kosong di detail order
 * (mega-batch FE-IMP-5, item 34).
 *
 * Ketika tidak ada aksi primer yang bisa diambil (menunggu pihak lain),
 * area aksi tidak boleh kosong: tampilkan panduan satu kalimat per
 * status × peran. Murni presentasi — tidak mengubah gerbang aksi apa pun.
 *
 * Copy formal "Anda" (konsisten dengan item 39).
 */

/** Petunjuk langkah berikutnya per status × peran; null = tidak ada. */
export function nextStepHintFor(
  status: string,
  role: "BUYER" | "SELLER" | undefined,
): string | null {
  switch (status) {
    case "WAITING_CONFIRMATION":
      return role === "BUYER"
        ? "Menunggu penjual mengonfirmasi pesanan. Setelah diterima, Anda dapat membayar ke escrow."
        : null // penjual punya tombol Terima/Tolak
    case "WAITING_PAYMENT":
    case "PENDING_PAYMENT":
      return role === "SELLER"
        ? "Menunggu pembeli membayar ke escrow. Anda akan diberi tahu saat dana masuk."
        : null // pembeli punya tombol Bayar
    case "PROCESSING":
      return role === "BUYER"
        ? "Pesanan sedang disiapkan penjual. Anda akan diberi tahu saat dikirim."
        : null // penjual punya tombol kirim
    case "IN_DELIVERY":
    case "SHIPPED":
    case "DELIVERED":
      return role === "SELLER"
        ? "Menunggu pembeli memeriksa barang dan mengonfirmasi penerimaan."
        : null // pembeli punya tombol konfirmasi
    case "DISPUTED":
      return "Sengketa sedang ditangani tim Kahade. Pantau perkembangannya di halaman sengketa."
    case "CANCELLED":
      return "Order ini dibatalkan. Dana escrow (bila sudah dibayar) dikembalikan ke pembeli."
    case "EXPIRED":
      return "Order ini kedaluwarsa sebelum dibayar. Buat transaksi baru bila masih dibutuhkan."
    case "REFUNDED":
      return "Dana sudah dikembalikan ke pembeli. Periksa mutasi dompet untuk detailnya."
    case "COMPLETED":
      return null // pembeli punya ajakan ulasan / retur
    default:
      return null
  }
}

/** Judul section panduan langkah berikutnya. */
export function nextStepTitle(): string {
  return "Langkah berikutnya"
}
