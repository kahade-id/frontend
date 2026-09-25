/**
 * Screen — Promo: HUB semua yang berkepentingan dengan promo (rev. 2026-09-23).
 * Route tetap /vouchers (deep link & tabel mode), isi halaman diperluas.
 *
 * Susunan mengikuti cara pengguna memikirkan promo, bukan urutan endpoint:
 *   1. KODE PROMO    — tukar kode dari kampanye (POST /v1/vouchers/validate).
 *   2. VOUCHER AKTIF — yang bisa dipakai sekarang, diurut paling mendesak.
 *   3. UNDANG TEMAN  — kode referral + statistik + bagikan (GET my-code &
 *      stats) — aksi "Lihat semua" membuka /referral untuk riwayat/reward.
 *      Termasuk PAPAN PERINGKAT 3 teratas (GET /v1/referral/leaderboard).
 *   4. LENCANA       — ringkasan progres (GET /v1/badges + /my): "X dari Y
 *      diraih" + lencana berikutnya yang paling dekat, pintu ke /badges.
 *   5. VOUCHER TERPAKAI — riwayat pemakaian + nominal yang dihemat.
 *
 * Keputusan non-obvious:
 *   - Query VOUCHER tetap satu state kerangka <DataScreen> (kegagalannya
 *     mematikan halaman — voucher adalah isi utama). Query referral,
 *     leaderboard, dan lencana adalah "soft": gagal = seksi hilang, bukan
 *     halaman rusak (pola fallback .catch di app/referral.tsx).
 *   - Kunci leaderboard SAMA dengan app/referral.tsx ("referral-leaderboard",
 *     limit 10): endpoint+parameter identik → satu entri cache (aturan C-02
 *     lib/query-keys.ts). Query referral & lencana pakai kunci sendiri
 *     ("promo-referral", "promo-badges") karena BENTUK datanya ringkasan,
 *     bukan salinan /referral & /badges.
 *   - Tamu web: seluruh endpoint promo auth-required — halaman menampilkan
 *     ajakan masuk (pola tab Dompet), bukan badai error 401.
 *   - Validasi kode TIDAK otomatis memasang voucher ke transaksi apa pun:
 *     tidak ada konteks order di layar ini. Yang ditawarkan setelah kode
 *     berlaku: "Pakai di transaksi baru" → create-transaction dengan kode.
 *   - `discount` hasil validasi hanya diisi bila backend mengirim nominalnya.
 *     Untuk voucher persen, potongan baru diketahui setelah orderValue ada.
 *   - Urutan voucher aktif: hampir hangus → tenggat terdekat → potongan
 *     terbesar. Voucher yang mau hangus adalah alasan orang membuka layar ini.
 *   - `discountType` dibaca longgar (lihat `discountTypeOf`): kosakata
 *     backend tidak seragam (FEE_DISCOUNT_FLAT / WALLET_CASHBACK /
 *     TOPUP_BONUS = nominal).
 *   - Dua daftar voucher tidak berbagi satu EmptyState global: bila voucher
 *     tersedia kosong TAPI riwayat ada, riwayat tetap dirender.
 */
import { useCallback, useState } from "react"
import { View } from "react-native"
import { CaretRight, Medal, Ticket } from "phosphor-react-native"
import { router } from "expo-router"

import { api, userMessage } from "@/lib/api"
import type { ReferralLeaderboardEntry } from "@/lib/api/referrals"
import { readBadgeList, type Badge } from "@/lib/api/badges"
import type { Voucher } from "@/lib/api/vouchers"
import { mergeBadges } from "@/lib/badges"
import { useCopy } from "@/lib/clipboard"
import { referralUrl } from "@/lib/deeplinks"
import { formatDateTime, formatDateTimeWIB, formatNumber, formatRupiah } from "@/lib/format"
import { useHasSession } from "@/lib/guest-gate"
import { haptic } from "@/lib/haptics"
import { translate } from "@/lib/i18n/translate"
import { ROUTES } from "@/lib/routes"
import { logWarn } from "@/lib/telemetry"
import { useApiQuery } from "@/lib/use-api-query"
import { shareContent } from "@/lib/share"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DataScreen } from "@/components/ui/data-screen"
import { EmptyState } from "@/components/ui/empty-state"
import { GuestLoginPrompt } from "@/components/web-guest-gate"
import { Header } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { IconBox } from "@/components/ui/icon-box"
import { ProgressBar } from "@/components/ui/progress-bar"
import { ReferralCodeCard } from "@/components/ui/referral-code-card"
import { RouteLink } from "@/components/ui/route-link"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { VoucherCard } from "@/components/ui/voucher-card"
import {
  VoucherRedeemBox,
  type AppliedVoucher,
} from "@/components/ui/voucher-redeem-box"
import { VoucherUsageListItem } from "@/components/ui/voucher-usage-list-item"

