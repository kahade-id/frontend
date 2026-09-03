/**
 * Kahade — <ProfileHeader> (§9.8 Avatar, §3 tipografi, §4 spacing).
 *
 * Kepala halaman profil publik (penjual/pembeli) dan profil sendiri.
 * Anatomi, dari atas: [Avatar lg | nama + handle + badge] -> bio ->
 * baris statistik (Mono) -> slot aksi (FollowButton / "Edit profil").
 *
 * Keputusan non-obvious:
 *   - Layout rata kiri (avatar di kiri, teks di kanan), BUKAN avatar besar
 *     di tengah ala media sosial. Kahade adalah platform escrow: profil
 *     dibaca untuk menilai kredibilitas pihak lawan (KYC, jumlah transaksi,
 *     rating), jadi hierarki teks harus segera terbaca seperti "kartu
 *     identitas", dan konsisten dengan Header/ListItem yang semuanya rata
 *     kiri. Avatar `lg` (56px), bukan `xl`: xl menyisakan kolom teks < 60%
 *     lebar di 360px.
 *   - Nama H2 (22/700) — H1 disediakan untuk judul layar; nama di dalam
 *     konten satu tingkat di bawahnya. Handle `caption text-secondary`
 *     dengan prefix "@" ditulis pemanggil (komponen tidak menambah karakter
 *     agar i18n/alias non-username tetap bisa).
 *   - `verified` diteruskan ke <Avatar verified> (SealCheck) DAN ditulis
 *     eksplisit sebagai Badge "Terverifikasi" di baris handle: ikon kecil di
 *     avatar saja mudah terlewat, sementara status KYC adalah sinyal trust
 *     utama di escrow. Badge memakai tone neutral (KYC bukan status
 *     transaksi, §2.3).
 *   - Statistik: nilai Mono Body (angka data §3.1) + label caption. Nilai
 *     sudah diformat pemanggil (formatNumber / "4,8"), komponen tidak
 *     memformat karena tipe nilainya beragam (jumlah, rating, persen).
 *     Tiap stat boleh `onPress` (mis. buka daftar pengikut) — dibungkus
 *     PressableScale scaleOnPress=false, sama alasannya dengan ListItem.
 *     Dipisah `Divider vertical` (§6, bukan spasi kosong) agar tiga angka
 *     tidak terbaca sebagai satu deret.
 *   - Bio maksimal 3 baris (`numberOfLines`), pemanggil pasang "Selengkapnya"
 *     sendiri bila perlu — komponen tidak menebak panjang teks.
 *   - Loading: Skeleton menggantikan avatar, nama, handle, dan nilai stat;
 *     label stat tetap tampil supaya layout tidak melompat (pola StatCard).
 *   - Padding horizontal `px-6` (screen padding §4) ada DI DALAM komponen
 *     karena header profil selalu full-bleed di bawah <Header> layar.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Divider } from "@/components/ui/divider"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type ProfileStat = {
  /** Sudah diformat: "128", "4,8", "98%" */
  value: string
  label: string
  onPress?: () => void
}

export type ProfileHeaderProps = Omit<ViewProps, "children"> & {
  name: string
  /** Mis. "@budisantoso" — prefix ditulis pemanggil */
  handle?: string
  avatar?: Pick<AvatarProps, "source">
  /** KYC terverifikasi: SealCheck di avatar + Badge */
  verified?: boolean
  bio?: string
  stats?: readonly ProfileStat[]
  /** Slot aksi: <FollowButton/>, <Button variant="secondary">Edit profil</Button>, dst */
  action?: ReactNode
  /** Teks badge KYC (i18n) — default "Terverifikasi" */
  verifiedLabel?: string
  loading?: boolean
  className?: string
}

export function ProfileHeader({
  name,
  handle,
  avatar,
  verified = false,
  bio,
  stats,
  action,
  verifiedLabel = "Terverifikasi",
  loading = false,
  className,
  ...rest
}: ProfileHeaderProps) {
  return (
    <View
      accessible={loading}
      accessibilityLabel={loading ? "Memuat profil" : undefined}
      className={cn("w-full gap-4 px-6 py-4", className)}
      {...rest}
    >
      {/* Identitas */}
      <View className="flex-row items-center gap-4">
        {loading ? (
          <Skeleton shape="circle" width={56} height={56} />
        ) : (
          <Avatar source={avatar?.source} name={name} size="lg" verified={verified} />
        )}

        <View className="flex-1 gap-1">
          {loading ? (
            <>
              <Skeleton height={22} className="w-3/5" />
              <Skeleton height={14} className="w-2/5" />
            </>
          ) : (
            <>
              <Text variant="h2" numberOfLines={2}>
                {name}
              </Text>
              {handle || verified ? (
                <View className="flex-row flex-wrap items-center gap-2">
                  {handle ? (
                    <Text variant="caption" tone="secondary" numberOfLines={1}>
                      {handle}
                    </Text>
                  ) : null}
                  {verified ? <Badge tone="neutral">{verifiedLabel}</Badge> : null}
                </View>
              ) : null}
            </>
          )}
        </View>
      </View>

      {/* Bio */}
      {!loading && bio ? (
        <Text variant="body" tone="secondary" numberOfLines={3}>
          {bio}
        </Text>
      ) : null}

      {/* Statistik */}
      {stats && stats.length > 0 ? (
        <View className="flex-row items-stretch rounded-md border border-border bg-surface">
          {stats.map((s, i) => (
            <View key={s.label} className="flex-1 flex-row items-stretch">
              {i > 0 ? <Divider orientation="vertical" /> : null}
              <StatCell stat={s} loading={loading} />
            </View>
          ))}
        </View>
      ) : null}

      {/* Aksi */}
      {action ? <View className="flex-row items-center gap-3">{action}</View> : null}
    </View>
  )
}

function StatCell({ stat, loading }: { stat: ProfileStat; loading: boolean }) {
  const body = (
    <View className="flex-1 items-center justify-center gap-[2px] px-2 py-3">
      {loading ? (
        <Skeleton height={16} width={40} />
      ) : (
        <Text variant="monoBody" tone="primary" numberOfLines={1}>
          {stat.value}
        </Text>
      )}
      <Text variant="caption" tone="secondary" numberOfLines={1}>
        {stat.label}
      </Text>
    </View>
  )

  if (!stat.onPress || loading) {
    return (
      <View accessible accessibilityLabel={`${stat.label} ${stat.value}`} className="flex-1">
        {body}
      </View>
    )
  }

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${stat.label} ${stat.value}`}
      scaleOnPress={false}
      onPress={stat.onPress}
      containerClassName="flex-1"
      className="flex-1"
    >
      {body}
    </PressableScale>
  )
}
