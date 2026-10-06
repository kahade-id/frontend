import { WifiSlash } from "phosphor-react-native"

import { EmptyState } from "@/components/ui/empty-state"
import { translate } from "@/lib/i18n/translate"

/** Neutral placeholder for a data screen with no on-device copy of its data. */
export function OfflineEmptyState() {
  return (
    <EmptyState
      icon={WifiSlash}
      title={translate("Anda sedang offline")}
      description={translate(
        "Data ini belum tersimpan di perangkat. Sambungkan kembali untuk memuatnya.",
      )}
      animated={false}
    />
  )
}
