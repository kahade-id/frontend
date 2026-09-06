/**
 * Kahade — <PortalProvider> / <PortalHost> / <Portal> (§6.2 layering).
 *
 * Merender anak di LUAR posisi tree-nya (di lokasi <PortalHost>) tanpa
 * mengubah context React. Dasar untuk Modal, BottomSheet, Toast, Tooltip
 * (kelompok Overlay) — overlay harus keluar dari ScrollView/`overflow-hidden`
 * parent agar bisa menutupi seluruh layar.
 *
 * Kenapa buatan sendiri, bukan `@gorhom/portal` atau `react-native-paper`
 * (non-obvious): kebutuhan kita hanya "pindahkan node ke root", ~60 baris,
 * dan yang paling penting HOST-nya harus berada DI DALAM <ThemeProvider>
 * (lihat catatan Portal di theme-provider.tsx) supaya `vars()` CSS variable
 * ikut terbawa. Library portal umumnya mendorong host di root paling atas —
 * di atas ThemeProvider — dan warna mode-aware di overlay akan hilang.
 *
 * Kenapa `useId()` sebagai key: stabil antar re-render, unik antar instance,
 * tanpa counter global yang rusak saat Fast Refresh.
 *
 * Urutan render = urutan mount. Z-order antar overlay diatur konten masing-
 * masing lewat class `z-backdrop`, `z-bottomSheet`, `z-modal`, `z-banner`
 * (tokens.zIndex) — bukan oleh Portal.
 *
 * Modalitas screen reader (audit #3, WCAG 2.4.3):
 *   `accessibilityViewIsModal` di iOS HANYA menyembunyikan SIBLING dari view
 *   penerimanya. Overlay kita dirender di dalam <PortalHost> (beberapa level
 *   di bawah), jadi <Stack> app BUKAN sibling-nya dan atribut itu sendiri
 *   tidak menyembunyikan apa pun. Solusi: overlay pemblokir mendaftar lewat
 *   `useBlockingOverlay(visible)`, dan <PortalScene> (pembungkus konten app)
 *   membaca jumlahnya lalu memasang `accessibilityElementsHidden` (iOS) +
 *   `importantForAccessibility="no-hide-descendants"` (Android; RN-Web
 *   memetakan keduanya ke `aria-hidden`). Toast TIDAK boleh ikut tersembunyi
 *   (alert live region) — karena itu <PortalScene> hanya membungkus <Stack>,
 *   bukan seluruh ToastProvider.
 *
 * Pemasangan (sekali, di _layout.tsx):
 *   <ThemeProvider>
 *     <PortalProvider>
 *       <PortalScene><Stack /></PortalScene>   // app; disembunyikan dari SR saat overlay pemblokir buka
 *       <PortalHost />                         // overlay dirender di sini, masih di dalam vars()
 *     </PortalProvider>
 *   </ThemeProvider>
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { View, type ViewProps } from "react-native"

import { cn } from "@/lib/cn"

type PortalNodes = Record<string, ReactNode>

/**
 * Context SENGAJA dipecah dua (audit performa — jangan digabung lagi).
 *
 * Sebelumnya `nodes`, `blockingCount`, dan fungsi mount/unmount berada dalam
 * SATU context value. Akibatnya setiap overlay yang memakai `useBlockingOverlay`
 * ikut berlangganan `nodes` — dan itu menutup sebuah siklus:
 *
 *   overlay render → <Portal> menerima elemen `children` BARU (identitas beda
 *   tiap render) → effect Portal jalan → mount() → setNodes → context value
 *   berubah → overlay (konsumen context) render lagi → elemen baru lagi → …
 *
 * Yang terukur: satu <Modal>/<BottomSheet> terbuka = 500+ render dalam 50 ms
 * dan React melempar "Maximum update depth exceeded". Reproduksi ada di
 * tests/portal.test.tsx ("overlay TERBUKA").
 *
 * Pemisahannya:
 * - PortalApiContext   → mount/unmount/registerBlocking. Semua `useCallback`
 *   dengan deps kosong, jadi value-nya STABIL SELAMANYA. Ini yang dipakai
 *   <Portal> dan `useBlockingOverlay`, sehingga overlay tidak pernah render
 *   ulang karena isi portal berubah. Siklus di atas putus di sini.
 * - PortalStateContext → nodes + blockingCount. Hanya <PortalHost> (yang
 *   memang harus menggambar ulang) dan <PortalScene> (yang butuh tahu ada
 *   overlay pemblokir) yang berlangganan.
 */
type PortalApi = {
  mount: (key: string, node: ReactNode) => void
  unmount: (key: string) => void
  /** Daftarkan satu overlay pemblokir; kembalikan fungsi untuk mencabut. */
  registerBlocking: () => () => void
}

type PortalState = {
  nodes: PortalNodes
  /** Jumlah overlay pemblokir yang sedang terbuka (audit #3) */
  blockingCount: number
}

const PortalApiContext = createContext<PortalApi | null>(null)
const PortalStateContext = createContext<PortalState | null>(null)

