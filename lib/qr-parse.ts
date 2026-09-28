/**
 * Kahade — parser hasil pindaian QR (FE-IMP-4 item 18/23/27).
 *
 * Murni (tanpa React): mengubah string mentah hasil pindaian menjadi target
 * terstruktur. Prinsip anti-phishing:
 *
 * - Hanya URL `https://kahade.id` (atau `www.kahade.id`) dan skema
 *   `kahade://` yang dipetakan ke aksi dalam aplikasi.
 * - URL asing (host lain) TIDAK pernah dibuka otomatis — dikembalikan sebagai
 *   `external-url` dengan `risky: true`; layar wajib menampilkan peringatan
 *   dan meminta konfirmasi eksplisit sebelum membuka/menyalin.
 * - Skema non-http asing (tel:, sms:, dsb.) diperlakukan sebagai teks biasa.
 * - Path kahade.id yang tidak dikenal → teks (jangan menebak aksi).
 *
 * Navigasi/aksi tetap di layar (butuh router/clipboard); modul ini hanya
 * memutuskan "ini apa" dan "seberapa berbahaya".
 */

export type QrTargetType =
  | "profile"
  | "order"
  | "order-link"
  | "showcase"
  | "transfer"
  | "external-url"
  | "text"

export type QrTarget = {
  type: QrTargetType
  /** Label untuk sheet konfirmasi. */
  label: string
  /** Detail untuk sheet konfirmasi. */
  detail: string
  /**
   * `true` = butuh peringatan eksplisit sebelum aksi (saat ini hanya
   * `external-url`). Kode asing tidak pernah auto-open.
   */
  risky: boolean
  username?: string
  orderId?: string
  linkToken?: string
  showcaseId?: string
  /** Nominal transfer (Rp) dari QR `transfer?to=&amount=` — opsional. */
  amount?: number
  /** URL asing mentah (hanya untuk type `external-url`). */
  url?: string
  /** Teks mentah (untuk type `text`). */
  text?: string
}

const KAHADE_HOSTS: ReadonlySet<string> = new Set(["kahade.id", "www.kahade.id"])

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,30}$/
const ORDER_CODE_RE = /^KHD-[a-zA-Z0-9]{3,24}$/i
/** Id order bentuk UUID/cuid pendek — longgar, server yang memvalidasi. */
const ORDER_ID_RE = /^[a-f0-9-]{8,36}$/i
const TOKEN_RE = /^[a-zA-Z0-9_-]{4,128}$/

function validAmount(raw: string | null): number | undefined {
  if (!raw) return undefined
  const n = Number(raw)
  if (!Number.isSafeInteger(n) || n <= 0) return undefined
  return n
}

function parseKahadeUrl(url: URL): QrTarget | null {
  // Untuk skema `kahade://transfer?...`, "transfer" adalah hostname (URL
  // non-special tidak punya leading slash) — perlakukan sebagai segmen path.
  const hostAsSegment =
    url.protocol.toLowerCase() === "kahade:" && url.hostname ? [url.hostname] : []
  const segments = [...hostAsSegment, ...url.pathname.split("/").filter(Boolean)]

  // /user/<username> atau /u/<username>
  if (
    (segments[0] === "user" || segments[0] === "u") &&
    segments[1] &&
    USERNAME_RE.test(segments[1])
  ) {
    const username = segments[1]
    return {
      type: "profile",
      label: "Profil Pengguna",
      detail: `@${username}`,
      risky: false,
      username,
    }
  }

  // /order/<id> — kode KHD-xxx atau id internal.
  if (segments[0] === "order" && segments[1]) {
    const orderId = segments[1]
    if (ORDER_CODE_RE.test(orderId) || ORDER_ID_RE.test(orderId)) {
      return {
        type: "order",
        label: "Pesanan Escrow",
        detail: `ID: ${orderId}`,
        risky: false,
        orderId,
      }
    }
    return null
  }

  // /order-link/<token> atau /link/<token>
  if ((segments[0] === "order-link" || segments[0] === "link") && segments[1]) {
    const linkToken = segments[1]
    if (TOKEN_RE.test(linkToken)) {
      return {
        type: "order-link",
        label: "Tautan Transaksi",
        detail: `Token: ${linkToken}`,
        risky: false,
        linkToken,
      }
    }
    return null
  }

  // /showcase/<id>
  if (segments[0] === "showcase" && segments[1]) {
    const showcaseId = segments[1]
    if (TOKEN_RE.test(showcaseId)) {
      return {
        type: "showcase",
        label: "Karya Etalase",
        detail: `ID: ${showcaseId}`,
        risky: false,
        showcaseId,
      }
    }
    return null
  }

  // /transfer?to=<username>&amount=<n> — FE-IMP-4 item 27.
  if (segments[0] === "transfer") {
    const to = url.searchParams.get("to")
    if (to && USERNAME_RE.test(to)) {
      const amount = validAmount(url.searchParams.get("amount"))
      return {
        type: "transfer",
        label: "Minta Transfer",
        detail:
          amount != null ? `@${to} · Rp${amount.toLocaleString("id-ID")}` : `@${to}`,
        risky: false,
        username: to,
        amount,
      }
    }
    return null
  }

  return null
}