/** Voucher ditandai "segera berakhir" bila sisa waktunya di bawah ambang ini. */
const EXPIRES_SOON_MS = 3 * 24 * 60 * 60 * 1000

/** Spec badges: `limit` maximum 100 — katalog kecil, satu halaman cukup. */
const BADGE_LIMIT = 100

/** Papan peringkat: 3 teratas sebagai cuplikan (papan penuh ada di /referral). */
const LEADERBOARD_PREVIEW = 3

/**
 * Nilai `discountType`/`voucherType` yang berarti POTONGAN NOMINAL (Rupiah).
 *
 * Kosakata backend tidak seragam antar endpoint: DTO admin memakai
 * FEE_DISCOUNT_FLAT / WALLET_CASHBACK / TOPUP_BONUS, tipe lokal layar ini
 * memakai FIXED. Semuanya nominal — cashback dan bonus top-up adalah angka
 * Rupiah, bukan persen.
 */
const FLAT_DISCOUNT_VALUES = new Set([
  "FIXED",
  "FLAT",
  "FEE_DISCOUNT_FLAT",
  "WALLET_CASHBACK",
  "TOPUP_BONUS",
  "NOMINAL",
])

/** Enum diskon UI hanya mengenal PERCENTAGE/FIXED; nilai lain dibaca longgar. */
function discountTypeOf(v: Voucher): "FIXED" | "PERCENTAGE" {
  const raw = (v.discountType ?? v.voucherType ?? "").toUpperCase()
  return FLAT_DISCOUNT_VALUES.has(raw) ? "FIXED" : "PERCENTAGE"
}

function expiresSoon(v: Voucher): boolean {
  if (!v.expiresAt) return false
  const time = new Date(v.expiresAt).getTime()
  return Number.isFinite(time) && time - Date.now() < EXPIRES_SOON_MS
}

/** Paling mendesak dulu: hampir hangus → tenggat terdekat → potongan terbesar. */
function byUrgency(a: Voucher, b: Voucher): number {
  const soonDiff = Number(expiresSoon(b)) - Number(expiresSoon(a))
  if (soonDiff !== 0) return soonDiff
  const ta = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.POSITIVE_INFINITY
  const tb = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.POSITIVE_INFINITY
  if (ta !== tb) return ta - tb
  return (b.discountValue ?? 0) - (a.discountValue ?? 0)
}

// ------------------------------------------------------------------
// Ringkasan lencana untuk seksi promo
// ------------------------------------------------------------------

type BadgeSummary = {
  earned: number
  total: number
  /** Lencana belum diraih yang paling dekat (persentase tertinggi). */
  next: { name: string; percent: number } | null
}

function badgePercent(b: Badge): number {
  if (!b.progress) return 0
  return Math.round((b.progress.current / Math.max(1, b.progress.target)) * 100)
}

/**
 * Ringkasan lencana — katalog boleh gagal (total jatuh ke jumlah milik saya),
 * "my" gagal = seksi disembunyikan (null).
 */
async function fetchBadgeSummary(signal?: AbortSignal): Promise<BadgeSummary | null> {
  const [mineRes, allRes] = await Promise.allSettled([
    api.badges.listMyBadges({ page: 1, limit: BADGE_LIMIT }, signal),
    api.badges.listAllBadges({ page: 1, limit: BADGE_LIMIT }, signal),
  ])
  if (mineRes.status === "rejected") throw mineRes.reason
  const mine = readBadgeList(mineRes.value)
  const all = allRes.status === "fulfilled" ? readBadgeList(allRes.value) : []
  const merged = mergeBadges(all, mine)
  const next = merged
    .filter((b) => b.earned !== true && b.progress)
    .sort((a, b) => badgePercent(b) - badgePercent(a))[0]
  return {
    earned: merged.filter((b) => b.earned === true).length,
    total: merged.length,
    next: next ? { name: next.name, percent: badgePercent(next) } : null,
  }
}

// ------------------------------------------------------------------
// Seksi
// ------------------------------------------------------------------

