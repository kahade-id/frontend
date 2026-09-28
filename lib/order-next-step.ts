/**
 * Kahade — "langkah berikutnya" untuk area aksi kosong di detail order
 * (item mega-batch 34).
 *
 * Bila tidak ada tombol aksi yang relevan untuk status × peran saat ini
 * (mis. penjual menunggu pembeli membayar), area aksi tidak boleh kosong
 * melompong — tampilkan satu baris info apa yang sedang terjadi / apa yang
 * ditunggu. Murni copy presentasi per status × peran; tidak mengubah gerbang
 * aksi apa pun.
 */
import { translate } from "@/lib/i18n/translate"

export type OrderActorRole = "BUYER" | "SELLER"

/**
 * Kembalikan petunjuk langkah berikutnya, atau `null` bila tidak ada yang
 * perlu dikomunikasikan (status terminal / peran tak dikenal).
 */
export function orderNextStepHint(
  status: string,
  role: OrderActorRole | undefined,
): string | null {
  switch (status) {
    case "WAITING_CONFIRMATION":
      return role === "SELLER"
        ? translate("Langkah berikutnya: konfirmasi pesanan ini agar pembeli dapat membayar ke escrow.")
        : role === "BUYER"
          ? translate("Langkah berikutnya: menunggu penjual mengonfirmasi pesanan Anda.")
          : null
    case "WAITING_PAYMENT":
    case "PENDING_PAYMENT":
      // Pembeli melihat tombol Bayar (bukan area kosong) — hint hanya untuk penjual.
      return role === "SELLER"
        ? translate("Langkah berikutnya: menunggu pembeli membayar ke escrow.")
        : null
    case "PROCESSING":
      // Penjual melihat tombol kirim — hint hanya untuk pembeli.
      return role === "BUYER"
        ? translate("Langkah berikutnya: penjual sedang menyiapkan dan mengirim pesanan Anda.")
        : null
    case "IN_DELIVERY":
    case "SHIPPED":
    case "DELIVERED":
      // Pembeli melihat tombol konfirmasi terima — hint hanya untuk penjual.
      return role === "SELLER"
        ? translate("Langkah berikutnya: menunggu pembeli mengonfirmasi penerimaan barang.")
        : null
    case "DISPUTED":
      return translate(
        "Langkah berikutnya: sengketa sedang ditangani tim Kahade. Pantau perkembangannya di halaman sengketa.",
      )
    default:
      // COMPLETED / CANCELLED / REFUNDED / EXPIRED / tak dikenal — tidak ada langkah berikut.
      return null
  }
}
