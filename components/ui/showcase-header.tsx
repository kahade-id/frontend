/**
 * Kahade — <ShowcaseHeader> (bar atas tab Etalase; revisi 2026-09-23b).
 *
 * Layout (permintaan produk 2026-09-23):
 *
 *      [ ✎ kelola ]  [ (logo) ]  [ 🔔 notifikasi ]
 *      [ tab feed: Untuk Anda · Mengikuti · Terbaru · Populer ]
 *
 *   1. Baris atas TIGA elemen simetris: pensil (BUAT karya) di kiri,
 *      logo Kahade tepat di tengah, lonceng notifikasi di kanan. Kedua ikon
 *      memakai weight "regular" (BUKAN bold/fill) dan TANPA background —
 *      jejak visualnya satu guratan tipis, bukan kartu/kotak berisi.
 *      Glif: PencilSimpleLine (pencil-simple-line) dan BellSimple
 *      (bell-simple) — permintaan produk 2026-09-23.
 *   2. Balance pill DIHAPUS dari header: saldo bukan konteks etalase; angka
 *      dompet tetap hidup di tab Dompet (mode wallet).
 *   3. Baris pencarian + tombol (+) DIHAPUS. Pencarian dipusatkan di SATU
 *      layar (`/search`, pintu dari tab Transaksi) yang kini juga mencari
 *      postingan etalase; kelola etalase pindah ke ikon pensil di baris atas.
 *   4. ModeSwitcher DIHAPUS dari sini — satu-satunya rumah switch mode kini
 *      halaman profil sendiri (app/user/[username].tsx).
 *   5. Strip tab feed tetap: satu-satunya kontrol memilih jenis feed.
 *
 * Semua hex literal tetap dilarang (`npm run check:tokens`);
 * `shadow-sm`/`rounded-xl` tetap tidak ada (lihat tailwind.config).
 */

import { View } from "react-native"
import { useRouter, type Href } from "expo-router"
import {
  BellSimple,
  ClockCounterClockwise,
  MagnifyingGlass,
  PencilSimpleLine,
  Sparkle,
  TrendUp,
  Users,
} from "phosphor-react-native"

import { ROUTES } from "@/lib/routes"
import { useHasSession } from "@/lib/guest-gate"
import { useUnreadCountState } from "@/lib/unread-count"
import { cn } from "@/lib/cn"
import { hitSlopToReach } from "@/lib/hit-slop"
import { focusRing } from "@/lib/focus-ring"
import { translate } from "@/lib/i18n"

import { Logo } from "@/components/ui/logo"
import { NotificationDot } from "@/components/ui/badge"
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
  const unread = useUnreadCountState()
  // A-10 (audit 2026-09-23): kelola & notifikasi = layar terproteksi —
  // tamu diarahkan ke loginRequired(next=…) dengan konteks, bukan menabrak
  // dinding login (polanya sama dengan aksi sosial di feed).
  const hasSession = useHasSession()
  const goProtected = (target: Href, path: string) => {
    router.push(hasSession ? target : ROUTES.loginRequired(path))
  }

  return (
    <View className="bg-background">
      {/* ── Baris atas: kelola (pensil) · logo · notifikasi & search ── */}
      <View className="w-full flex-row items-center justify-between px-5 pb-2.5 pt-3">
        {/*
          Pensil = BUAT KARYA (revisi 2026-09-26): ikon ini dulu membuka
          halaman Kelola Etalase, padahal niat pengguna yang menekan ikon
          "tulis/kelola" di puncak feed hampir selalu "saya mau menambahkan
          karya". Kelola tetap satu ketukan dari sana lewat lingkaran di
          halaman Lainnya dan dari halaman pembuatan.
        */}
        <View className="flex-row items-center justify-start min-w-[84px]">
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={translate("Buat karya baru")}
            accessibilityHint={translate("Buka halaman untuk menambah karya ke etalase Anda")}
            haptic
            hitSlop={ACTION_HIT_SLOP}
            onPress={() => goProtected(ROUTES.showcaseCreate, "/showcase/create")}
            containerClassName={cn("rounded-md", focusRing)}
            className="h-10 w-10 items-center justify-center"
          >
            <Icon icon={PencilSimpleLine} size="md" weight="regular" tone="active" />
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

        {/* Notifikasi & Search di kanan */}
        <View className="flex-row items-center justify-end gap-1 min-w-[84px]">
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={
              unread.count
                ? translate("Notifikasi, {x} belum dibaca", { x: unread.count })
                : translate("Notifikasi")
            }
            accessibilityHint={translate("Buka notifikasi")}
            haptic
            hitSlop={ACTION_HIT_SLOP}
            onPress={() => goProtected(ROUTES.notifications, "/notifications")}
            containerClassName={cn("rounded-md", focusRing)}
            className="h-10 w-10 items-center justify-center"
          >
            <View className="relative">
              <Icon icon={BellSimple} size="md" weight="regular" tone="active" />
              <NotificationDot visible={(unread.count ?? 0) > 0} />
            </View>
          </PressableScale>

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
