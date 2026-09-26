/**
 * Kahade — Admin: Sistem.
 *
 * Bagian:
 * (a) Config sistem — daftar key/value + ubah (khusus SUPER_ADMIN; perubahan
 *     finansial masuk antrean persetujuan dan menunjukkan status pending).
 * (b) Persetujuan config pending — setujui/tolak.
 * (c) Broadcast — form judul + pesan + target + kirim (dengan konfirmasi).
 * (d) Webhook dead-letter — daftar + retry/resolve.
 * (e) Audit log admin — daftar read-only.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Alert, FlatList, View } from "react-native"
import { Bell, Scroll } from "phosphor-react-native"

import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { Button } from "@/components/ui/button"
import { Card, CardBody } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Input } from "@/components/ui/input"
import { TextArea } from "@/components/ui/text-area"
import { Select, SelectOptionList } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { EmptyState } from "@/components/ui/empty-state"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/components/ui/toast"
import { translate } from "@/lib/i18n/translate"
import { userMessage } from "@/lib/api"
import {
  listConfigs,
  updateConfig,
  listPendingConfigChanges,
  approveConfigChange,
  rejectConfigChange,
  sendBroadcast,
  listAuditLogs,
  listWebhookLogs,
  retryWebhook,
  resolveWebhook,
  type AdminSystemConfig,
  type PendingConfigChange,
  type AdminAuditLogItem,
  type AdminWebhookLogItem,
  type BroadcastAudience,
  type BroadcastChannel,
} from "@/lib/api/admin/system"

const PAGE_LIMIT = 20

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface PaginatedResult<T> {
  data: T[]
  total?: number
  meta?: { total: number }
}

function useAdminList<T>(
  loader: (page: number, limit: number) => Promise<PaginatedResult<T>>,
  resetKey: unknown,
) {
  const [data, setData] = useState<T[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (pageToLoad: number, mode: "initial" | "more" | "refresh") => {
      if (mode === "initial") setLoading(true)
      else if (mode === "more") setLoadingMore(true)
      setError(null)
      try {
        const res = await loader(pageToLoad, PAGE_LIMIT)
        const total = res.total ?? res.meta?.total ?? res.data.length
        setData((prev) => (mode === "more" ? [...prev, ...res.data] : res.data))
        setPage(pageToLoad)
        setHasMore(res.data.length >= PAGE_LIMIT && pageToLoad * PAGE_LIMIT < total)
      } catch (e) {
        setError(userMessage(e))
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [loader],
  )

  useEffect(() => {
    void load(1, "initial")
  }, [load, resetKey])

  return {
    data,
    loading,
    loadingMore,
    error,
    hasMore,
    refresh: () => load(1, "refresh"),
    loadMore: () => {
      if (!loadingMore && hasMore) void load(page + 1, "more")
    },
  }
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text variant="h3" accessibilityRole="header">
      {children}
    </Text>
  )
}

function ListState({
  loading,
  error,
  empty,
  onRetry,
  emptyTitle,
  emptyDescription,
  loadingLabel,
}: {
  loading: boolean
  error: string | null
  empty: boolean
  onRetry: () => void
  emptyTitle: string
  emptyDescription: string
  loadingLabel: string
}) {
  if (loading) {
    return (
      <View className="items-center py-6">
        <Spinner accessibilityLabel={loadingLabel} />
      </View>
    )
  }
  if (error) {
    return (
      <Card>
        <CardBody className="gap-3">
          <Text tone="danger" accessibilityRole="alert">
            {error}
          </Text>
          <Button variant="secondary" onPress={onRetry}>
            {translate("Coba lagi")}
          </Button>
        </CardBody>
      </Card>
    )
  }
  if (empty) {
    return (
      <EmptyState
        icon={Scroll}
        title={emptyTitle}
        description={emptyDescription}
        compact
      />
    )
  }
  return null
}

/* ------------------------------------------------------------------ */
/* (a) Config sistem                                                    */
/* ------------------------------------------------------------------ */

