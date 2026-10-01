/**
 * Kahade — <ShowcaseHeader> (bar atas tab Etalase; revisi 2026-09-23b).
 *
 * Layout (revisi 2026-09-28, permintaan produk):
 *
 *      [ = menu ]  [ zigzag Kahade ]  [ + buat ]
 *      [ tab feed: Untuk Anda · Mengikuti · Terbaru · Populer · filter ]
 *
 *   1. Baris atas: equal (BUKA DRAWER) di kiri, logo Kahade tepat di tengah,
 *      dan (+) "Buat baru" di kanan. (+) membuka sheet global "Buat baru"
 *      (Buat Karya → /showcase/create, Buat transaksi, Isi saldo dompet).
 *      Ikon memakai weight "regular" (BUKAN bold/fill) dan TANPA background.
 *      Filter Etalase berada di samping tab "Populer".
 *   2. Sheet "Buat baru" adalah komponen global reusable (<CreateSheet>,
 *      dibuka via `openCreateSheet()` dari `lib/create-sheet`) — satu pintu
 *      pembuatan untuk seluruh app, diakses dari (+) header Etalase dan
 *      pensil di utility bar drawer.
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
import {
  ClockCounterClockwise,
  Equals,
  Funnel,
  Plus,
  Sparkle,
  TrendUp,
  Users,
} from "phosphor-react-native"
import { useRef } from "react"
import type { View as RNView } from "react-native"

import { openCreateSheet } from "@/lib/create-sheet"
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
  /**
   * Bila diisi, tombol funnel tampil sebagai aksi terpisah di tab Populer.
   * Opsional — pemakai lama tanpa filter tidak terpengaruh.
   */
  onFilterPress?: () => void
  /** Jumlah filter aktif — badge di tombol funnel (0/sembunyi = tidak ada). */
  filterBadgeCount?: number
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

export function ShowcaseHeader({ kind, onKindChange, tabs, onFilterPress, filterBadgeCount = 0 }: ShowcaseHeaderProps) {
  // Ref tombol (+) buat karya — View pembungkus (bukan PressableScale)
  // supaya ref selalu ke host View yang terukur.
  const createRef = useRef<RNView>(null)
  return (
    <View className="bg-background">
      {/* ── Baris atas: menu (hamburger) · logo · buat baru ── */}
      <View className="w-full flex-row items-center justify-between px-5 pb-2.5 pt-3">
        {/*
          Tombol menu = BUKA DRAWER/SIDEBAR (revisi 2026-09-27): ikon Equal
          menggantikan hamburger List atas permintaan produk.
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
            <Icon icon={Equals} size="md" weight="regular" tone="active" />
          </PressableScale>
        </View>

        {/* Logo — pusat baris simetris. */}
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel="Kahade"
          className="flex-1 items-center"
        >
          <Logo variant="mark" size="md" tone="brand" />
        </View>

        {/* Kanan: tombol buat baru; bidang search tersedia di sidebar. */}
        <View className="flex-row items-center justify-end min-w-[84px]">
          <View ref={createRef} collapsable={false}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={translate("Buat baru")}
              accessibilityHint={translate("Membuka pilihan: buat etalase, buat transaksi, atau isi saldo")}
              haptic
              hitSlop={ACTION_HIT_SLOP}
              onPress={openCreateSheet}
              containerClassName={cn("rounded-md", focusRing)}
              className="h-10 w-10 items-center justify-center"
            >
              <Icon icon={Plus} size="md" weight="regular" tone="active" />
            </PressableScale>
          </View>
        </View>
      </View>

      {/* ── Strip tab feed ── */}
      <Tabs
        items={tabs.map((tab) => ({
          ...tab,
          icon: TAB_ICONS[tab.value],
          label: translate(tab.label),
          ...(tab.value === "popular" && onFilterPress
            ? {
                trailingAction: {
                  icon: Funnel,
                  accessibilityLabel: translate("Filter etalase"),
                  accessibilityHint: translate("Buka filter kondisi, rating, dan harga"),
                  onPress: onFilterPress,
                  badgeCount: filterBadgeCount,
                },
              }
            : {}),
        }))}
        value={kind}
        onChange={onKindChange}
        scrollable
        activeIconOnly
        largeLabels
      />
    </View>
  )
}
