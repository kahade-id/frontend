/**
 * Kahade landing — <LandingNavbar>: navbar sticky untuk web.
 *
 * Hanya dipakai di landing (web saja). Saat halaman di-scroll, navbar
 * mendapat blur + border bawah; di posisi teratas ia transparan agar
 * menyatu dengan hero. Link anchor memakai scrollToSection (smooth scroll
 * yang menghormati prefers-reduced-motion).
 */
import { useEffect, useState } from "react"
import { Platform, Pressable, View, type ViewStyle } from "react-native"

import { cn } from "@/lib/cn"
import { useTheme } from "@/components/theme-provider"
import { modes } from "@/lib/tokens"
import { Text } from "@/components/ui/text"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/ui/logo"

import { scrollToSection } from "./scroll"

const LINKS = [
  { label: "Masalah", id: "masalah" },
  { label: "Cara Kerja", id: "cara-kerja" },
  { label: "Fitur", id: "fitur" },
  { label: "FAQ", id: "faq" },
] as const

export function LandingNavbar() {
  const { mode } = useTheme()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    // Listener scroll hanya untuk web; di native navbar ini tidak dirender.
    if (Platform.OS !== "web" || typeof window === "undefined") return
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // WEB-015: efek blur kaca saat scroll — inline web-only, bukan class
  // `backdrop-blur-md`. Class memang ter-compile di komponen web-only ini,
  // tetapi inline membuat efek eksplisit dan aman bila komponen kelak dipakai
  // ulang lintas platform (utilitas backdrop tidak ada di native).
  const blurStyle = {
    ...(scrolled
      ? {
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }
      : null),
  } as ViewStyle

  return (
    <View
      className={cn(
        // sticky/top-0/z-sticky: posisi sticky hanya bermakna di web.
        "sticky top-0 z-sticky w-full",
        scrolled && "border-b border-border",
      )}
      style={[
        scrolled
          ? {
              // Alpha ditempel pada token background (bukan hex literal)
              // supaya blur terlihat di atas konten yang di-scroll.
              backgroundColor: `${modes[mode].background}E6`,
            }
          : undefined,
        blurStyle,
      ]}
    >
      <View className="mx-auto w-full max-w-6xl flex-row items-center justify-between px-5 py-3 md:px-8">
        <Pressable
          onPress={() => scrollToSection("hero")}
          accessibilityRole="link"
          accessibilityLabel="Kahade — kembali ke atas"
          className="cursor-pointer"
        >
          {/* Logo asli Kahade (SVG vektor, ikut light/dark otomatis) */}
          <Logo variant="lockup" size="sm" />
        </Pressable>

        <View className="hidden flex-row items-center gap-7 md:flex">
          {LINKS.map((link) => (
            <Pressable
              key={link.id}
              onPress={() => scrollToSection(link.id)}
              accessibilityRole="link"
              className="cursor-pointer"
            >
              <Text variant="label" tone="secondary">
                {link.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Button
          variant="primary"
          size="sm"
          fullWidth={false}
          onPress={() => scrollToSection("download")}
        >
          Mulai Gratis
        </Button>
      </View>
    </View>
  )
}