/**
 * Parse string mentah hasil pindaian. Tidak pernah melempar — input aneh
 * selalu menjadi `text`.
 */
export function parseQrCode(raw: string): QrTarget {
  const text = raw.trim()
  if (!text) {
    return { type: "text", label: "Kode / Tautan", detail: "", risky: false, text: "" }
  }

  // 1. Coba sebagai URL (https/http atau skema kahade://).
  let url: URL | null = null
  try {
    if (/^https?:\/\//i.test(text) || /^kahade:\/\//i.test(text)) {
      url = new URL(text)
    }
  } catch {
    url = null
  }

  if (url) {
    const host = url.hostname.toLowerCase()
    const isKahade =
      KAHADE_HOSTS.has(host) || url.protocol.toLowerCase() === "kahade:"
    if (isKahade) {
      const target = parseKahadeUrl(url)
      if (target) return target
      // Path kahade.id tak dikenal → teks, jangan menebak aksi.
    } else if (url.protocol === "http:" || url.protocol === "https:") {
      // 2. URL asing — anti-phishing: tidak auto-open, wajib konfirmasi.
      return {
        type: "external-url",
        label: "Tautan Luar",
        detail: text.length > 80 ? `${text.slice(0, 80)}…` : text,
        risky: true,
        url: text,
      }
    }
    // Skema asing lain (tel:, mailto:, dsb.) → jatuh ke teks.
  }

  // 3. Pola telanjang: kode order KHD-xxx atau id order bentuk UUID — dicek
  // SEBELUM username karena charset username juga mencakup karakter `-`.
  // Id internal tanpa prefix hanya dipetakan bila mengandung `-` (bentuk
  // UUID), agar username heks seperti "cafe1234" tidak salah jadi order.
  const isOrderCode = ORDER_CODE_RE.test(text) || (ORDER_ID_RE.test(text) && text.includes("-"))
  if (isOrderCode && !text.includes(" ") && !text.includes("/")) {
    return {
      type: "order",
      label: "Pesanan Escrow",
      detail: `ID: ${text}`,
      risky: false,
      orderId: text,
    }
  }

  // 4. Pola telanjang: @username / username
  const bareUser = text.startsWith("@") ? text.slice(1) : text
  if (USERNAME_RE.test(bareUser) && !text.includes(" ") && !text.includes("/")) {
    return {
      type: "profile",
      label: "Profil Pengguna",
      detail: `@${bareUser}`,
      risky: false,
      username: bareUser,
    }
  }

  // 5. Teks umum — hanya salin, tidak ada aksi navigasi.
  return {
    type: "text",
    label: "Kode / Tautan",
    detail: text.length > 120 ? `${text.slice(0, 120)}…` : text,
    risky: false,
    text,
  }
}
