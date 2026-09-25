/**
 * Kahade — <ShowcaseShareSheet> bottomsheet pilihan berbagi etalase.
 *
 * Menggantikan pemanggilan langsung `Share.share` bawaan OS yang tidak
 * memberi konteks kepada pengguna. Sheet ini menampilkan opsi:
 *  - Salin tautan
 *  - WhatsApp
 *  - Telegram
 *  - X (Twitter)
 *  - Lainnya (system share sheet)
 *
 * Dipakai di feed, detail, dan profil. Payload diambil dari `shareShowcaseById`
 * atau langsung dari item bila sudah ada.
 */
import { Linking, View } from "react-native"
import { ChatCircle, Copy, PaperPlaneTilt, ShareNetwork } from "phosphor-react-native"

import { copyToClipboard } from "@/lib/clipboard"
import { showcaseUrl } from "@/lib/deeplinks"
import { shareContent } from "@/lib/share"
import { showcasePriceLabel } from "@/lib/showcase-labels"
import type { ShowcaseSocialItem } from "@/lib/api/showcase"
import { translate } from "@/lib/i18n/translate"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

type Props = {
  visible: boolean
  item: ShowcaseSocialItem | null
  onClose: () => void
}

export function ShowcaseShareSheet({ visible, item, onClose }: Props) {
  const toast = useToast()
  if (!item) return null

  const shareUrl = item.shareUrl || showcaseUrl(item.id)
  const price = showcasePriceLabel(item)
  const priceSuffix = price ? ` — ${price}` : ""
  const title = item.title
  const message = `${title}${priceSuffix} — ${item.author.fullName ?? "@" + item.author.username}`

  const handleCopy = async () => {
    const ok = await copyToClipboard(shareUrl)
    toast.show({ title: ok ? "Tautan disalin" : "Gagal menyalin", tone: ok ? "success" : "danger", duration: 2500 })
    onClose()
  }

  const handleSystem = async () => {
    const outcome = await shareContent({ message, url: shareUrl, title })
    if (outcome === "copied") toast.show({ title: "Tautan disalin", tone: "success" })
    else if (outcome === "unavailable") toast.show({ title: "Share tidak tersedia", tone: "info" })
    onClose()
  }

  const openUrl = async (url: string) => {
    try {
      const can = await Linking.canOpenURL(url)
      if (can) await Linking.openURL(url)
      else throw new Error("cannot open")
    } catch {
      // fallback ke system share
      await handleSystem()
      return
    }
    onClose()
  }

  const waUrl = `https://wa.me/?text=${encodeURIComponent(`${message} ${shareUrl}`)}`
  const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(message)}`
  const xUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(message)}`

  return (
    <BottomSheet visible={visible} onRequestClose={onClose} title="Bagikan etalase" description={title} padding="none">
      <View className="gap-2 px-5 pb-2">
        <Text variant="caption" tone="secondary">
          {translate("Pilih tujuan berbagi. Tautan akan disalin jika aplikasi tidak tersedia.")}
        </Text>
        <View className="gap-2 pt-2">
          <Button variant="secondary" leftIcon={Copy} onPress={() => void handleCopy()} fullWidth>
            Salin tautan
          </Button>
          <Button variant="secondary" leftIcon={ChatCircle} onPress={() => void openUrl(waUrl)} fullWidth>
            WhatsApp
          </Button>
          <Button variant="secondary" leftIcon={PaperPlaneTilt} onPress={() => void openUrl(tgUrl)} fullWidth>
            Telegram
          </Button>
          <Button variant="secondary" leftIcon={ShareNetwork} onPress={() => void openUrl(xUrl)} fullWidth>
            X (Twitter)
          </Button>
          <Button variant="ghost" leftIcon={ShareNetwork} onPress={() => void handleSystem()} fullWidth>
            Lainnya (aplikasi lain)
          </Button>
        </View>
        <View className="gap-1 pt-2">
          <Text variant="caption" tone="secondary" className="text-center">
            {shareUrl}
          </Text>
        </View>
      </View>
    </BottomSheet>
  )
}
