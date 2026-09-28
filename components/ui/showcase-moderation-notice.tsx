/**
 * Kahade — label status moderasi etalase (C12, batch 139).
 *
 * Menampilkan status moderasi di layar Kelola Etalase bila backend mengirim
 * field moderasi (`resolveShowcaseModeration`): "Dalam peninjauan" +
 * waktu, atau "Ditolak" + alasan (TEKS BIASA, tanpa render HTML) + waktu +
 * tombol [Edit karya] [Ajukan ulang]. Bila backend belum mengirim field
 * (kontrak saat ini), komponen me-render null — graceful, bukan error.
 */
import { View } from "react-native"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"
import { Clock, WarningCircle, PencilSimple, ArrowClockwise } from "phosphor-react-native"
import {
  needsModerationAttention,
  type ShowcaseModerationInfo,
} from "@/lib/showcase-moderation"

export function ShowcaseModerationNotice({
  info,
  onEdit,
  onResubmit,
}: {
  info: ShowcaseModerationInfo
  /** Buka editor untuk item yang ditolak. */
  onEdit?: () => void
  /** Ajukan ulang peninjauan untuk item yang ditolak. */
  onResubmit?: () => void
}) {
  // i18n: label mengikuti bahasa aktif.
  useLanguage()
  if (!needsModerationAttention(info)) return null

  const pending = info.status === "pending"
  const title = pending ? translate("Dalam peninjauan") : translate("Ditolak moderator")
  const icon = pending ? Clock : WarningCircle

  return (
    <Card className="gap-2 p-3">
      <View className="flex-row items-center gap-2">
        <Icon icon={icon} size="md" tone={pending ? "warning" : "danger"} />
        <Text variant="body" weight={700}>
          {title}
        </Text>
      </View>
      {info.reviewedAt ? (
        <Text variant="caption" tone="secondary">
          {translate("Diperbarui {x}", { x: info.reviewedAt })}
        </Text>
      ) : null}
      {/* Alasan dari server = TEKS BIASA — tidak pernah dirender sebagai HTML. */}
      {info.reason ? (
        <Text variant="caption" tone="secondary">
          {info.reason}
        </Text>
      ) : null}
      {!pending ? (
        <View className="flex-row gap-2 pt-1">
          {onEdit ? (
            <Button variant="secondary" size="sm" onPress={onEdit} leftIcon={PencilSimple} className="flex-1">
              {translate("Edit karya")}
            </Button>
          ) : null}
          {onResubmit ? (
            <Button variant="primary" size="sm" onPress={onResubmit} leftIcon={ArrowClockwise} className="flex-1">
              {translate("Ajukan ulang")}
            </Button>
          ) : null}
        </View>
      ) : null}
    </Card>
  )
}
