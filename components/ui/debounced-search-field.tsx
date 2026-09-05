/**
 * Kahade — <DebouncedSearchField>.
 *
 * Kolom cari yang MENYIMPAN teksnya sendiri dan hanya memberi tahu layar
 * ketika pengguna berhenti mengetik.
 *
 * Masalah yang diselesaikan (audit performa):
 *   Pola sebelumnya di layar Transaksi & Pencarian adalah
 *
 *     const [search, setSearch] = useState("")
 *     const debounced = useDebouncedValue(search.trim())
 *     ...
 *     <SearchField value={search} onChangeText={setSearch} />
 *     <PaginatedList renderItem={({ item }) => <OrderCard … />} />
 *
 *   `search` hidup di komponen LAYAR, jadi setiap ketukan huruf merender
 *   ulang seluruh layar — termasuk list. Karena `renderItem` ditulis inline,
 *   identitasnya berubah tiap render dan FlatList menggambar ulang semua
 *   baris yang terlihat. Terukur: 20 baris ter-render ulang untuk SATU
 *   perubahan state induk (lihat tests/list-render.test.tsx). Mengetik
 *   "pembayaran" = 10 ketukan x 20 kartu = 200 render kartu yang sia-sia,
 *   padahal hasilnya baru diminta sekali setelah debounce.
 *
 * Solusinya bukan menambal dengan memo di setiap baris — itu tidak cukup
 * (baris ber-memo tetap render ulang kalau prop callback-nya dibuat inline;
 * lihat tabel di tests/list-render.test.tsx) dan harus diulang di tiap layar.
 * Lebih murah: KURUNG state yang berubah cepat di komponen terkecil. Teks
 * mentah tidak pernah keluar dari komponen ini; layar hanya menerima nilai
 * yang sudah tenang, jadi list-nya ikut diam saat pengguna mengetik.
 *
 * `onQueryChange` menerima teks yang sudah di-trim, dan hanya dipanggil bila
 * nilainya benar-benar berubah — supaya spasi di ujung tidak memicu request.
 */
import { forwardRef, useCallback, useEffect, useRef, useState } from "react"
import type { TextInput } from "react-native"

import { SearchField, type SearchFieldProps } from "@/components/ui/search-field"

export type DebouncedSearchFieldProps = Omit<
  SearchFieldProps,
  "value" | "onChangeText" | "onSearch"
> & {
  /** Nilai awal; setelah itu teks dikelola di dalam komponen ini. */
  initialQuery?: string
  /** Dipanggil dengan teks ter-trim setelah pengguna berhenti mengetik. */
  onQueryChange: (query: string) => void
}

export const DebouncedSearchField = forwardRef<TextInput, DebouncedSearchFieldProps>(
  function DebouncedSearchField({ initialQuery = "", onQueryChange, ...rest }, ref) {
    const [text, setText] = useState(initialQuery)

    // Ref supaya perubahan identitas handler dari pemanggil tidak
    // menjadwal ulang debounce yang sedang berjalan.
    const latest = useRef(onQueryChange)
    latest.current = onQueryChange

    // Nilai terakhir yang sudah dikirim; mencegah request ulang untuk teks
    // yang secara efektif sama ("abc" -> "abc ").
    const emitted = useRef(initialQuery.trim())

    const emit = useCallback((next: string) => {
      const trimmed = next.trim()
      if (trimmed === emitted.current) return
      emitted.current = trimmed
      latest.current(trimmed)
    }, [])

    // Kosongkan lewat tombol clear harus terasa instan: tanpa ini pengguna
    // menunggu debounce hanya untuk kembali ke daftar penuh.
    const handleChangeText = useCallback(
      (next: string) => {
        setText(next)
        if (next.trim() === "") emit("")
      },
      [emit],
    )

    useEffect(() => {
      emitted.current = initialQuery.trim()
    }, [initialQuery])

    return (
      <SearchField
        {...rest}
        ref={ref}
        value={text}
        onChangeText={handleChangeText}
        onSearch={emit}
      />
    )
  },
)
