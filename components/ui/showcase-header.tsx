/**
 * Kahade — <ShowcaseHeader> (bar atas tab Etalase; revisi 2026-09-23b).
 *
 * Layout (revisi 2026-09-27, redesign navigasi mobile):
 *
 *      [ ☰ menu ]  [ (logo) ]  [ 🔍 cari ]
 *      [ tab feed: Untuk Anda · Mengikuti · Terbaru · Populer ]
 *
 *   1. Baris atas TIGA elemen simetris: hamburger (BUKA DRAWER) di kiri,
 *      logo Kahade tepat di tengah, pencarian di kanan. Ikon memakai weight
 *      "regular" (BUKAN bold/fill) dan TANPA background.
 *      Glif: List (list/hamburger) dan MagnifyingGlass.
 *   2. Pensil "buat karya" PINDAH ke tombol (+) di bottom navbar (action
 *      sheet "Buat Karya" → /showcase/create) — satu pintu pembuatan untuk
 *      seluruh app.
 *   3. Lonceng notifikasi DIHAPUS dari header — Notifikasi kini tab sejati di
 *      bottom navbar dengan badge unread.
 *   4. Balance pill DIHAPUS dari header: saldo bukan konteks etalase; angka
 *      dompet tetap hidup di layar Dompet (menu drawer mode wallet).
 *   5. Strip tab feed tetap: satu-satunya kontrol memilih jenis feed.
 *
 * Semua hex literal tetap dilarang (`npm run check:tokens`);
 * `shadow-sm`/`rounded-xl` tetap tidak ada (lihat tailwind.config).
 */

import { View } from "react-native"
import { useRouter } from "expo-router"
import {
  ClockCounterClockwise,
  List,
  MagnifyingGlass,
  Sparkle,
  TrendUp,
  Users,
} from "phosphor-react-native"

import { ROUTES } from "@/lib/routes"
import { openDrawer } from "@/lib/drawer"
import { cn } from "@/lib/cn"
import { hitSlopToReach } from "@/lib/hit-slop"
import { focusRing } from "@/lib/focus-ring"
import { translate } from "@/lib/i18n"

import { Logo } from "@/components/ui/logo"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Tabs } from "@/components/ui/tabs"
import type { IconComponent } from "@/components/ui/icon"

export type ShowcaseFeedKind = "forYou" | "following" | "latest" | "popular"

export type ShowcaseHeaderProps = {
  kind: ShowcaseFeedKind
  onKindChange: (k: ShowcaseFeedKind) => void
  tabs: readonly { value: ShowcaseFeedKind; label: string }[]
}

const TAB_ICONS: Record<ShowcaseFeedKind, IconComponent> = {
  forYou: Sparkle,
  following: Users,
  latest: ClockCounterClockwise,
  popular: TrendUp,
}

/** Kotak aksi kiri/kanan 40px — pasangan simetris agar logo benar-benar tengah. */
const ACTION_BOX = 40
const ACTION_HIT_SLOP = hitSlopToReach(ACTION_BOX)

export function ShowcaseHeader({ kind, onKindChange, tabs }: ShowcaseHeaderProps) {
  const router = useRouter()

  return (
    <View className="bg-background">
      {/* ── Baris atas: menu (hamburger) · logo · cari ── */}
      <View className="w-full flex-row items-center justify-between px-5 pb-2.5 pt-3">
        {/*
          Hamburger = BUKA DRAWER/SIDEBAR (revisi 2026-09-27): menggantikan
          pensil "buat karya" yang pindah ke tombol (+) bottom navbar.
        */}
        <View className="flex-row items-center justify-start min-w-[84px]">
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={translate("Menu")}
            accessibilityHint={translate("Buka menu navigasi")}
            haptic
            hitSlop={ACTION_HIT_SLOP}
            onPress={openDrawer}
            containerClassName={cn("rounded-md", focusRing)}
            className="h-10 w-10 items-center justify-center"
          >
            <Icon icon={List} size="md" weight="regular" tone="active" />
          </PressableScale>
        </View>

        {/* Logo — pusat baris simetris. */}
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel="Kahade"
          className="flex-1 items-center"
        >
          <Logo variant="mark" size="md" />
        </View>

        {/* Cari di kanan (lonceng notifikasi pindah ke tab bottom navbar). */}
        <View className="flex-row items-center justify-end gap-1 min-w-[84px]">
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={translate("Cari")}
            accessibilityHint={translate("Buka pencarian")}
            haptic
            hitSlop={ACTION_HIT_SLOP}
            onPress={() => router.push(ROUTES.search)}
            containerClassName={cn("rounded-md", focusRing)}
            className="h-10 w-10 items-center justify-center"
          >
            <Icon icon={MagnifyingGlass} size="md" weight="regular" tone="active" />
          </PressableScale>
        </View>
      </View>

      {/* ── Strip tab feed ── */}
      <Tabs
        items={tabs.map((tab) => ({ ...tab, icon: TAB_ICONS[tab.value], label: translate(tab.label) }))}
        value={kind}
        onChange={onKindChange}
        scrollable
        activeIconOnly
        largeLabels
      />
    </View>
  )
}
