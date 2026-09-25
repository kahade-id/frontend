/**
 * orders-invoice.ts — invoice + struk cetak (R2 #97: pecahan facade orders.ts).
 *
 * Keputusan non-obvious dari header lama: `getReceiptHtml()` memakai
 * `responseType: "text"` — endpoint mengembalikan HTML siap cetak, bukan JSON.
 */
import { asRecord, invalidResponse } from "@/lib/api/response"
import { http, seg } from "@/lib/api/client"
import { normalizeOrder, toAmount, type Invoice, type Order } from "@/lib/api/orders-shared"


function firstString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}

/**
 * Normalisasi invoice yang toleran (spec tanpa schema response).
 *
 * Sebelumnya `getInvoice` me-cast body mentah ke `Invoice`: satu kunci
 * bersarang (`{ invoice: {...} }`), penamaan berbeda (`number`, `lines`,
 * `totalAmount`), atau angka berbentuk string membuat layar melempar di
 * tengah render ("Gagal memuat" tanpa bisa pulih). Sekarang:
 *   - terima `{...}` langsung, `{ invoice: {...} }`, atau `{ data: {...} }`
 *   - fallback nama kunci yang lazim + koersi angka aman
 *   - total jatuh ke jumlah item bila tidak dikirim
 *   - order hilang → placeholder minimal (id terisi) supaya struk tetap
 *     bisa tampil dengan pihak "—"
 * Body yang tidak menyerupai invoice sama sekali tetap melempar
 * `invalidResponse` (PARSE) — lebih jujur daripada struk kosong.
 */
export function normalizeInvoice(raw: unknown, orderId: string): Invoice {
  const top = asRecord(raw)
  const src = asRecord(top?.invoice) ?? asRecord(top?.data) ?? top
  if (!src) throw invalidResponse("invoice")
  const pick = (...keys: string[]): unknown => {
    for (const key of keys) {
      const value = src[key]
      if (value !== undefined && value !== null) return value
    }
    return undefined
  }

  const invoiceNumber = firstString(
    pick("invoiceNumber", "number", "no", "invoiceNo", "invoice_number"),
  )

  const rawItems = pick("items", "lines", "details", "breakdown")
  // I-12 (audit end-to-end): item dengan nominal ADA tapi tidak sah (desimal)
  // DIBUANG — dulu dijadikan `0` sehingga struk resmi menampilkan baris
  // "Rp0" yang tidak pernah ada. Item tanpa nominal sama sekali tetap masuk
  // dengan 0 (baris keterangan non-harga).
  const items = (Array.isArray(rawItems) ? rawItems : []).flatMap((entry, index) => {
    const item = asRecord(entry) ?? {}
    const amountRaw = item.amount ?? item.value ?? item.price ?? item.total ?? item.subtotal
    const amount = amountRaw == null ? 0 : toAmount(amountRaw)
    if (amount === undefined) return []
    return [
      {
        label:
          firstString(item.label ?? item.title ?? item.name ?? item.description) ??
          `Item ${index + 1}`,
        amount,
      },
    ]
  })

  const total =
    toAmount(pick("total", "totalAmount", "grandTotal", "grand_total", "amount")) ??
    items.reduce((sum, item) => sum + item.amount, 0)
  // B-08 (audit escrow 2026-09-24): total negatif = respons kacau (mis. refund
  // dikembalikan sebagai invoice) → TOLAK, jangan dirender sebagai struk sah.
  if (total < 0) throw invalidResponse("invoice.total")
  const issuedAt = firstString(pick("issuedAt", "issued_at", "createdAt", "created_at", "date")) ?? ""

  const rawOrder = pick("order", "orderDetail")
  const orderRecord = asRecord(rawOrder)
  const order: Order =
    orderRecord && (typeof orderRecord.id === "string" || typeof orderRecord.orderId === "string")
      ? normalizeOrder(orderRecord as Order & Record<string, unknown>)
      : {
          id: orderId,
          title: "",
          description: "",
          orderType: "OTHER",
          // B-14: placeholder TANPA status karangan ("UNKNOWN" di luar union) —
          // layar memperlakukannya sebagai "—".
          status: "",
          orderValue: total,
          feeResponsibility: "SPLIT",
          deliveryDeadlineDays: 0,
          createdAt: issuedAt,
        }

  // I-12: kepekaan "menyerupai invoice" ditambah jejak `order`/`issuedAt` —
  // dulu struk tanpa baris item & total 0 langsung PARSE meski datanya lengkap.
  if (!invoiceNumber && items.length === 0 && total === 0 && !orderRecord && !issuedAt)
    throw invalidResponse("invoice")

  return {
    // B-14 (audit escrow 2026-09-24): nomor invoice TIDAK PERNAH dikarang
    // (`INV-${orderId}` sempat bisa disalin pengguna sebagai dokumen sah).
    invoiceNumber,
    order,
    issuedAt,
    items,
    total,
  }
}

export function getInvoice(orderId: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/orders/${seg(orderId)}/invoice`, {
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) => normalizeInvoice(raw, orderId))
}

/**
 * HTML siap cetak — render di WebView atau kirim ke expo-print.
 *
 * D-14 (audit escrow 2026-09-24): isi DIVALIDASI sebagai dokumen HTML —
 * halaman error proxy/404 ber-HTML sempat tersimpan jadi "struk" dan dibagikan.
 *
 * L-02: konten DISANITASI (best-effort) sebelum disimpan/dibagikan —
 * `<script>`, `<iframe>`, dan handler `on*=` dibuang; tag skrip mati karena
 * berkas ini dibuka oleh program lain (share sheet/browser) yang tidak bisa
 * kita kendalikan. Untuk arsip yang sah, `getInvoicePdf` (O-04) lebih tepat.
 */
export function getReceiptHtml(orderId: string, signal?: AbortSignal) {
  return http
    .get<string>(`/v1/orders/${seg(orderId)}/receipt`, {
      auth: "required",
      responseType: "text",
      headers: { Accept: "text/html" },
      retry: 1,
      signal,
    })
    .then((html) => {
      if (typeof html !== "string" || !/<(?:!doctype|html|body|div|table)\b/i.test(html))
        throw invalidResponse("receipt")
      return sanitizeReceiptHtml(html)
    })
}

/** L-02: redaksi best-effort konten aktif dari struk HTML sebelum dibagikan. */
export function sanitizeReceiptHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
}

/**
 * O-04 (audit escrow 2026-09-24): `GET /v1/orders/{id}/invoice/pdf` — struk
 * PDF resmi untuk arsip finansial (spec punya endpoint-nya; klien lama hanya
 * memakai receipt HTML). `blob` dipakai karena isinya bukan JSON.
 */
export function getInvoicePdf(orderId: string, signal?: AbortSignal) {
  return http.get<Blob>(`/v1/orders/${seg(orderId)}/invoice/pdf`, {
    auth: "required",
    responseType: "blob",
    headers: { Accept: "application/pdf" },
    signal,
  })
}
