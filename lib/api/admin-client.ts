/**
 * Kahade — Admin HTTP client (§admin).
 *
 * Client terpisah dari client user (`lib/api/client.ts`) karena sesi admin
 * memakai token & lifecycle sendiri:
 * - access token disimpan di SecureStore key `kahade.admin.accessToken`
 * - refresh lewat `POST /v1/admin/auth/refresh` (cookie HttpOnly admin)
 * - 401 → coba refresh sekali, lalu ulangi request; gagal → lempar
 *   `AdminAuthError` agar layar login admin bisa menangkapnya.
 *
 * Kontrak yang dipakai modul `lib/api/admin/*`:
 *   import { adminHttp } from "@/lib/api/admin-client"
 *   const data = await adminHttp.get<AdminUserList>("/v1/admin/users", { query: { q } })
 */
import {
  deleteSecureItem,
  getSecureItem,
  SecureKeys,
  setSecureItem,
} from "@/lib/secure-storage"
import { API_BASE_URL } from "@/lib/api/config"
import { unwrapResponse } from "@/lib/api/response"

const ADMIN_TOKEN_KEY = SecureKeys.adminAccessToken

/** Dilempar saat sesi admin tidak valid / kedaluwarsa dan refresh gagal. */
export class AdminAuthError extends Error {
  constructor(message = "Sesi admin berakhir. Silakan login kembali.") {
    super(message)
    this.name = "AdminAuthError"
  }
}

export async function getAdminAccessToken(): Promise<string | null> {
  return getSecureItem(ADMIN_TOKEN_KEY)
}

export async function setAdminAccessToken(token: string): Promise<void> {
  await setSecureItem(ADMIN_TOKEN_KEY, token)
}

export async function clearAdminAccessToken(): Promise<void> {
  await deleteSecureItem(ADMIN_TOKEN_KEY)
}

type AdminHttpOptions = {
  query?: Record<string, string | number | boolean | undefined | null>
  body?: unknown
  signal?: AbortSignal
  /**
   * Header tambahan per-request. Dipakai endpoint idempoten admin
   * (approve/reject withdrawal, force-cancel/force-complete order) yang
   * mewajibkan `Idempotency-Key: <UUID v4>` — tanpa header ini backend
   * menolak dengan 400 IDEMPOTENCY_KEY_REQUIRED.
   */
  headers?: Record<string, string>
}

let refreshInFlight: Promise<string | null> | null = null

async function refreshAdminToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/v1/admin/auth/refresh`, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          credentials: "include",
        })
        if (!res.ok) return null
        const json = (await res.json().catch(() => null)) as {
          accessToken?: string
          data?: { accessToken?: string }
        } | null
        const token = json?.accessToken ?? json?.data?.accessToken ?? null
        if (token) await setAdminAccessToken(token)
        return token
      } catch {
        return null
      } finally {
        refreshInFlight = null
      }
    })()
  }
  return refreshInFlight
}

function buildUrl(path: string, query?: AdminHttpOptions["query"]): string {
  const url = new URL(`${API_BASE_URL}${path}`)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}

async function request<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  opts: AdminHttpOptions = {},
  retried = false,
): Promise<T> {
  const token = await getAdminAccessToken()
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers ?? {}),
  }
  const res = await fetch(buildUrl(path, opts.query), {
    method,
    headers,
    credentials: "include",
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  })

  if (res.status === 401 && !retried) {
    const fresh = await refreshAdminToken()
    if (fresh) return request<T>(method, path, opts, true)
    throw new AdminAuthError()
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      message?: string
      error?: string
    } | null
    const apiErr = new Error(err?.message ?? err?.error ?? `Admin API ${res.status}`) as Error & {
      status?: number
    }
    apiErr.status = res.status
    throw apiErr
  }

  if (res.status === 204) return undefined as T
  const json = await res.json().catch(() => null)
  return unwrapResponse(json) as T
}

async function adminGet<T>(path: string, opts: AdminHttpOptions = {}): Promise<T> {
  return request<T>("GET", path, opts)
}

async function adminPost<T>(
  path: string,
  body?: unknown,
  opts: AdminHttpOptions = {},
): Promise<T> {
  return request<T>("POST", path, { ...opts, body })
}

async function adminPut<T>(
  path: string,
  body?: unknown,
  opts: AdminHttpOptions = {},
): Promise<T> {
  return request<T>("PUT", path, { ...opts, body })
}

async function adminPatch<T>(
  path: string,
  body?: unknown,
  opts: AdminHttpOptions = {},
): Promise<T> {
  return request<T>("PATCH", path, { ...opts, body })
}

async function adminDelete<T>(path: string, opts: AdminHttpOptions = {}): Promise<T> {
  return request<T>("DELETE", path, opts)
}

export const adminHttp = {
  get: adminGet,
  post: adminPost,
  put: adminPut,
  patch: adminPatch,
  delete: adminDelete,
}
