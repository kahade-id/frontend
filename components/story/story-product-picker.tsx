/**
 * Kahade — <StoryProductPicker>: pilih produk etalase sendiri untuk di-tag.
 *
 * Sumber: GET /v1/users/me/showcase (etalase milik sendiri, bukan publik).
 * Batas tag per story: STORY_PRODUCT_TAGS_MAX. Pilihan dikembalikan sekaligus
 * saat "Selesai", sehingga pemilih tidak mengubah draft sebelum dikonfirmasi.
 */
import { Check } from "phosphor-react-native"
import { useEffect, useState } from "react"
import { View } from "react-native"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Icon } from "@/components/ui/icon"
import { Picture } from "@/components/ui/picture"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { userMessage } from "@/lib/api/errors"
import { STORY_PRODUCT_TAGS_MAX } from "@/lib/api/story"
import { getMyShowcase, type ShowcaseItem } from "@/lib/api/users"
import { useT } from "@/lib/i18n"
import { useApiQuery } from "@/lib/use-api-query"
import { ShoppingBag } from "phosphor-react-native"

export type StoryProductPickerProps = {
  visible: boolean
  selectedIds: readonly string[]
  onDone: (picked: Array<{ productId: string; title: string }>) => void
  onRequestClose: () => void
}

export function StoryProductPicker({ visible, selectedIds, onDone, onRequestClose }: StoryProductPickerProps) {
  const t = useT()
  const query = useApiQuery("story-my-showcase", (signal) => getMyShowcase(signal), visible)
  const [picked, setPicked] = useState<string[]>([])

  useEffect(() => {
    if (visible) setPicked([...selectedIds])
    // Hanya saat sheet dibuka; perubahan draft di luar tidak boleh menimpa pilihan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const items: ShowcaseItem[] = (query.data ?? []).filter((i) => i.isActive !== false)

  const toggle = (id: string) => {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= STORY_PRODUCT_TAGS_MAX) return prev
      return [...prev, id]
    })
  }

  return (
    <BottomSheet
      visible={visible}
      onRequestClose={onRequestClose}
      title={t("Tag produk")}
      description={t("Maksimal {n} produk per story.", { n: STORY_PRODUCT_TAGS_MAX })}
      footer={
        <Button
          variant="primary"
          fullWidth
          onPress={() =>
            onDone(
              items
                .filter((i) => picked.includes(i.id))
                .map((i) => ({ productId: i.id, title: i.title || i.caption || "" })),
            )
          }
          accessibilityLabel={t("Selesai memilih produk")}
        >
          {t("Selesai")}
        </Button>
      }
    >
      <View className="gap-2 pb-2">
        {query.loading && !query.data ? (
          <View className="gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="w-full" height={56} />
            ))}
          </View>
        ) : query.error && !query.data ? (
          <ErrorState title={t("Etalase belum bisa dimuat")} description={userMessage(query.error)} onRetry={query.reload} />
        ) : items.length === 0 ? (
          <EmptyState icon={ShoppingBag} title={t("Belum ada produk di etalase")} description={t("Tambahkan produk ke etalase dulu, lalu tag di story.")} compact />
        ) : (
          items.map((item) => {
            const on = picked.includes(item.id)
            const title = item.title || item.caption || t("Produk")
            return (
              <PressableScale
                key={item.id}
                onPress={() => toggle(item.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={title}
                className="flex-row items-center gap-3 rounded-md border border-border p-2"
              >
                <Picture
                  source={item.coverImageUrl ?? item.imageUrl ?? ""}
                  alt=""
                  width={48}
                  height={48}
                  radius="xs"
                />
                <View className="flex-1">
                  <Text variant="label" weight={600} numberOfLines={1}>{title}</Text>
                  {item.priceMin != null ? (
                    <Text variant="caption" tone="secondary" numberOfLines={1}>
                      {t("Mulai Rp {n}", { n: item.priceMin.toLocaleString("id-ID") })}
                    </Text>
                  ) : null}
                </View>
                {on ? <Icon icon={Check} size="sm" tone="active" /> : null}
              </PressableScale>
            )
          })
        )}
      </View>
    </BottomSheet>
  )
}
