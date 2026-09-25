/**
 * Kahade — domain `orders` (31 endpoint, tag "orders" di kahade-api-mobile.json).
 *
 * Semua endpoint ini `security: access-token` → `auth: "required"`.
 *
 * Tipe REQUEST (body + query + path) persis dari spec:
 *   - Body: lib/api/types.ts (generated).
 *   - Query `GET /v1/orders`: page?, limit?, status?, role?[BUYER|SELLER|ALL], search?
 *   - Query paginasi WAJIB (`page!`, `limit!`) di: /extensions, /history, /links/my.
 *
 * Tipe RESPONSE: tidak ada di spec — ditulis minimal dan ditandai UNVERIFIED.
 *
 * R2 (audit ronde-2, butir #97): facade ini dulu 1.633 baris — setiap
 * perubahan kecil menyentuh file kritis. Kini HANYA re-export dari sub-domain
 * (impor lama `@/lib/api/orders` tidak berubah):
 *   - orders-shared.ts    : tipe respons + normalizer + helper status
 *   - orders-endpoints.ts : CRUD + pembayaran + pengiriman + riwayat
 *   - orders-delivery.ts  : perpanjangan tenggat + bukti pengiriman
 *   - orders-links.ts     : order link
 *   - orders-invoice.ts   : invoice + struk
 */
export * from "@/lib/api/orders-shared"
export * from "@/lib/api/orders-endpoints"
export * from "@/lib/api/orders-delivery"
export * from "@/lib/api/orders-links"
export * from "@/lib/api/orders-invoice"
