/**
 * Kahade — filter pencarian lokal Pengaturan (batch 139 A15).
 *
 * Murni fungsi atas item menu yang SUDAH ADA — tidak ada destinasi baru.
 * Diekstrak dari app/settings.tsx agar unit-testable (vitest default hanya
 * menjalankan `tests/**\/*.test.ts`).
 */

export type SettingsSearchGroup<TItem extends { label: string }> = {
  title: string
  items: TItem[]
}

/**
 * Filter grup menu berdasarkan query. Case-insensitive, trim whitespace.
 * Query kosong → grup dikembalikan apa adanya. Grup yang tidak punya item
 * cocok dibuang.
 */
export function filterSettingsGroups<TItem extends { label: string }>(
  groups: SettingsSearchGroup<TItem>[],
  query: string,
): SettingsSearchGroup<TItem>[] {
  const q = query.trim().toLowerCase()
  if (!q) return groups
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.label.toLowerCase().includes(q)),
    }))
    .filter((group) => group.items.length > 0)
}