/**
 * Cuplikan papan peringkat referral — 3 teratas, tanpa tautan sendiri:
 * seluruh papan (10 teratas) ada di /referral lewat aksi seksi Undang Teman.
 * Baris mengikuti pola baris papan di app/referral.tsx supaya satu bahasa.
 */
function LeaderboardPreview({ entries }: { entries: readonly ReferralLeaderboardEntry[] }) {
  const top = entries.slice(0, LEADERBOARD_PREVIEW)
  return (
    <View className="overflow-hidden rounded-md border border-border bg-surface">
      {top.map((e, i) => (
        <View
          key={`${e.rank}-${e.username}`}
          accessible
          className="flex-row items-center gap-3 px-4 py-3"
          accessibilityLabel={translate("Peringkat {x}, {y}, mengundang {z} orang, total reward {w}", {
            x: e.rank,
            y: e.fullName ?? e.username,
            z: e.invitedCount,
            w: formatRupiah(e.totalReward),
          })}
        >
          <View className="w-5 items-center">
            <Text
              variant="monoBody"
              tone={e.rank <= 3 ? "primary" : "secondary"}
              weight={e.rank <= 3 ? 600 : 400}
            >
              {e.rank}
            </Text>
          </View>
          <Avatar source={e.avatarUrl ?? undefined} name={e.fullName ?? e.username} size="sm" />
          <View className="min-w-0 flex-1">
            <Text ellipsizeMode="tail" variant="body" weight={500} tone="primary" numberOfLines={1}>
              {e.fullName ?? e.username}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {translate("{x} undangan", { x: e.invitedCount })}
            </Text>
          </View>
          <Text variant="monoBody" tone="secondary" numberOfLines={1}>
            {formatRupiah(e.totalReward)}
          </Text>
          {i < top.length - 1 ? (
            <View
              accessibilityRole="none"
              importantForAccessibility="no"
              className="absolute inset-x-0 bottom-0 h-px bg-border"
            />
          ) : null}
        </View>
      ))}
    </View>
  )
}

/** Kartu ringkasan lencana — "X dari Y diraih" + progres lencana berikutnya. */
function BadgeSummaryCard({ summary }: { summary: BadgeSummary }) {
  const hasBadges = summary.earned > 0
  return (
    <Card
      href={ROUTES.badges}
      accessibilityLabel={translate("{x} dari {y} lencana diraih", {
        x: summary.earned,
        y: summary.total,
      })}
      accessibilityHint="Buka halaman lencana"
      className="gap-4"
    >
      <View className="flex-row items-center gap-3">
        <IconBox icon={Medal} size="md" variant={hasBadges ? "inverted" : "surface"} />
        <View className="min-w-0 flex-1 gap-0.5">
          <Text variant="body" weight={600} tone="primary" numberOfLines={1}>
            {translate("{x} dari {y} lencana diraih", { x: summary.earned, y: summary.total })}
          </Text>
          <Text ellipsizeMode="tail" variant="caption" tone="secondary" numberOfLines={1}>
            {summary.next
              ? translate("Berikutnya: {x} — {y} persen", { x: summary.next.name, y: summary.next.percent })
              : "Lihat koleksi lencana Anda"}
          </Text>
        </View>
        <Icon icon={CaretRight} size="md" tone="default" />
      </View>
      {summary.next ? <ProgressBar value={summary.next.percent} size="sm" /> : null}
    </Card>
  )
}

// ------------------------------------------------------------------
// Screen
// ------------------------------------------------------------------

