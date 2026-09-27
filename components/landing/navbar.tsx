/**
 * Kahade landing — <LandingNavbar>: navbar sticky untuk web.
 *
 * Hanya dipakai di landing (web saja). Saat halaman di-scroll, navbar
 * mendapat blur + border bawah; di posisi teratas ia transparan agar
 * menyatu dengan hero. Link anchor memakai scrollToSection (smooth scroll
 * yang menghormati prefers-reduced-motion).
 */
import { useEffect, useState } from "react"
import { Platform, Pressable, View } from "react-native"
import { ShieldCheck } from "phosphor-react-native"

import { cn } from "@/lib/cn"
import { useTheme } from "@/components/theme-provider"
import { modes } from "@/lib/tokens"
import { Text } from "@/components/ui/text"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"

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

  return (
    <View
      className={cn(
        // sticky/top-0/z-50: posisi sticky hanya bermakna di web.
        "sticky top-0 z-50 w-full",
        scrolled && "border-b border-border backdrop-blur-md",
      )}
      style={
        scrolled
          ? {
              // Alpha ditempel pada token background (bukan hex literal)
              // supaya blur terlihat di atas konten yang di-scroll.
              backgroundColor: `${modes[mode].background}E6`,
            }
          : undefined
      }
    >
      <View className="mx-auto w-full max-w-6xl flex-row items-center justify-between px-5 py-3 md:px-8">
        <Pressable
          onPress={() => scrollToSection("hero")}
          accessibilityRole="link"
          accessibilityLabel="Kahade — kembali ke atas"
          className="cursor-pointer flex-row items-center gap-2"
        >
          <Icon icon={ShieldCheck} size="md" tone="active" weight="fill" />
          <Text variant="h3" weight={700}>
            Kahade
          </Text>
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
          Download App
        </Button>
      </View>
    </View>
  )
}
