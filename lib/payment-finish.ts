/**
 * Status layar redirect pembayaran HANYA berasal dari respons API.
 * Parameter redirect bukan bukti pembayaran, termasuk status gagal/pending.
 */
export type PaymentFinishStatus = "success" | "pending" | "failed" | "unknown"
export type PaymentVerifyTarget = { kind: "order" | "subscription"; id: string }
export type PaymentRedirectParams = Record<string, string | string[] | undefined>

function readIdentifier(params: PaymentRedirectParams, keys: readonly string[]): string | null {
  const values: string[] = []
  for (const key of keys) {
    const value = params[key]
    if (value === undefined) continue
    // Parameter ganda/alias yang bertentangan tidak boleh memilih pembayaran acak.
    if (Array.isArray(value) && value.length !== 1) return null
    const id = (Array.isArray(value) ? value[0] : value)?.trim()
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) return null
    values.push(id)
  }
  return values.length > 0 && values.every((id) => id === values[0]) ? values[0] : null
}

/** Identifier non-rahasia dari redirect; target ambigu/malformed = tidak dapat diverifikasi. */
export function resolveVerifyTarget(params: PaymentRedirectParams): PaymentVerifyTarget | null {
  const orderKeys = ["orderId", "order_id", "merchantOrderId", "merchantOrderNo"]
  const subscriptionKeys = ["subscriptionId", "subscription_id"]
  const hasOrder = orderKeys.some((key) => params[key] !== undefined)
  const hasSubscription = subscriptionKeys.some((key) => params[key] !== undefined)
  if (hasOrder === hasSubscription) return null
  const kind = hasOrder ? "order" : "subscription"
  const id = readIdentifier(params, hasOrder ? orderKeys : subscriptionKeys)
  return id ? { kind, id } : null
}

/** Fail-closed: hanya enum yang dikenal dari API kanonis boleh membuat klaim status. */
export function resolveStatus(kind: PaymentVerifyTarget["kind"], response: { status?: unknown }): PaymentFinishStatus {
  if (response.status === (kind === "order" ? "PAID" : "ACTIVE")) return "success"
  if (response.status === "PENDING") return "pending"
  if (response.status === "FAILED" || response.status === "EXPIRED" || response.status === "CANCELLED") return "failed"
  // REFUNDED bukan gagal bayar; arahkan ke Transaksi, jangan ajak membayar ulang.
  return "unknown"
}
