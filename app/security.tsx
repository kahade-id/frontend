import { ListLoading } from "@/components/ui/paginated-list"
/**
 * Screen — Keamanan: perangkat aktif (sessions), log keamanan, log aktivitas.
 *
 * Endpoint (lib/api/sessions.ts):
 *   GET    /v1/sessions?page&limit               daftar sesi
 *   DELETE /v1/sessions/{id} · /v1/sessions/others
 *   PATCH  /v1/users/me/devices/{id}/trust|untrust  perangkat tepercaya (lewati 2FA)
 *   GET    /v1/users/me/security-log?page&limit&action
 *   GET    /v1/users/me/activity-log?page&limit
 *
 * Keputusan non-obvious:
 *   - `trusted === false` BUKAN "mencurigakan": itu status default semua
 *     perangkat yang belum ditandai tepercaya. Versi lama menandai hampir
 *     semua sesi "Perlu ditinjau". Sekarang `trusted` dirender sebagai badge
 *     + aksi Percayai/Cabut kepercayaan; `suspicious` tidak dikirim karena
 *     API tidak menyediakan sinyalnya.
 *   - Tiga daftar dipaginasi terpisah (`page` per tab) dengan <LoadMore>;
 *     PullToRefresh mereset ketiganya ke halaman 1.
 *   - Tab "Keluar dari perangkat lain" memakai Dialog konfirmasi: mencabut
 *     semua sesi lain berdampak ke perangkat yang tidak terlihat di layar.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ChartLine, DeviceMobile, ShieldWarning } from "phosphor-react-native"

import { api, userMessage } from "@/lib/api"
import type { ActivityLogEntry, DeviceSession, SecurityLogEntry } from "@/lib/api/sessions"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { ActivityLogItem } from "@/components/ui/activity-log-item"
import { Button } from "@/components/ui/button"
import { DeviceSessionListItem } from "@/components/ui/device-session-list-item"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { LoadMore, type LoadMoreStatus } from "@/components/ui/load-more"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { SecurityLogItem } from "@/components/ui/security-log-item"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { useToast } from "@/components/ui/toast"

type TabKey = "devices" | "security" | "activity"

const TABS = [
  { value: "devices", label: "Perangkat" },
  { value: "security", label: "Keamanan" },
  { value: "activity", label: "Aktivitas" },
] as const satisfies ReadonlyArray<{ value: TabKey; label: string }>

const PAGE_SIZE = 20

/** State satu daftar terpaginasi (page berikutnya + status footer). */
type PagedList<T> = { items: T[]; page: number; more: LoadMoreStatus }

function emptyList<T>(): PagedList<T> {
  return { items: [], page: 1, more: "idle" }
}

/** Halaman < PAGE_SIZE berarti sudah habis (API list tanpa meta). */
function appendPage<T extends { id: string }>(
  prev: PagedList<T>,
  page: number,
  data: T[],
): PagedList<T> {
  const seen = new Set(page === 1 ? [] : prev.items.map((i) => i.id))
  const fresh = data.filter((i) => !seen.has(i.id))
  return {
    items: page === 1 ? data : [...prev.items, ...fresh],
    page,
    more: data.length < PAGE_SIZE ? "end" : "idle",
  }
}