function ConfigSection({ reloadSignal }: { reloadSignal: number }) {
  const [configs, setConfigs] = useState<AdminSystemConfig[]>([])
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminSystemConfig | null>(null)
  const [value, setValue] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, pending] = await Promise.all([listConfigs(), listPendingConfigChanges()])
      setConfigs(list)
      setPendingKeys(new Set(pending.map((p) => p.key)))
    } catch (e) {
      setError(userMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, reloadSignal])

  function openEdit(c: AdminSystemConfig) {
    setEditing(c)
    setValue(c.value)
    setDescription(c.description ?? "")
    setFormError(null)
  }

  async function handleSave() {
    if (!editing) return
    setFormError(null)
    if (!value.trim()) {
      setFormError(translate("Nilai config wajib diisi."))
      return
    }
    setSaving(true)
    try {
      const res = await updateConfig(
        editing.key,
        value.trim(),
        description.trim() ? description.trim() : undefined,
      )
      setEditing(null)
      if ("proposedValue" in res) {
        // Perubahan finansial: masuk antrean persetujuan.
        toast.show({
          tone: "warning",
          title: translate("Menunggu persetujuan"),
          description: translate(
            "Perubahan config finansial memerlukan persetujuan admin lain sebelum berlaku.",
          ),
        })
      } else {
        toast.show({ tone: "success", title: translate("Config diperbarui.") })
      }
      void load()
    } catch (e) {
      setFormError(userMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className="gap-3">
      <SectionTitle>{translate("Config sistem")}</SectionTitle>
      <Text variant="body" tone="secondary">
        {translate(
          "Perubahan config finansial (fee/komisi) tidak langsung berlaku — menunggu persetujuan admin lain.",
        )}
      </Text>
      {loading ? (
        <View className="items-center py-6">
          <Spinner accessibilityLabel={translate("Memuat config")} />
        </View>
      ) : error ? (
        <Card>
          <CardBody className="gap-3">
            <Text tone="danger" accessibilityRole="alert">
              {error}
            </Text>
            <Button variant="secondary" onPress={() => void load()}>
              {translate("Coba lagi")}
            </Button>
          </CardBody>
        </Card>
      ) : (
        configs.map((c) => (
          <Card key={c.id}>
            <CardBody className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text variant="body" className="font-medium flex-1">
                  {c.key}
                </Text>
                {pendingKeys.has(c.key) ? (
                  <Badge tone="warning" dot>
                    {translate("Menunggu persetujuan")}
                  </Badge>
                ) : null}
              </View>
              <Text variant="body" tone="secondary" selectable>
                {c.value}
              </Text>
              {c.description ? (
                <Text variant="caption" tone="tertiary">
                  {c.description}
                </Text>
              ) : null}
              <Text variant="caption" tone="tertiary">
                {c.dataType}
                {c.updatedAt ? ` · ${formatDateTime(c.updatedAt)}` : ""}
              </Text>
              <Button variant="secondary" size="sm" onPress={() => openEdit(c)}>
                {translate("Ubah")}
              </Button>
            </CardBody>
          </Card>
        ))
      )}

      <BottomSheet
        visible={editing != null}
        onRequestClose={() => setEditing(null)}
        title={editing ? translate("Ubah config: {x}", { x: editing.key }) : ""}
        avoidKeyboard
      >
        <View className="gap-3">
          {formError ? (
            <Text tone="danger" accessibilityRole="alert">
              {formError}
            </Text>
          ) : null}
          <Input
            label={translate("Nilai")}
            value={value}
            onChangeText={setValue}
            multiline={value.length > 60}
            required
          />
          <Input
            label={translate("Deskripsi (opsional)")}
            value={description}
            onChangeText={setDescription}
            maxLength={500}
          />
          <Button loading={saving} onPress={handleSave}>
            {translate("Simpan")}
          </Button>
        </View>
      </BottomSheet>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/* (b) Persetujuan config pending                                      */
/* ------------------------------------------------------------------ */

function PendingApprovalsSection({ reloadSignal, onChanged }: { reloadSignal: number; onChanged: () => void }) {
  const [items, setItems] = useState<PendingConfigChange[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await listPendingConfigChanges())
    } catch (e) {
      setError(userMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, reloadSignal])

  async function handleApprove(item: PendingConfigChange) {
    setBusyKey(item.key)
    try {
      await approveConfigChange(item.key)
      toast.show({ tone: "success", title: translate("Perubahan disetujui dan diterapkan.") })
      void load()
      onChanged()
    } catch (e) {
      Alert.alert(translate("Gagal"), userMessage(e))
    } finally {
      setBusyKey(null)
    }
  }

  function confirmReject(item: PendingConfigChange) {
    Alert.alert(
      translate("Tolak perubahan?"),
      translate("Perubahan config {x} akan dibatalkan.", { x: item.key }),
      [
        { text: translate("Batal"), style: "cancel" },
        {
          text: translate("Tolak"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusyKey(item.key)
              try {
                await rejectConfigChange(item.key)
                toast.show({ tone: "success", title: translate("Perubahan ditolak.") })
                void load()
                onChanged()
              } catch (e) {
                Alert.alert(translate("Gagal"), userMessage(e))
              } finally {
                setBusyKey(null)
              }
            })()
          },
        },
      ],
    )
  }

  if (loading || error || items.length === 0) {
    return (
      <View className="gap-3">
        <SectionTitle>{translate("Persetujuan config")}</SectionTitle>
        <ListState
          loading={loading}
          error={error}
          empty={items.length === 0}
          onRetry={() => void load()}
          emptyTitle={translate("Tidak ada yang menunggu")}
          emptyDescription={translate("Tidak ada perubahan config finansial yang menunggu persetujuan.")}
          loadingLabel={translate("Memuat persetujuan")}
        />
      </View>
    )
  }

  return (
    <View className="gap-3">
      <SectionTitle>{translate("Persetujuan config")}</SectionTitle>
      {items.map((p) => (
        <Card key={p.key}>
          <CardBody className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text variant="body" className="font-medium flex-1">
                {p.key}
              </Text>
              <Badge tone="warning" dot>
                {translate("Pending")}
              </Badge>
            </View>
            <Text variant="caption" tone="tertiary">
              {translate("Saat ini")}: {p.currentValue ?? "-"}
            </Text>
            <Text variant="body" selectable>
              {translate("Usulan")}: {p.proposedValue}
            </Text>
            <Text variant="caption" tone="tertiary">
              {formatDateTime(p.proposedAt)}
            </Text>
            <View className="flex-row gap-2">
              <Button
                size="sm"
                loading={busyKey === p.key}
                onPress={() => void handleApprove(p)}
              >
                {translate("Setujui")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onPress={() => confirmReject(p)}
              >
                {translate("Tolak")}
              </Button>
            </View>
          </CardBody>
        </Card>
      ))}
    </View>
  )
}

/* ------------------------------------------------------------------ */
/* (c) Broadcast                                                        */
/* ------------------------------------------------------------------ */

const BROADCAST_AUDIENCES: { value: BroadcastAudience; label: string }[] = [
  { value: "all", label: "Semua pengguna" },
  { value: "active", label: "Pengguna aktif" },
  { value: "kahade_plus", label: "Kahade Plus" },
  { value: "verified", label: "Terverifikasi" },
]

function BroadcastSection() {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [inApp, setInApp] = useState(true)
  const [push, setPush] = useState(true)
  const [audience, setAudience] = useState<BroadcastAudience>("all")
  const [audienceSheetOpen, setAudienceSheetOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const toast = useToast()

  function confirmSend() {
    setFormError(null)
    if (title.trim().length < 3 || body.trim().length < 3) {
      setFormError(translate("Judul dan pesan minimal 3 karakter."))
      return
    }
    const channels: BroadcastChannel[] = []
    if (inApp) channels.push("in_app")
    if (push) channels.push("push")
    if (channels.length === 0) {
      setFormError(translate("Pilih minimal satu kanal pengiriman."))
      return
    }
    const audienceLabel =
      BROADCAST_AUDIENCES.find((a) => a.value === audience)?.label ?? audience
    Alert.alert(
      translate("Kirim broadcast?"),
      translate("Broadcast akan dikirim ke {x}. Lanjutkan?", { x: audienceLabel }),
      [
        { text: translate("Batal"), style: "cancel" },
        {
          text: translate("Kirim"),
          onPress: () => {
            void (async () => {
              setSending(true)
              try {
                const res = await sendBroadcast({
                  title: title.trim(),
                  body: body.trim(),
                  channels,
                  targetAudience: audience,
                })
                toast.show({
                  tone: "success",
                  title: translate("Broadcast terkirim."),
                  description: translate("{x} penerima.", { x: res.recipientCount }),
                })
                setTitle("")
                setBody("")
              } catch (e) {
                setFormError(userMessage(e))
              } finally {
                setSending(false)
              }
            })()
          },
        },
      ],
    )
  }

  return (
    <View className="gap-3">
      <SectionTitle>{translate("Broadcast")}</SectionTitle>
      <Card>
        <CardBody className="gap-3">
          {formError ? (
            <Text tone="danger" accessibilityRole="alert">
              {formError}
            </Text>
          ) : null}
          <Input
            label={translate("Judul")}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
            required
          />
          <TextArea
            label={translate("Pesan")}
            value={body}
            onChangeText={setBody}
            maxLength={500}
            rows={3}
            required
          />
          <Switch
            label={translate("Notifikasi dalam aplikasi")}
            value={inApp}
            onChange={setInApp}
          />
          <Switch label={translate("Push notification")} value={push} onChange={setPush} />
          <Select<BroadcastAudience>
            label={translate("Target audiens")}
            value={audience}
            options={BROADCAST_AUDIENCES.map((a) => ({ value: a.value, label: translate(a.label) }))}
            onPress={() => setAudienceSheetOpen(true)}
            open={audienceSheetOpen}
          />
          <Button loading={sending} onPress={confirmSend} leftIcon={Bell}>
            {translate("Kirim broadcast")}
          </Button>
        </CardBody>
      </Card>

      <BottomSheet
        visible={audienceSheetOpen}
        onRequestClose={() => setAudienceSheetOpen(false)}
        title={translate("Target audiens")}
        padding="none"
      >
        <SelectOptionList<BroadcastAudience>
          options={BROADCAST_AUDIENCES.map((a) => ({ value: a.value, label: translate(a.label) }))}
          value={audience}
          onSelect={(v) => {
            setAudience(v)
            setAudienceSheetOpen(false)
          }}
        />
      </BottomSheet>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/* (d) Webhook dead-letter                                              */
/* ------------------------------------------------------------------ */

function WebhookSection() {
  const webhooks = useAdminList<AdminWebhookLogItem>(
    useCallback(
      (page: number, limit: number) =>
        listWebhookLogs({ page, limit, deadLettered: "true" }),
      [],
    ),
    "webhooks",
  )
  const [busyId, setBusyId] = useState<string | null>(null)
  const [resolving, setResolving] = useState<AdminWebhookLogItem | null>(null)
  const [resolution, setResolution] = useState("")
  const [resolvingNow, setResolvingNow] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const toast = useToast()

  async function handleRetry(item: AdminWebhookLogItem) {
    setBusyId(item.id)
    try {
      await retryWebhook(item.id)
      toast.show({ tone: "success", title: translate("Webhook diantre ulang.") })
      void webhooks.refresh()
    } catch (e) {
      Alert.alert(translate("Gagal"), userMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  async function handleResolve() {
    if (!resolving) return
    setFormError(null)
    if (!resolution.trim()) {
      setFormError(translate("Catatan penyelesaian wajib diisi."))
      return
    }
    setResolvingNow(true)
    try {
      await resolveWebhook(resolving.id, resolution.trim())
      toast.show({ tone: "success", title: translate("Webhook diselesaikan.") })
      setResolving(null)
      setResolution("")
      void webhooks.refresh()
    } catch (e) {
      setFormError(userMessage(e))
    } finally {
      setResolvingNow(false)
    }
  }

  return (
    <View className="gap-3">
      <SectionTitle>{translate("Webhook dead-letter")}</SectionTitle>
      <Text variant="body" tone="secondary">
        {translate("Webhook yang gagal diproses dan masuk antrean dead-letter.")}
      </Text>
      <ListState
        loading={webhooks.loading}
        error={webhooks.error}
        empty={webhooks.data.length === 0}
        onRetry={() => void webhooks.refresh()}
        emptyTitle={translate("Tidak ada dead-letter")}
        emptyDescription={translate("Semua webhook berhasil diproses.")}
        loadingLabel={translate("Memuat webhook")}
      />
      {!webhooks.loading && !webhooks.error && webhooks.data.length > 0 ? (
        <FlatList
          data={webhooks.data}
          keyExtractor={(w) => w.id}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => (
            <Card>
              <CardBody className="gap-2">
                <View className="flex-row items-center justify-between">
                  <Text variant="body" className="font-medium flex-1">
                    {item.source}
                  </Text>
                  <Badge tone={item.isProcessed ? "success" : "danger"} dot>
                    {item.isProcessed ? translate("Diproses") : translate("Gagal")}
                  </Badge>
                </View>
                <Text variant="caption" tone="tertiary">
                  {item.event}
                  {item.transactionId ? ` · ${item.transactionId}` : ""}
                </Text>
                {item.errorMessage ? (
                  <Text variant="caption" tone="danger" numberOfLines={3}>
                    {item.errorMessage}
                  </Text>
                ) : null}
                <Text variant="caption" tone="tertiary">
                  {translate("Percobaan")}: {item.retryCount}
                  {item.deadLetteredAt ? ` · ${formatDateTime(item.deadLetteredAt)}` : ""}
                </Text>
                {!item.isProcessed ? (
                  <View className="flex-row gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={busyId === item.id}
                      onPress={() => void handleRetry(item)}
                    >
                      {translate("Coba lagi")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => {
                        setResolving(item)
                        setResolution("")
                        setFormError(null)
                      }}
                    >
                      {translate("Selesaikan")}
                    </Button>
                  </View>
                ) : null}
              </CardBody>
            </Card>
          )}
          onEndReached={webhooks.loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            webhooks.loadingMore ? (
              <View className="items-center py-4">
                <Spinner accessibilityLabel={translate("Memuat lagi")} />
              </View>
            ) : null
          }
        />
      ) : null}

      <BottomSheet
        visible={resolving != null}
        onRequestClose={() => setResolving(null)}
        title={translate("Selesaikan webhook")}
        avoidKeyboard
      >
        <View className="gap-3">
          <Text variant="body" tone="secondary">
            {translate(
              "Menandai webhook sebagai diselesaikan manual — retry otomatis dihentikan.",
            )}
          </Text>
          {formError ? (
            <Text tone="danger" accessibilityRole="alert">
              {formError}
            </Text>
          ) : null}
          <TextArea
            label={translate("Catatan penyelesaian")}
            value={resolution}
            onChangeText={setResolution}
            maxLength={500}
            rows={3}
            required
          />
          <Button loading={resolvingNow} onPress={handleResolve}>
            {translate("Tandai selesai")}
          </Button>
        </View>
      </BottomSheet>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/* (e) Audit log admin (read-only)                                      */
/* ------------------------------------------------------------------ */

function AuditLogSection() {
  const logs = useAdminList<AdminAuditLogItem>(
    useCallback((page: number, limit: number) => listAuditLogs({ page, limit }), []),
    "audit",
  )

  return (
    <View className="gap-3">
      <SectionTitle>{translate("Audit log admin")}</SectionTitle>
      <ListState
        loading={logs.loading}
        error={logs.error}
        empty={logs.data.length === 0}
        onRetry={() => void logs.refresh()}
        emptyTitle={translate("Belum ada log")}
        emptyDescription={translate("Belum ada aktivitas admin yang tercatat.")}
        loadingLabel={translate("Memuat audit log")}
      />
      {!logs.loading && !logs.error && logs.data.length > 0 ? (
        <FlatList
          data={logs.data}
          keyExtractor={(l) => l.id}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => (
            <Card>
              <CardBody className="gap-1">
                <Text variant="body" className="font-medium">
                  {item.action}
                </Text>
                <Text variant="caption" tone="secondary" numberOfLines={2}>
                  {item.description}
                </Text>
                <Text variant="caption" tone="tertiary">
                  {item.targetType ? `${item.targetType} · ` : ""}
                  {formatDateTime(item.createdAt)}
                </Text>
              </CardBody>
            </Card>
          )}
          onEndReached={logs.loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            logs.loadingMore ? (
              <View className="items-center py-4">
                <Spinner accessibilityLabel={translate("Memuat lagi")} />
              </View>
            ) : null
          }
        />
      ) : null}
    </View>
  )
}

/* ------------------------------------------------------------------ */
/* Layar utama                                                          */
/* ------------------------------------------------------------------ */

export default function AdminSystemScreen() {
  const [reloadSignal, setReloadSignal] = useState(0)
  const bump = useCallback(() => setReloadSignal((n) => n + 1), [])

  return (
    <Screen scroll padded>
      <View className="gap-6 pb-8">
        <View className="flex-row items-center gap-2">
          <Text variant="h3" accessibilityRole="header">
            {translate("Sistem")}
          </Text>
        </View>

        <ConfigSection reloadSignal={reloadSignal} />
        <PendingApprovalsSection reloadSignal={reloadSignal} onChanged={bump} />
        <BroadcastSection />
        <WebhookSection />
        <AuditLogSection />

        <View className="flex-row items-center justify-center gap-2 opacity-60">
          <Text variant="caption" tone="tertiary">
            {translate("Halaman ini hanya untuk SUPER_ADMIN.")}
          </Text>
        </View>
      </View>
    </Screen>
  )
}

