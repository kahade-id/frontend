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
 * Pemasangan (sekali, di _layout.tsx):
 *   <ThemeProvider>
 *     <PortalProvider>
 *       <Stack />          // app
 *       <PortalHost />     // overlay dirender di sini, masih di dalam vars()
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

type PortalContextValue = {
  mount: (key: string, node: ReactNode) => void
  unmount: (key: string) => void
  nodes: PortalNodes
}

const PortalContext = createContext<PortalContextValue | null>(null)

export function PortalProvider({ children }: { children: ReactNode }) {
  const [nodes, setNodes] = useState<PortalNodes>({})

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

  const value = useMemo<PortalContextValue>(
    () => ({ mount, unmount, nodes }),
    [mount, unmount, nodes],
  )

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>
}

function usePortalContext(): PortalContextValue {
  const ctx = useContext(PortalContext)
  if (!ctx) throw new Error("Portal harus dipakai di dalam <PortalProvider>")
  return ctx
}

export type PortalHostProps = Omit<ViewProps, "children"> & { className?: string }

/**
 * Tempat node Portal dirender. `absolute inset-0` + `pointerEvents="box-none"`
 * agar host sendiri tidak memblokir sentuhan ke app di bawahnya; hanya anak
 * yang punya area sentuh (backdrop, sheet) yang menangkap event.
 */
export function PortalHost({ className, ...rest }: PortalHostProps) {
  const { nodes } = usePortalContext()
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
  const { mount, unmount } = usePortalContext()

  useEffect(() => {
    if (!enabled) return
    mount(key, children)
    return () => unmount(key)
  }, [children, enabled, key, mount, unmount])

  if (!enabled) return <>{children}</>
  return null
}