export default function SecurityScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [tab, setTab] = useState<TabKey>("devices")
  const [sessions, setSessions] = useState<PagedList<DeviceSession>>(emptyList)
  const [securityLog, setSecurityLog] = useState<PagedList<SecurityLogEntry>>(emptyList)
  const [activityLog, setActivityLog] = useState<PagedList<ActivityLogEntry>>(emptyList)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState<DeviceSession | null>(null)
  const [confirmOthers, setConfirmOthers] = useState(false)
  const [revokingOthers, setRevokingOthers] = useState(false)
  const [trustingId, setTrustingId] = useState<string | null>(null)

  const loadSessions = useCallback(async (page: number) => {
    setSessions((p) => (page > 1 ? { ...p, more: "loading" } : p))
    try {
      const data = (await api.sessions.listSessions({ page, limit: PAGE_SIZE })) ?? []
      setSessions((p) => appendPage(p, page, data))
    } catch (err) {
      setSessions((p) => ({ ...p, more: "error" }))
      throw err
    }
  }, [])

  const loadSecurity = useCallback(async (page: number) => {
    setSecurityLog((p) => (page > 1 ? { ...p, more: "loading" } : p))
    try {
      const data = (await api.sessions.getSecurityLog({ page, limit: PAGE_SIZE })) ?? []
      setSecurityLog((p) => appendPage(p, page, data))
    } catch (err) {
      setSecurityLog((p) => ({ ...p, more: "error" }))
      throw err
    }
  }, [])

  const loadActivity = useCallback(async (page: number) => {
    setActivityLog((p) => (page > 1 ? { ...p, more: "loading" } : p))
    try {
      const data = (await api.sessions.getActivityLog({ page, limit: PAGE_SIZE })) ?? []
      setActivityLog((p) => appendPage(p, page, data))
    } catch (err) {
      setActivityLog((p) => ({ ...p, more: "error" }))
      throw err
    }
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Sesi wajib berhasil; log bersifat sekunder (gagal → daftar kosong,
      // pengguna masih bisa mengelola perangkat).
      await Promise.all([
        loadSessions(1),
        loadSecurity(1).catch(() => undefined),
        loadActivity(1).catch(() => undefined),
      ])
    } catch (err) {
      setError(userMessage(err))
    } finally {
      setLoading(false)
    }
  }, [loadSessions, loadSecurity, loadActivity])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }, [fetchAll])

  const handleRevoke = useCallback(async () => {
    if (!confirmRevoke) return
    setRevokingId(confirmRevoke.id)
    try {
      await api.sessions.deleteSession(confirmRevoke.id)
      setSessions((p) => ({ ...p, items: p.items.filter((s) => s.id !== confirmRevoke.id) }))
      toast.show({ title: "Sesi dicabut", tone: "success" })
      setConfirmRevoke(null)
    } catch (err: unknown) {
      toast.show({ title: "Gagal mencabut sesi", description: userMessage(err), tone: "danger" })
    } finally {
      setRevokingId(null)
    }
  }, [confirmRevoke, toast.show])

  const handleLogoutOthers = useCallback(async () => {
    setRevokingOthers(true)
    try {
      await api.sessions.deleteOtherSessions()
      setConfirmOthers(false)
      await loadSessions(1).catch(() => undefined)
      toast.show({ title: "Semua perangkat lain dicabut", tone: "success" })
    } catch (err: unknown) {
      toast.show({
        title: "Gagal mencabut sesi lain",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setRevokingOthers(false)
    }
  }, [loadSessions, toast.show])

  const handleToggleTrust = useCallback(
    async (session: DeviceSession, next: boolean) => {
      setTrustingId(session.id)
      try {
        if (next) await api.sessions.trustDevice(session.id)
        else await api.sessions.untrustDevice(session.id)
        setSessions((p) => ({
          ...p,
          items: p.items.map((s) => (s.id === session.id ? { ...s, trusted: next } : s)),
        }))
        toast.show({
          title: next ? "Perangkat ditandai tepercaya" : "Kepercayaan perangkat dicabut",
          description: next ? "Login dari perangkat ini tidak lagi meminta kode 2FA." : undefined,
          tone: "success",
        })
      } catch (err: unknown) {
        toast.show({
          title: "Gagal memperbarui perangkat",
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        setTrustingId(null)
      }
    },
    [toast.show],
  )

  const otherSessions = sessions.items.filter((s) => !s.current).length

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Keamanan" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        <View accessible={false} className="gap-4" style={{ paddingTop: tokens.space[3] }}>
          <SegmentedControl items={TABS} value={tab} onChange={(v) => setTab(v as TabKey)} />

          {error ? (
            <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
          ) : loading ? (
            <ListLoading />
          ) : tab === "devices" ? (
            <>
              <SectionHeader title="Perangkat aktif" />
              {sessions.items.length === 0 ? (
                <EmptyState icon={DeviceMobile} title="Tidak ada sesi aktif" />
              ) : (
                sessions.items.map((s, i) => (
                  <DeviceSessionListItem
                    key={s.id}
                    deviceName={s.deviceName}
                    client={
                      s.platform ? `${s.platform}${s.browser ? ` · ${s.browser}` : ""}` : undefined
                    }
                    location={s.location}
                    ip={s.ip}
                    lastActiveAt={s.lastActiveAt ? formatDateTime(s.lastActiveAt) : undefined}
                    lastActiveLabel={s.current ? "Aktif sekarang" : undefined}
                    current={s.current}
                    trusted={s.trusted}
                    onToggleTrust={(next) => void handleToggleTrust(s, next)}
                    togglingTrust={trustingId === s.id}
                    onRevoke={s.current ? undefined : () => setConfirmRevoke(s)}
                    revoking={revokingId === s.id}
                    divider={i < sessions.items.length - 1}
                  />
                ))
              )}
              <LoadMore
                status={sessions.more}
                onLoadMore={() => void loadSessions(sessions.page + 1).catch(() => undefined)}
                hideEnd
              />
              <Button accessibilityHint="Ketuk untuk berinteraksi"
                variant="ghost"
                onPress={() => setConfirmOthers(true)}
                disabled={otherSessions === 0}
              >
                Keluar dari perangkat lain
              </Button>
            </>
          ) : tab === "security" ? (
            <>
              <SectionHeader title="Log keamanan" />
              {securityLog.items.length === 0 ? (
                <EmptyState icon={ShieldWarning} title="Belum ada aktivitas keamanan" />
              ) : (
                securityLog.items.map((l, i) => (
                  <SecurityLogItem
                    key={l.id}
                    title={l.action}
                    ip={l.ip}
                    timestamp={formatDateTime(l.createdAt)}
                    divider={i < securityLog.items.length - 1}
                  />
                ))
              )}
              <LoadMore
                status={securityLog.more}
                onLoadMore={() => void loadSecurity(securityLog.page + 1).catch(() => undefined)}
                hideEnd
              />
            </>
          ) : (
            <>
              <SectionHeader title="Log aktivitas" />
              {activityLog.items.length === 0 ? (
                <EmptyState icon={ChartLine} title="Belum ada aktivitas" />
              ) : (
                activityLog.items.map((l, i) => (
                  <ActivityLogItem
                    key={l.id}
                    title={l.action}
                    description={l.description}
                    timestamp={formatDateTime(l.createdAt)}
                    divider={i < activityLog.items.length - 1}
                  />
                ))
              )}
              <LoadMore
                status={activityLog.more}
                onLoadMore={() => void loadActivity(activityLog.page + 1).catch(() => undefined)}
                hideEnd
              />
            </>
          )}
        </View>
      </PullToRefresh>

      <Dialog
        title="Cabut sesi ini?"
        description={`${confirmRevoke?.deviceName ?? "Perangkat"} akan diminta masuk kembali.`}
        visible={!!confirmRevoke}
        destructive
        loading={revokingId === confirmRevoke?.id}
        confirmLabel="Cabut"
        cancelLabel="Batal"
        onConfirm={() => void handleRevoke()}
        onCancel={() => setConfirmRevoke(null)}
        onRequestClose={() => setConfirmRevoke(null)}
      />

      <Dialog
        title="Keluar dari semua perangkat lain?"
        description={`${otherSessions} sesi lain akan dicabut dan harus masuk kembali. Perangkat ini tetap masuk.`}
        visible={confirmOthers}
        destructive
        loading={revokingOthers}
        confirmLabel="Keluar dari semua"
        cancelLabel="Batal"
        onConfirm={() => void handleLogoutOthers()}
        onCancel={() => setConfirmOthers(false)}
        onRequestClose={() => setConfirmOthers(false)}
      />
    </Screen>
  )
}