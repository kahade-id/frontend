/**
 * FD-07 (audit etalase 2026-10-10): snapshot rute aktif TANPA langganan per
 * komponen.
 *
 * Masalah: `useLoginNextPath` (dipakai setiap kartu feed lewat
 * `useShowcaseSocialActions`) memanggil `usePathname()` +
 * `useGlobalSearchParams()` — setiap kartu berlangganan state navigasi, jadi
 * navigasi apa pun (push/setParams) me-render ulang SEMUA kartu yang
 * ter-mount, menembus `memo(ShowcaseFeedItem)`.
 *
 * Solusi: SATU pelanggan (`<RouteSnapshotTracker/>` di root layout) menulis
 * snapshot ke modul ini; pembaca (tujuan kembali setelah login) membacanya
 * sinkron saat dibutuhkan — tidak ada yang berlangganan.
 */
export type RouteParams = Record<string, string | string[] | undefined>
export type RouteSnapshot = { pathname: string; params: RouteParams }

let snapshot: RouteSnapshot = { pathname: "", params: {} }

export function setRouteSnapshot(next: RouteSnapshot): void {
  snapshot = next
}

export function getRouteSnapshot(): RouteSnapshot {
  return snapshot
}

/**
 * C-03 (audit 2026-09-23): tujuan kembali setelah login = LAYAR SAAT INI
 * (dengan param-nya), bukan selalu halaman detail. Tamu yang menekan ♥ di
 * feed/profil setelah login harus mendarat lagi di posisi itu. Rute kosong /
 * root → `fallback`.
 */
export function buildReturnPath(fallback: string, route: RouteSnapshot = snapshot): string {
  const query = Object.entries(route.params)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&")
  const at = route.pathname && route.pathname !== "/" ? route.pathname : fallback
  return query ? `${at}?${query}` : at
}

/** Test-only. */
export function resetRouteSnapshotForTests(): void {
  snapshot = { pathname: "", params: {} }
}
