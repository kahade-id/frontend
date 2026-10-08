import { useCallback, useEffect, useRef, useState } from "react"
import { useIsFocused } from "expo-router"
import { api, userMessage } from "@/lib/api"
import type { ShowcaseItem } from "@/lib/api/users"
import { fetchViaQueryCache, writeQueryCache } from "@/lib/query-cache"
import { queryKeys } from "@/lib/query-keys"
import { useSessionRevision } from "@/lib/guest-gate"
import { useShowcaseDirtyVersion } from "@/lib/showcase-social-prefs"

/**
 * Profile tab owns its request lifecycle independently from the other profile tabs.
 *
 * Revisi audit Etalase 2026-09-23:
 *  - H-01: refresh diam (dirty/fokus) TIDAK menyalakan `loading` — list tidak
 *    berubah jadi skeleton hanya karena satu mutasi.
 *  - H-02: kegagalan refresh diam TIDAK mengosongkan `items` — data terakhir
 *    yang masih sah tetap tampil, error dipisahkan.
 *  - H-03: `loading` mulai `true` — sebelum fetch pertama dipicu profil, tab
 *    tidak menampilkan kilatan "Belum ada konten".
 */
export function useProfileShowcase() {
  const [items, setItems] = useState<ShowcaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  const target = useRef<string | null>(null)
  const revision = useSessionRevision()
  const version = useShowcaseDirtyVersion()
  const seen = useRef(version)
  const focused = useIsFocused()
  const fetch = useCallback((username: string, opts: { silent?: boolean; fresh?: boolean } = {}) => {
    const silent = opts.silent === true
    // Refresh dirty: ada mutasi etalase (hapus/ubah/tambah) — cache TTL 5 dtk
    // harus dilewati, kalau tidak tab profil masih menampilkan daftar lama.
    // Hasil segar tetap ditulis ke kunci yang sama untuk pembaca berikutnya.
    const fresh = opts.fresh === true
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    target.current = username
    // H-01: refresh diam tidak menyentuh `loading` (tanpa skeleton).
    if (!silent) setLoading(true)
    // PERF-FIX (network P0): katalog publik di-cache di kunci kanonis
    // `public-showcase:{username}` — kunjungan ulang / buka-tutup tab dalam
    // jendela TTL tidak mengunduh ulang seluruh katalog seller. Cache hanya
    // ditulis saat sukses, jadi retry setelah gagal tetap menembak jaringan.
    const key = queryKeys.publicShowcase(username)
    const load = fresh
      ? api.users.getPublicShowcase(username, controller.signal).then((result) => {
          writeQueryCache(key, result)
          return result
        })
      : fetchViaQueryCache(key, (signal) => api.users.getPublicShowcase(username, signal), controller.signal)
    void load.then((result) => {
      if (controller.signal.aborted) return
      setItems(result)
      setError(null)
    }).catch((err) => {
      if (controller.signal.aborted) return
      // H-02: jangan buang data yang masih sah hanya karena refresh gagal.
      setError(userMessage(err))
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
  }, [])
  useEffect(() => {
    request.current?.abort()
    setItems([])
    setLoading(true)
    setError(null)
    if (target.current) fetch(target.current)
    return () => request.current?.abort()
  }, [revision, fetch])
  useEffect(() => {
    if (focused && version !== seen.current && target.current) {
      seen.current = version
      fetch(target.current, { silent: true, fresh: true })
    }
  }, [focused, version, fetch])
  return { items, loading, error, fetch }
}
