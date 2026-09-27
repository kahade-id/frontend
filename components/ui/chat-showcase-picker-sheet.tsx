/**
 * Kahade — sheet pilih etalase untuk dikirim sebagai kartu produk
 * (batch 43 FE-CHAT, 2026-09-28).
 *
 * GET /v1/users/me/showcase — daftar etalase milik sendiri; tap → parent
 * mengirim pesan PRODUCT_CARD (backend membekukan snapshot kartu).
 */
import { useEffect, useState } from "react"
import { Pressable, View } from "react-native"

import { getMyShowcase, type ShowcaseItem } from "@/lib/api/users"
import { isApiError, userMessage } from "@/lib/api"
import { logWarn } from "@/lib/telemetry"
import { formatRupiah } from "@/lib/format"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { EmptyState } from "@/components/ui/empty-state"
import { Picture } from "@/components/ui/picture"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { Storefront } from "phosphor-react-native"

export type ChatShowcasePickerSheetProps = {
  visible: boolean
  onRequestClose: () => void
  onPick: (item: ShowcaseItem) => void
}

function coverOf(item: ShowcaseItem): string | null {
  return item.coverImageUrl ?? item.images?.[0]?.imageUrl ?? item.imageUrl ?? null
}

export function ChatShowcasePickerSheet({
  visible,
  onRequestClose,
  onPick,
}: ChatShowcasePickerSheetProps) {
  const toast = useToast()
  const [items, setItems] = useState<ShowcaseItem[] | null>(null)

  useEffect(() => {
    if (!visible) return
    let alive = true
    setItems(null)
    getMyShowcase()
      .then((list) => {
        if (alive) setItems(list.filter((i) => i.isActive !== false))
      })
      .catch((err: unknown) => {
        logWarn("chat:showcase-picker", err)
        if (alive) {
          setItems([])
          toast.show({
            title: "Gagal memuat etalase",
            description: isApiError(err) ? userMessage(err) : undefined,
            tone: "danger",
          })
        }
      })
    return () => {
      alive = false
    }
  }, [visible, toast])

  return (
    <BottomSheet
      visible={visible}
      onRequestClose={onRequestClose}
      title="Kirim kartu produk"
      description="Pilih etalase — pembeli bisa langsung tap Beli."
    >
      {items === null ? (
        <View className="items-center py-8">
          <Spinner />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Storefront}
          title="Belum ada etalase aktif"
          description="Buat etalase dulu untuk membagikannya sebagai kartu produk."
        />
      ) : (
        <View className="gap-2">
          {items.map((item) => {
            const cover = coverOf(item)
            const min = item.priceMin ?? undefined
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  onPick(item)
                  onRequestClose()
                }}
                accessibilityRole="button"
                accessibilityLabel={`Kirim kartu produk: ${item.title ?? "Etalase"}`}
                className="flex-row items-center gap-3 rounded-md border border-border bg-surface p-2.5"
              >
                {cover ? (
                  <Picture source={cover} alt={item.title ?? ""} width={52} height={52} radius="sm" bordered={false} />
                ) : null}
                <View className="flex-1">
                  <Text variant="body" weight={600} tone="primary" numberOfLines={2}>
                    {item.title ?? "Etalase"}
                  </Text>
                  {min != null ? (
                    <Text variant="caption" weight={700} tone="accent">
                      {formatRupiah(min)}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            )
          })}
        </View>
      )}
    </BottomSheet>
  )
}
