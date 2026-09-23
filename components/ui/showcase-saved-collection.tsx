import { useEffect } from "react"
import { View } from "react-native"
import { router } from "expo-router"
import { api, userMessage } from "@/lib/api"
import { getShowcaseDetail } from "@/lib/api/showcase"
import { getSessionRevision } from "@/lib/api/session"
import { useHasSession, useSessionRevision } from "@/lib/guest-gate"
import { loadShowcaseBookmarks, toggleShowcaseSaved, useShowcaseSavedIds } from "@/lib/showcase-social-prefs"
import { useApiQuery } from "@/lib/use-api-query"
import { translate } from "@/lib/i18n/translate"
import { ROUTES } from "@/lib/routes"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { ErrorState } from "@/components/ui/error-state"
import { useToast } from "@/components/ui/toast"

export function ShowcaseSavedCollection() {
  const ids = useShowcaseSavedIds()
  const session = useHasSession()
  const revision = useSessionRevision()
  const toast = useToast()
  useEffect(() => {
    if (session) void api.users.getMeCached().then(async (me) => {
      if (revision === getSessionRevision()) await loadShowcaseBookmarks(me.id)
    }).catch((error) => toast.show({ title: "Gagal memuat karya tersimpan", description: userMessage(error), tone: "danger" }))
  }, [session, revision, toast])
  const query = useApiQuery(`showcase-saved:${revision}:${ids.join(",")}`, async (signal) => {
    return Promise.all(ids.map(async (id) => {
      try { return { id, item: await getShowcaseDetail(id, signal) } }
      catch { return { id, item: null } }
    }))
  }, session && ids.length > 0, { retry: 0, useCache: false })
  return <View className="gap-3 pb-5">
    <Text variant="h3">Karya tersimpan</Text>
    <Text variant="caption" tone="secondary">Maksimal 25 karya di perangkat ini. Simpanan dihapus saat keluar akun.</Text>
    {query.loading && ids.length > 0 ? <Text>Memuat karya tersimpan…</Text> : null}
    {query.error ? <ErrorState compact description={query.error} onRetry={() => void query.reload()} /> : null}
    {ids.length === 0 ? <Text tone="secondary">Belum ada karya tersimpan</Text> : null}
    {ids.length > 0 ? query.data?.map(({ id, item }) => <View key={id} className="gap-2 rounded-md border border-border p-3">
      <Button variant="ghost" onPress={() => router.push(ROUTES.showcaseDetail(id))}>
        {item?.title || translate("Karya tidak tersedia — coba buka lagi")}
      </Button>
      <Button variant="ghost" onPress={() => toggleShowcaseSaved(id)}>Hapus dari tersimpan</Button>
    </View>) : null}
  </View>
}
