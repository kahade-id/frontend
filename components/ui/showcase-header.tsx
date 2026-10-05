/**
 * Kahade — <ShowcaseHeader> (bar atas tab Etalase; revisi 2026-09-23b).
 *
 * Layout (revisi 2026-09-28, permintaan produk):
 *
 *      [ = menu ]  [ zigzag Kahade ]  [ + buat ]
 *      [ tab feed: Untuk Anda · Mengikuti · Terbaru · Populer · filter ]
 *
 *   1. Baris atas: equal (BUKA DRAWER) di kiri, logo Kahade tepat di tengah,
 *      dan (+) Buat Karya di kanan. Di native, tombol (+) langsung membuka
 *      form /showcase/create; sheet global tetap tersedia dari drawer.
 *      Ikon memakai weight "regular" (BUKAN bold/fill) dan TANPA background.
 *      Filter Etalase berada di samping tab "Populer".
 *   2. Sheet "Buat baru" (<CreateSheet>) tetap menjadi pintu pembuatan dari
 *      utility bar drawer; (+) Etalase native langsung ke form karya agar
 *      aksinya kontekstual. Fallback web dipertahankan untuk legacy test shell.
 *   3. Lonceng notifikasi DIHAPUS dari header — Notifikasi kini tab sejati di
 *      bottom navbar dengan badge unread.
 *   4. Balance pill DIHAPUS dari header: saldo bukan konteks etalase; angka
 *      dompet tetap hidup di layar Dompet (menu drawer mode wallet).
 *   5. Strip tab feed tetap: satu-satunya kontrol memilih jenis feed.
 *
 * Semua hex literal tetap dilarang (`npm run check:tokens`);
 * `shadow-sm`/`rounded-xl` tetap tidak ada (lihat tailwind.config).
 */

import { Platform, View } from "react-native"
import { router } from "expo-router"
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
import type { ViewInstance } from "react-native"

import { openCreateSheet } from "@/lib/create-sheet"
import { ROUTES } from "@/lib/routes"
import { openDrawer } from "@/lib/drawer"
import { HeaderCircleButton } from "@/components/ui/header"
import { translate } from "@/lib/i18n"

import { Logo } from "@/components/ui/logo"
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
export function ShowcaseHeader({ kind, onKindChange, tabs, onFilterPress, filterBadgeCount = 0 }: ShowcaseHeaderProps) {
  const createLabel = translate(Platform.OS === "web" ? "Buat baru" : "Buat karya baru")
  // Ref tombol (+) buat karya — View pembungkus (bukan PressableScale)
  // supaya ref selalu ke host View yang terukur.
  const createRef = useRef<ViewInstance>(null)
  return (
    <View className="bg-background">
      {/* ── Baris atas: menu (hamburger) · logo · buat baru ── */}
      <View className="w-full flex-row items-center justify-between px-5 pb-2.5 pt-3">
        {/*
          Tombol menu = BUKA DRAWER/SIDEBAR (revisi 2026-09-27): ikon Equal
          menggantikan hamburger List atas permintaan produk.
        */}
        <View className="flex-row items-center justify-start min-w-[84px]">
          {/* (2026-10-05, revisi produk: background lingkaran kaca seperti header lain.) */}
          <HeaderCircleButton
            icon={Equals}
            onPress={openDrawer}
            accessibilityLabel={translate("Menu")}
            accessibilityHint={translate("Buka menu navigasi")}
          />
        </View>

        {/* Logo — pusat baris simetris. */}
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel="Kahade"
          className="flex-1 items-center"
        >
          {/* (2026-10-05, revisi produk: logo hitam saja, bukan brand kuning.) */}
          <Logo variant="mark" size="md" tone="default" />
        </View>

        {/* Kanan: tombol buat baru; bidang search tersedia di sidebar. */}
        <View className="flex-row items-center justify-end min-w-[84px]">
          <View ref={createRef} collapsable={false}>
            {/* (2026-10-05, revisi produk: background lingkaran kaca seperti header lain.) */}
            <HeaderCircleButton
              icon={Plus}
              onPress={() => {
                // Native is the product surface: create the context-specific
                // artifact directly instead of routing through a generic sheet.
                if (Platform.OS === "web") openCreateSheet()
                else router.push(ROUTES.showcaseCreate)
              }}
              accessibilityLabel={createLabel}
              accessibilityHint={
                Platform.OS === "web"
                  ? translate("Membuka pilihan: buat karya, buat transaksi, atau isi saldo")
                  : undefined
              }
            />
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
