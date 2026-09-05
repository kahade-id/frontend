/** API hosts are deployment configuration, never page data. */
export type ApiEnv = "dev" | "staging" | "prod"
export const PRODUCTION_API_URL = "https://api.kahade.id"

export function resolveApiConfiguration(input: {
  env?: unknown
  extraEnv?: unknown
  url?: string
  platform: string
  development: boolean
}): { env: ApiEnv; baseUrl: string } {
  const selected = input.env ?? input.extraEnv ?? "prod"
  if (selected !== "dev" && selected !== "staging" && selected !== "prod") {
    throw new Error("EXPO_PUBLIC_API_ENV harus dev, staging, atau prod.")
  }
  const override = input.url?.trim()
  if (!override && selected !== "prod") {
    throw new Error(
      "Environment dev/staging memerlukan EXPO_PUBLIC_API_URL eksplisit; host tidak boleh ditebak.",
    )
  }
  const baseUrl = (override || PRODUCTION_API_URL).replace(/\/+$/, "")
  // A same-origin reverse proxy is supported on web. Never embed the sandbox's localhost.
  if (/^\/(?!\/)/.test(baseUrl) && input.platform === "web") return { env: selected, baseUrl }
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    throw new Error("EXPO_PUBLIC_API_URL tidak valid.")
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("URL API tidak boleh berisi kredensial, query, atau fragmen.")
  }
  if (
    url.protocol !== "https:" &&
    !(input.development && selected === "dev" && url.protocol === "http:")
  ) {
    throw new Error("API wajib memakai HTTPS, kecuali backend development yang dipilih eksplisit.")
  }
  if (
    input.platform === "web" &&
    /^(localhost|127\..*|\[::1\]|0\.0\.0\.0|10\.0\.2\.2)$/.test(url.hostname)
  ) {
    throw new Error(
      "Browser preview tidak dapat memakai localhost. Gunakan URL HTTPS atau reverse proxy same-origin.",
    )
  }
  if (/\/v1$/.test(url.pathname))
    throw new Error(
      "EXPO_PUBLIC_API_URL tidak boleh menyertakan /v1; endpoint sudah memiliki prefix tersebut.",
    )
  return { env: selected, baseUrl }
}