export default function VouchersScreen() {
  const hasSession = useHasSession()
  const toast = useToast()
  const { copied, copy } = useCopy()

  const query = useApiQuery(
    "vouchers",
    async (signal) => {
      const [available, usage] = await Promise.all([
        api.vouchers.listAvailableVouchers(signal),
        api.vouchers.listMyVoucherUsage(signal),
      ])
      return { available: available ?? [], usage: usage ?? [] }
    },
    hasSession,
  )
  const available = query.data?.available ?? []
  const usage = query.data?.usage ?? []

  // ── Undang teman: kode + statistik (soft) ──────────────────────
  const referralQuery = useApiQuery("promo-referral", async (signal) => {
    const [code, stats] = await Promise.all([
      api.referrals.getMyReferralCode(signal),
      api.referrals.getReferralStats(signal).catch((err) => {
        logWarn("promo:referral-stats", err)
        return null
      }),
    ])
    return {
      code: code?.code ?? "",
      stats: stats
        ? {
            totalReferred: stats.totalInvited,
            qualified: stats.completed,
            totalReward: stats.totalReward,
          }
        : null,
    }
  }, hasSession)
  const referralCode = referralQuery.data?.code ?? ""
  const referralStats = referralQuery.data?.stats ?? null
  const referralReady = !referralQuery.loading && referralQuery.error == null && referralCode !== ""

  // ── Papan peringkat (soft; kunci & bentuk sama dengan app/referral.tsx) ──
  const leaderboardQuery = useApiQuery<ReferralLeaderboardEntry[]>(
    "referral-leaderboard",
    async (signal) =>
      (await api.referrals.getReferralLeaderboard(10, signal).catch((err) => {
        logWarn("promo:leaderboard", err)
        return undefined
      })) ?? [],
    hasSession,
  )
  const leaderboard = leaderboardQuery.data ?? []

  // ── Ringkasan lencana (soft) ───────────────────────────────────
  const badgesQuery = useApiQuery<BadgeSummary | null>(
    "promo-badges",
    (signal) =>
      fetchBadgeSummary(signal).catch((err) => {
        logWarn("promo:badges", err)
        return null
      }),
    hasSession,
  )
  const badgeSummary = badgesQuery.data ?? null

  // ── Kode promo ─────────────────────────────────────────────────
  const [checking, setChecking] = useState(false)
  const [applied, setApplied] = useState<AppliedVoucher | undefined>(undefined)
  const [promoError, setPromoError] = useState<string | null>(null)

  const handleApplyCode = useCallback(async (code: string) => {
    setChecking(true)
    setPromoError(null)
    try {
      const result = await api.vouchers.validateVoucher({ code })
      if (!result.valid) {
        setApplied(undefined)
        setPromoError(result.message ?? "Kode ini tidak berlaku untuk akun Anda.")
        return
      }
      const voucher = result.voucher
      // Nominal hanya diisi bila backend benar-benar mengirim angkanya.
      const discount =
        voucher && Number.isFinite(voucher.discountValue ?? Number.NaN)
          ? (voucher.discountValue as number)
          : undefined
      setApplied({ code, title: voucher?.title ?? undefined, discount })
    } catch (error) {
      setApplied(undefined)
      setPromoError(userMessage(error))
    } finally {
      setChecking(false)
    }
  }, [])

  const clearPromo = useCallback(() => {
    setApplied(undefined)
    setPromoError(null)
  }, [])

  const handleShareReferral = useCallback(async () => {
    if (!referralCode) return
    const url = referralUrl(referralCode)
    const outcome = await shareContent({
      title: "Ajak teman ke Kahade",
      message: translate("Pakai kode referral saya {x} saat daftar di Kahade — transaksi aman dengan escrow.", {
        x: referralCode,
      }),
      url,
    })
    if (outcome === "unavailable") {
      const ok = await copy(url)
      if (ok) haptic("select")
      toast.show({
        title: ok ? "Tautan undangan disalin" : "Tidak bisa membagikan",
        tone: ok ? "success" : "danger",
      })
    }
  }, [copy, referralCode, toast])

  const sorted = [...available].sort(byUrgency)

  // Tamu web: seluruh endpoint promo auth-required — ajakan masuk, bukan error.
  if (!hasSession) {
    return (
      <Screen edges={["top"]} padded={false}>
        <Header showBack={false} title="Promo" />
        <GuestLoginPrompt bare next="/vouchers" />
      </Screen>
    )
  }

  return (
    <DataScreen
      title="Promo"
      shiftFade
      state={query}
      loadingMessage="Memuat promo…"
      /*
       * SENGAJA tanpa prop `empty`: DataScreen mengganti SELURUH children
       * dengan EmptyState bila `empty` truthy, dan itu akan menyembunyikan
       * tukar kode promo + seksi undang teman + lencana persis pada pengguna
       * yang paling membutuhkannya. Tiap bagian menangani kosongnya sendiri.
       */
    >
      {/* ── 1. Kode promo ────────────────────────────────────── */}
      <View className="gap-3">
        <SectionHeader
          title="Kode promo"
          level="h3"
          subtitle="Punya kode dari promo atau kampanye? Periksa di sini."
        />
        <VoucherRedeemBox
          applied={applied}
          applying={checking}
          errorText={promoError ?? undefined}
          onApply={(code) => void handleApplyCode(code)}
          onRemove={clearPromo}
          labels={{ heading: "Kode promo", placeholder: "Masukkan kode", apply: "Cek kode" }}
        />
        {applied ? (
          <>
            <Text variant="caption" tone="secondary">
              Kode berlaku. Potongan diterapkan saat transaksi dibuat.
            </Text>
            <Button
              variant="secondary"
              size="sm"
              fullWidth={false}
              onPress={() => router.push(ROUTES.createTransactionWithVoucher(applied.code))}
            >
              Pakai di transaksi baru
            </Button>
          </>
        ) : null}
      </View>

      {/* ── 2. Voucher aktif ─────────────────────────────────── */}
      <View className="gap-3">
        <SectionHeader
          title="Voucher aktif"
          level="h3"
          action={
            available.length > 0 ? (
              <Text variant="caption" tone="tertiary">
                {formatNumber(available.length)} tersedia
              </Text>
            ) : undefined
          }
        />
        {sorted.length === 0 ? (
          <EmptyState
            compact
            icon={Ticket}
            title="Belum ada voucher aktif"
            description="Voucher promo akan muncul di sini."
          />
        ) : (
          sorted.map((v) => (
            <VoucherCard
              key={v.code}
              code={v.code}
              title={v.title ?? v.code}
              description={v.description}
              discountType={discountTypeOf(v)}
              discountValue={v.discountValue ?? Number.NaN}
              maxDiscount={v.maxDiscount}
              minOrderValue={v.minOrderValue}
              expiresAt={v.expiresAt ? formatDateTimeWIB(v.expiresAt) : undefined}
              expiresSoon={expiresSoon(v)}
              onUse={() => router.push(ROUTES.createTransactionWithVoucher(v.code))}
            />
          ))
        )}
      </View>

      {/* ── 3. Undang teman ──────────────────────────────────── */}
      {referralReady ? (
        <View className="gap-3">
          <SectionHeader
            title="Undang teman"
            level="h3"
            subtitle="Anda dan teman mendapat hadiah saat transaksi pertamanya selesai."
            action={
              <RouteLink
                href={ROUTES.referral}
                accessibilityLabel="Lihat semua undangan dan reward"
                containerClassName="rounded-xs"
              >
                <Text variant="body" weight={600} tone="primary">
                  Lihat semua
                </Text>
              </RouteLink>
            }
          />
          <ReferralCodeCard
            code={referralCode}
            shareUrl={referralUrl(referralCode)}
            stats={referralStats ?? undefined}
            copied={copied}
            onCopy={(v) => void copy(v)}
            onShare={() => void handleShareReferral()}
            labels={{ title: "Kode referral Anda" }}
          />
          {leaderboard.length > 0 ? (
            <View className="gap-3 pt-1">
              <SectionHeader
                title="Papan peringkat"
                level="h3"
                subtitle="3 undangan terbanyak bulan ini"
              />
              <LeaderboardPreview entries={leaderboard} />
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── 4. Lencana ───────────────────────────────────────── */}
      {badgeSummary && badgeSummary.total > 0 ? (
        <View className="gap-3">
          <SectionHeader
            title="Lencana"
            level="h3"
            subtitle="Kumpulkan lencana dari aktivitas transaksi Anda."
            action={
              <RouteLink
                href={ROUTES.badges}
                accessibilityLabel="Lihat semua lencana"
                containerClassName="rounded-xs"
              >
                <Text variant="body" weight={600} tone="primary">
                  Lihat semua
                </Text>
              </RouteLink>
            }
          />
          <BadgeSummaryCard summary={badgeSummary} />
        </View>
      ) : null}

      {/* ── 5. Voucher terpakai ──────────────────────────────── */}
      <View className="gap-3">
        <SectionHeader
          title="Voucher terpakai"
          level="h3"
          action={
            usage.length > 0 ? (
              <Text variant="caption" tone="tertiary">
                {formatNumber(usage.length)} kali dipakai
              </Text>
            ) : undefined
          }
        />
        {usage.length === 0 ? (
          <EmptyState
            compact
            icon={Ticket}
            title="Belum ada pemakaian"
            description="Voucher yang sudah Anda pakai akan tercatat di sini."
          />
        ) : (
          usage.map((u, index) => (
            <VoucherUsageListItem
              key={u.usageId ?? `${u.code}:${index}`}
              title={u.title ?? u.code}
              code={u.code}
              savedAmount={u.discountValue ?? Number.NaN}
              usedAt={u.usedAt ? formatDateTime(u.usedAt) : undefined}
            />
          ))
        )}
      </View>
    </DataScreen>
  )
}