export function PortalProvider({ children }: { children: ReactNode }) {
  const [nodes, setNodes] = useState<PortalNodes>({})
  const [blockingCount, setBlockingCount] = useState(0)

  const mount = useCallback((key: string, node: ReactNode) => {
    setNodes((prev) => (prev[key] === node ? prev : { ...prev, [key]: node }))
  }, [])

  const unmount = useCallback((key: string) => {
    setNodes((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const registerBlocking = useCallback(() => {
    setBlockingCount((n) => n + 1)
    return () => setBlockingCount((n) => Math.max(0, n - 1))
  }, [])

  // Identitas stabil seumur provider: mount/unmount/registerBlocking semuanya
  // useCallback([]) sehingga konsumen API tidak pernah render ulang.
  const api = useMemo<PortalApi>(
    () => ({ mount, unmount, registerBlocking }),
    [mount, unmount, registerBlocking],
  )

  const state = useMemo<PortalState>(() => ({ nodes, blockingCount }), [nodes, blockingCount])

  return (
    <PortalApiContext.Provider value={api}>
      <PortalStateContext.Provider value={state}>{children}</PortalStateContext.Provider>
    </PortalApiContext.Provider>
  )
}

function usePortalApi(): PortalApi {
  const ctx = useContext(PortalApiContext)
  if (!ctx) throw new Error("Portal harus dipakai di dalam <PortalProvider>")
  return ctx
}

function usePortalState(): PortalState {
  const ctx = useContext(PortalStateContext)
  if (!ctx) throw new Error("Portal harus dipakai di dalam <PortalProvider>")
  return ctx
}

/**
 * Daftarkan overlay sebagai PEMBLOKIR selama `active` (Modal, BottomSheet,
 * SearchOverlay, LoadingOverlay). Popover/tooltip/banner/toast non-blocking
 * TIDAK memanggil ini — konten latar tetap bisa dijangkau.
 *
 * Dipanggil dengan `visible` (bukan `mounted`) supaya latar kembali terbaca
 * begitu overlay diminta tutup, tidak menunggu animasi keluar selesai.
 */
export function useBlockingOverlay(active: boolean): void {
  // API context (stabil), BUKAN state context: overlay tidak boleh ikut
  // render ulang saat isi portal berubah — itu yang dulu memicu render loop.
  const { registerBlocking } = usePortalApi()
  useEffect(() => {
    if (!active) return
    return registerBlocking()
  }, [active, registerBlocking])
}

/** true bila ada overlay pemblokir yang terbuka. */
export function useHasBlockingOverlay(): boolean {
  return usePortalState().blockingCount > 0
}

export type PortalSceneProps = ViewProps & { className?: string }

/**
 * Pembungkus konten app (di luar overlay). Saat ada overlay pemblokir,
 * seluruh subtree disembunyikan dari screen reader — padanan lintas platform
 * untuk `aria-modal`. Tidak mengubah layout/pointer: sentuhan ke latar sudah
 * ditangkap Backdrop.
 */
export function PortalScene({ className, children, ...rest }: PortalSceneProps) {
  const blocked = useHasBlockingOverlay()
  return (
    <View accessible={false}
      accessibilityElementsHidden={blocked}
      importantForAccessibility={blocked ? "no-hide-descendants" : "auto"}
      className={cn("flex-1", className)}
      {...rest}
    >
      {children}
    </View>
  )
}

export type PortalHostProps = Omit<ViewProps, "children"> & { className?: string }

/**
 * Tempat node Portal dirender. `absolute inset-0` + `pointerEvents="box-none"`
 * agar host sendiri tidak memblokir sentuhan ke app di bawahnya; hanya anak
 * yang punya area sentuh (backdrop, sheet) yang menangkap event.
 */
export function PortalHost({ className, ...rest }: PortalHostProps) {
  const { nodes } = usePortalState()
  const keys = Object.keys(nodes)
  if (keys.length === 0) return null

  return (
    <View
      pointerEvents="box-none"
      className={cn("absolute inset-0 z-backdrop", className)}
      {...rest}
    >
      {keys.map((k) => (
        <View key={k} pointerEvents="box-none" className="absolute inset-0">
          {nodes[k]}
        </View>
      ))}
    </View>
  )
}

export type PortalProps = {
  children: ReactNode
  /** false = render inline (tanpa teleport), untuk testing/story */
  enabled?: boolean
}

export function Portal({ children, enabled = true }: PortalProps) {
  const key = useId()
  const { mount, unmount } = usePortalApi()

  // Dua effect terpisah, bukan satu dengan cleanup: kalau pembersihan ikut
  // menempel pada perubahan `children`, setiap update konten jadi dua kali
  // setNodes (hapus lalu pasang) dan <PortalHost> sempat melihat state tanpa
  // node itu. Pelepasan cukup terjadi saat Portal benar-benar unmount.
  useEffect(() => {
    if (!enabled) {
      unmount(key)
      return
    }
    mount(key, children)
  }, [children, enabled, key, mount, unmount])

  useEffect(() => () => unmount(key), [key, unmount])

  if (!enabled) return <>{children}</>
  return null
}
