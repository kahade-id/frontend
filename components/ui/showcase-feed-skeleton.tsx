/**
 * Kahade — <ShowcaseFeedItemSkeleton> + <ShowcaseFeedSkeleton>.
 *
 * Placeholder muat-pertama untuk daftar bergaya postingan sosial
 * (<ShowcaseFeedItem>): meniru anatomi kartu asli supaya layout tidak
 * melompat saat data tiba —
 *   1. baris penulis: avatar lingkaran + dua baris nama · @user/waktu +
 *      lingkaran ikon kanan (tombol lapor ghost di kartu asli),
 *   2. media card full-bleed (mx-5, aspect-square),
 *   3. blok teks: baris kategori + judul + dua baris deskripsi,
 *   4. baris aksi: dua grup hitungan (suka · komentar) + spacer +
 *      dua ikon (bagikan · simpan).
 *
 * Pulse + reduced-motion diwarisi dari <Skeleton>/<SkeletonGroup> — tidak
 * ada logika animasi sendiri di sini. Warna dari tokens lewat Skeleton
 * (bg-surface / dark:bg-surface-elevated), tanpa hex literal.
 */
import { View } from "react-native"

import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"

/**
 * Satu kartu skeleton sebentuk <ShowcaseFeedItem>.
 * Spacing meniru kartu asli: author row `px-5 pt-3`, media `mx-5 pt-3`,
 * blok teks `px-5 pt-3`, baris aksi `px-2 pt-1`.
 */
export function ShowcaseFeedItemSkeleton() {
  return (
    <View>
      {/* ── Penulis: avatar + 2 baris teks + ikon kanan ── */}
      <View className="flex-row items-center gap-3 px-5 pt-3">
        {/* Avatar md = h-10 w-10 */}
        <Skeleton shape="circle" className="h-10 w-10" />
        <View className="min-w-0 flex-1 gap-1.5">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-1/3" />
        </View>
        <Skeleton shape="circle" className="h-10 w-10" />
      </View>

      {/* ── Media card ── */}
      <View className="mx-5 pt-3">
        <Skeleton shape="card" className="aspect-square w-full" />
      </View>

      {/* ── Kategori · judul · deskripsi ── */}
      <View className="gap-1.5 px-5 pt-3">
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </View>

      {/* ── Aksi: suka · komentar (kiri) · bagikan · simpan (kanan) ── */}
      <View className="flex-row items-center gap-2 px-2 pt-1">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
        <View className="flex-1" />
        {/* Tombol ikon = min-h-11 min-w-11 di kartu asli */}
        <Skeleton shape="circle" className="h-11 w-11" />
        <Skeleton shape="circle" className="h-11 w-11" />
      </View>
    </View>
  )
}

/**
 * Grup skeleton untuk muat-pertama daftar feed.
 * Gap antar kartu = tokens.space[5] — sama dengan separator feed
 * (`gap={tokens.space[5]}` di <ShowcaseFeedTab>).
 */
export function ShowcaseFeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <SkeletonGroup className="gap-5">
      {Array.from({ length: count }, (_, index) => (
        <ShowcaseFeedItemSkeleton key={index} />
      ))}
    </SkeletonGroup>
  )
}
