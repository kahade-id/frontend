/**
 * Kahade landing — <Reveal>: fade/slide halus saat section masuk viewport.
 *
 * Web: IntersectionObserver (sekali, lalu unobserve). Native: langsung tampil
 * (landing hanya dipakai di web, tapi komponen tetap aman di native).
 * Menghormati prefers-reduced-motion / pengaturan OS: tanpa animasi.
 */
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Platform, View, type ViewStyle } from "react-native"

import { cn } from "@/lib/cn"
import { useReducedMotion } from "@/lib/use-reduced-motion"

type RevealProps = {
  children: ReactNode
  /** Jeda stagger antar kartu (ms). */
  delay?: number
  className?: string
}

export function Reveal({ children, delay = 0, className }: RevealProps) {
  const reducedMotion = useReducedMotion()
  const ref = useRef<View>(null)
  const [visible, setVisible] = useState(Platform.OS !== "web" || reducedMotion)

  useEffect(() => {
    if (Platform.OS !== "web" || reducedMotion) return
    const node = ref.current as unknown as Element | null
    if (!node || typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [reducedMotion])

  return (
    <View
      ref={ref}
      className={cn(
        "w-full",
        // Transisi via className agar jalan di web; di native tidak dipakai
        // (visible langsung true).
        "transition-all duration-700 ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        className,
      )}
      style={
        delay && visible
          ? ({ transitionDelay: `${delay}ms` } as unknown as ViewStyle)
          : undefined
      }
    >
      {children}
    </View>
  )
}
