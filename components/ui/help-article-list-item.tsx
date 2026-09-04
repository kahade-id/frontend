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

import { Highlight } from "@/components/ui/highlight"
import { ListItem, type ListItemProps } from "@/components/ui/list-item"
import { summarize } from "@/lib/a11y"

export type HelpArticleListItemProps = Omit<ListItemProps, "title" | "subtitle" | "leading" | "trailing" | "chevron"> & {
  title: string
  /** Cuplikan isi (hasil search) atau nama kategori */
  snippet?: string
  /** Kata kunci pencarian untuk ditebalkan di judul & cuplikan */
  highlight?: string
}

export function HelpArticleListItem({ title, snippet, highlight, onPress, inset = true, titleLines = 2, ...rest }: HelpArticleListItemProps) {
  const subtitle = snippet ? <Highlight text={snippet} query={highlight} variant="caption" tone="secondary" numberOfLines={2} /> : undefined

  return (
    <ListItem
      title={title}
      subtitle={subtitle}
      leading={FileText}
      chevron={!!onPress}
      onPress={onPress}
      inset={inset}
      titleLines={titleLines}
      accessibilityLabel={summarize([title, snippet])}
      accessibilityHint={onPress ? "Buka artikel" : undefined}
      {...rest}
    />
  )
}
