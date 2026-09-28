/**
 * Kahade landing — <LandingFooter>: footer sederhana.
 *
 * Logo + tagline, tiga kolom tautan (Produk, Legal, Bantuan), dan bar bawah
 * dengan hak cipta + nama PT. Tautan rute memakai <Link> expo-router;
 * tautan anchor dalam halaman memakai Pressable + scrollToSection.
 */
import { Pressable, View } from "react-native"
import { Link, type Href } from "expo-router"

import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { ROUTES } from "@/lib/routes"
import { Text } from "@/components/ui/text"
import { Logo } from "@/components/ui/logo"

import { scrollToSection } from "./scroll"

type FooterLink = { label: string; href?: Href; anchor?: string }

const COLUMNS: { heading: string; links: FooterLink[] }[] = [
  {
    heading: "Produk",
    links: [
      { label: "Etalase", href: ROUTES.showcase },
      { label: "Cara Kerja", anchor: "cara-kerja" },
      { label: "FAQ", anchor: "faq" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Syarat & Ketentuan", href: ROUTES.terms },
      { label: "Kebijakan Privasi", href: ROUTES.privacyPolicy },
    ],
  },
  {
    heading: "Bantuan",
    links: [{ label: "Hubungi Kami", href: ROUTES.contact }],
  },
]

function AnchorLink({ label, anchor }: { label: string; anchor: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => scrollToSection(anchor)}
      className={cn("self-start rounded-sm py-1", focusRing)}
    >
      <Text variant="body" tone="secondary">
        {label}
      </Text>
    </Pressable>
  )
}

export function LandingFooter() {
  return (
    <View className="w-full border-t border-border bg-surface">
      <View className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8">
        <View className="flex-col gap-10 md:flex-row md:justify-between">
          <View className="max-w-xs gap-3">
            {/* Logo asli Kahade */}
            <Logo variant="lockup" size="sm" />
            <Text variant="body" tone="secondary">
              Jual beli online tanpa was-was — dana aman di escrow.
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-8 md:gap-12">
            {COLUMNS.map((column) => (
              <View key={column.heading} className="min-w-[140px] gap-2">
                <Text variant="label" tone="secondary" className="mb-1">
                  {column.heading}
                </Text>
                {column.links.map((link) =>
                  link.anchor ? (
                    <AnchorLink key={link.label} label={link.label} anchor={link.anchor} />
                  ) : (
                    <Link
                      key={link.label}
                      href={link.href as Href}
                      accessibilityRole="link"
                      className={cn("self-start rounded-sm py-1", focusRing)}
                    >
                      <Text variant="body" tone="secondary">
                        {link.label}
                      </Text>
                    </Link>
                  ),
                )}
              </View>
            ))}
          </View>
        </View>

        <View className="mt-10 flex-row flex-wrap items-center justify-between gap-2 border-t border-border pt-6">
          <Text variant="caption" tone="secondary">
            © 2026 Kahade
          </Text>
          <Text variant="caption" tone="secondary">
            PT Kawal Hak Dengan Aman
          </Text>
        </View>
      </View>
    </View>
  )
}
