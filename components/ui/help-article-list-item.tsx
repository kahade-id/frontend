/**
 * Kahade — <HelpArticleListItem> baris artikel/FAQ Pusat Bantuan (§9.17
 * List Item, §9.23 Search hasil).
 *
 * Satu item dari `GET /v1/help-center/categories/{slug}` atau hasil
 * `GET /v1/help-center/search`. Tap -> Push detail artikel (pemanggil
 * lalu memanggil `POST /v1/help-center/items/{id}/view`). Anatomi:
 *   ikon FileText -> judul (2 baris) + cuplikan/kategori (caption) -> chevron
 *
 * Keputusan non-obvious:
 *   - Di hasil pencarian, `highlight` (kata kunci) ditebalkan di judul via
 *     <Highlight> yang sudah ada — bukan warna latar kuning (§1 monokrom).
 *   - `snippet` opsional untuk hasil search (cuplikan isi); di daftar kategori
 *     biasanya kosong — baris jadi lebih pendek, itu disengaja.
 *   - `viewCount` tidak ditampilkan: angka popularitas tidak membantu user
 *     yang sedang bermasalah dan menambah kebisingan (§12 tenang).
 */
import { FileText } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Highlight } from "@/components/ui/highlight"
import { ListItem, type ListItemProps } from "@/components/ui/list-item"
import { Skeleton } from "@/components/ui/skeleton"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"

export type HelpArticleListItemProps = Omit<ListItemProps, "title" | "subtitle" | "leading" | "trailing" | "chevron"> & {
  title: string
  /** Cuplikan isi (hasil search) atau nama kategori */
  snippet?: string
  /** Kata kunci pencarian untuk ditebalkan di judul & cuplikan */
  highlight?: string
}

export function HelpArticleListItem({ title, snippet, highlight, onPress, href, inset = true, titleLines = 2, ...rest }: HelpArticleListItemProps) {
  /**
   * Baris artikel SELALU berpindah layar, jadi "interaktif" berarti punya
   * `onPress` ATAU `href`. Tanpa ini, mengirim `href` saja (tanpa `onPress`)
   * akan menghilangkan chevron dan accessibilityHint — baris tetap tautan
   * tetapi tidak lagi terlihat bisa dibuka.
   */
  const interactive = Boolean(onPress || href)
  const subtitle = snippet ? <Highlight text={snippet} query={highlight} variant="caption" tone="secondary" ellipsizeMode="tail" numberOfLines={2} /> : undefined

  return (
    <ListItem
      title={title}
      subtitle={subtitle}
      leading={FileText}
      chevron={interactive}
      onPress={onPress}
      href={href}
      inset={inset}
      titleLines={titleLines}
      accessibilityLabel={summarize([title, snippet])}
      accessibilityHint={interactive ? "Buka artikel" : undefined}
      {...rest}
    />
  )
}
/**
 * Audit Pengaturan & Bantuan 2026-10-10: kerangka baris artikel — dipakai
 * detail bantuan saat artikel/kategori backend sedang dimuat (shimmer,
 * bukan layar kosong).
 */
export function HelpArticleListItemSkeleton({ className, ...rest }: Omit<ViewProps, "children"> & { className?: string }) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Memuat artikel"
      className={cn("w-full flex-row items-center gap-3 py-3", className)}
      {...rest}
    >
      <Skeleton width={24} height={24} />
      <View className="flex-1 gap-2">
        <Skeleton height={16} className="w-4/5" />
        <Skeleton height={12} className="w-1/2" />
      </View>
    </View>
  )
}
