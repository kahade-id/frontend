/**
 * Screen — Keamanan: perangkat aktif (sessions), log keamanan, log aktivitas.
 * SegmentedControl antar bagian; semua data di-refresh bersama (PullToRefresh).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { DeviceMobile, ShieldWarning, ChartLine } from "phosphor-react-native"

import { api } from "@/lib/api"
import type { DeviceSession } from "@/lib/api/sessions"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { ActivityLogItem } from "@/components/ui/activity-log-item"
import { Button } from "@/components/ui/button"
import { DeviceSessionListItem } from "@/components/ui/device-session-list-item"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
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

export default function SecurityScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [tab, setTab] = useState<TabKey>("devices")
  const [sessions, setSessions] = useState<DeviceSession[]>([])
  const [securityLog, setSecurityLog] = useState<Array<{ id: string; action: string; ip?: string; createdAt: string }>>([])
  const [activityLog, setActivityLog] = useState<Array<{ id: string; action: string; description?: string; createdAt: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState<DeviceSession | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, sec, act] = await Promise.all([
        api.sessions.listSessions(),
        api.sessions.getSecurityLog(),
        api.sessions.getActivityLog(),
      ])
      setSessions(s ?? [])
      setSecurityLog(sec ?? [])
      setActivityLog(act ?? [])
    } catch {
      setError("Gagal memuat data keamanan.")
    } finally {
      setLoading(false)
    }
  }, [])

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
      setSessions((prev) => prev.filter((s) => s.id !== confirmRevoke.id))
      toast.show({ title: "Sesi dicabut", tone: "success", duration: 3000 })
      setConfirmRevoke(null)
    } catch {
      toast.show({ title: "Gagal mencabut sesi", tone: "danger" })
    } finally {
      setRevokingId(null)
    }
  }, [confirmRevoke, toast.show])

  const handleLogoutOthers = useCallback(async () => {
    try {
      await api.sessions.deleteOtherSessions()
      await fetchAll()
      toast.show({ title: "Semua perangkat lain dicabut", tone: "success", duration: 3000 })
    } catch {
      toast.show({ title: "Gagal mencabut sesi lain", tone: "danger" })
    }
  }, [toast.show, fetchAll])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Keamanan" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
          <SegmentedControl items={TABS} value={tab} onChange={(v) => setTab(v as TabKey)} />

          {error ? (
            <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
          ) : loading ? (
            <EmptyState icon={ShieldWarning} title="Memuat data keamanan…" />
          ) : tab === "devices" ? (
            <>
              <SectionHeader title="Perangkat aktif" />
              {sessions.length === 0 ? (
                <EmptyState icon={DeviceMobile} title="Tidak ada sesi aktif" />
              ) : (
                sessions.map((s, i) => (
                  <DeviceSessionListItem
                    key={s.id}
                    deviceName={s.deviceName}
                    client={s.platform ? `${s.platform}${s.browser ? ` · ${s.browser}` : ""}` : undefined}
                    location={s.location}
                    ip={s.ip}
                    lastActiveAt={s.lastActiveAt ? formatDateTime(s.lastActiveAt) : undefined}
                    current={s.current}
                    suspicious={s.trusted === false}
                    onRevoke={s.current ? undefined : () => setConfirmRevoke(s)}
                    revoking={revokingId === s.id}
                    divider={i < sessions.length - 1}
                  />
                ))
              )}
              <Button variant="ghost" onPress={() => void handleLogoutOthers()} disabled={sessions.length <= 1}>
                Keluar dari perangkat lain
              </Button>
            </>
          ) : tab === "security" ? (
            <>
              <SectionHeader title="Log keamanan" />
              {securityLog.length === 0 ? (
                <EmptyState icon={ShieldWarning} title="Belum ada aktivitas keamanan" />
              ) : (
                securityLog.map((l, i) => (
                  <SecurityLogItem
                    key={l.id}
                    title={l.action}
                    ip={l.ip}
                    timestamp={formatDateTime(l.createdAt)}
                    divider={i < securityLog.length - 1}
                  />
                ))
              )}
            </>
          ) : (
            <>
              <SectionHeader title="Log aktivitas" />
              {activityLog.length === 0 ? (
                <EmptyState icon={ChartLine} title="Belum ada aktivitas" />
              ) : (
                activityLog.map((l, i) => (
                  <ActivityLogItem
                    key={l.id}
                    title={l.action}
                    description={l.description}
                    timestamp={formatDateTime(l.createdAt)}
                    divider={i < activityLog.length - 1}
                  />
                ))
              )}
            </>
          )}
        </View>
      </PullToRefresh>

      <Dialog
        title="Cabut sesi ini?"
        description="Perangkat akan diminta masuk kembali."
        visible={!!confirmRevoke}
        destructive
        loading={revokingId === confirmRevoke?.id}
        confirmLabel="Cabut"
        cancelLabel="Batal"
        onConfirm={() => void handleRevoke()}
        onCancel={() => setConfirmRevoke(null)}
        onRequestClose={() => setConfirmRevoke(null)}
      />
    </Screen>
  )
}
