/**
 * Layar admin — Detail Pengguna (GET /v1/admin/users/:userId + sub-resource).
 *
 * Profil, wallet, sesi aktif (cabut per sesi), audit log, order ringkas, dan
 * tombol aksi destruktif — semuanya dengan konfirmasi; yang butuh alasan
 * memakai BottomSheet berisi Input.
 */
import { useCallback, useState } from "react"
import { Alert, View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { Devices, ListChecks, Receipt } from "phosphor-react-native"

import {
  adjustWallet,
  banUser,
  clearReviewFlag,
  forceLogout,
  getAdminUserDetail,
  getUserAuditLog,
  getUserOrders,
  getUserSessions,
  resetUserPassword,
  revokeUserSession,
  unbanUser,
  type AdminUserDetail,
  type AdminUserSession,
  type WalletAdjustType,
} from "@/lib/api/admin/users"
import { formatDateTime, formatRupiah } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"
import { useApiQuery } from "@/lib/use-api-query"

import { Badge } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { KeyValue } from "@/components/ui/key-value"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Text } from "@/components/ui/text"

const MAX_ADJUST_IDR = 50_000_000

function messageOf(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : translate("Terjadi kesalahan. Coba lagi.")
}

function KycBadge({ status }: { status: string | null }) {
  if (!status) return <Badge tone="neutral">—</Badge>
  const upper = status.toUpperCase()
  const tone =
    upper === "APPROVED" ? "success" : upper === "PENDING" ? "warning" : "danger"
  const label =
    upper === "APPROVED"
      ? translate("Terverifikasi")
      : upper === "PENDING"
        ? translate("Menunggu")
        : upper === "REJECTED"
          ? translate("Ditolak")
          : status
  return <Badge tone={tone}>{label}</Badge>
}

function SessionRow({
  session,
  onRevoke,
  revoking,
}: {
  session: AdminUserSession
  onRevoke: () => void
  revoking: boolean
}) {
  return (
    <View className="flex-row items-center justify-between gap-3 border-b border-border py-3 last:border-b-0">
      <View className="flex-1">
        <Text variant="body" weight={500} numberOfLines={2}>
          {session.deviceInfo?.trim() || translate("Perangkat tidak dikenal")}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {[
            session.ipAddress,
            translate("Aktif {x}", {
              x: formatDateTime(session.lastActiveAt),
            }),
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      <Button
        variant="secondary"
        size="sm"
        fullWidth={false}
        loading={revoking}
        onPress={onRevoke}
        accessibilityLabel={translate("Cabut sesi ini")}
      >
        {translate("Cabut")}
      </Button>
    </View>
  )
}

export default function AdminUserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>()
  const userId = Array.isArray(id) ? id[0] : (id ?? "")

  const detail = useApiQuery(`admin-user:${userId}`, () =>
    getAdminUserDetail(userId),
  )
  const sessions = useApiQuery(`admin-user-sessions:${userId}`, () =>
    getUserSessions(userId, { limit: 20 }),
  )
  const audit = useApiQuery(`admin-user-audit:${userId}`, () =>
    getUserAuditLog(userId, { limit: 10 }),
  )
  const orders = useApiQuery(`admin-user-orders:${userId}`, () =>
    getUserOrders(userId, { limit: 10 }),
  )

  const [acting, setActing] = useState<string | null>(null)
  const [banSheetOpen, setBanSheetOpen] = useState(false)
  const [banReason, setBanReason] = useState("")
  const [adjustSheetOpen, setAdjustSheetOpen] = useState(false)
  const [adjustType, setAdjustType] = useState<WalletAdjustType>("CREDIT")
  const [adjustAmount, setAdjustAmount] = useState("")
  const [adjustReason, setAdjustReason] = useState("")
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null)

  const user: AdminUserDetail | null = detail.data

  const refreshAll = useCallback(async () => {
    await Promise.all([
      detail.refresh(),
      sessions.refresh(),
      audit.refresh(),
      orders.refresh(),
    ])
  }, [detail, sessions, audit, orders])

  const runAction = useCallback(
    async (label: string, fn: () => Promise<unknown>, doneMessage?: string) => {
      setActing(label)
      try {
        await fn()
        await refreshAll()
        if (doneMessage) Alert.alert(translate("Berhasil"), doneMessage)
      } catch (error) {
        Alert.alert(translate("Gagal"), messageOf(error))
      } finally {
        setActing(null)
      }
    },
    [refreshAll],
  )

  const confirmDestructive = useCallback(
    (
      title: string,
      message: string,
      confirmLabel: string,
      onConfirm: () => void,
    ) => {
      Alert.alert(title, message, [
        { text: translate("Batal"), style: "cancel" },
        { text: confirmLabel, style: "destructive", onPress: onConfirm },
      ])
    },
    [],
  )

  const handleUnban = useCallback(() => {
    if (!user) return
    confirmDestructive(
      translate("Buka blokir pengguna?"),
      translate("{x} akan bisa masuk dan bertransaksi kembali.", {
        x: user.fullName ?? user.email,
      }),
      translate("Buka blokir"),
      () =>
        void runAction("unban", () => unbanUser(userId), translate("Blokir dibuka.")),
    )
  }, [confirmDestructive, runAction, user, userId])

  const handleForceLogout = useCallback(() => {
    if (!user) return
    confirmDestructive(
      translate("Paksa logout pengguna?"),
      translate("Semua sesi aktif {x} akan dicabut.", {
        x: user.fullName ?? user.email,
      }),
      translate("Paksa logout"),
      () =>
        void runAction(
          "force-logout",
          () => forceLogout(userId),
          translate("Semua sesi dicabut."),
        ),
    )
  }, [confirmDestructive, runAction, user, userId])

  const handleResetPassword = useCallback(() => {
    if (!user) return
    confirmDestructive(
      translate("Reset kata sandi?"),
      translate("Tautan reset akan dikirim ke email {x}.", {
        x: user.email,
      }),
      translate("Kirim reset"),
      () =>
        void runAction(
          "reset-password",
          () => resetUserPassword(userId),
          translate("Email reset terkirim."),
        ),
    )
  }, [confirmDestructive, runAction, user, userId])

  const handleClearFlag = useCallback(() => {
    if (!user) return
    confirmDestructive(
      translate("Hapus flag review?"),
      translate("Flag moderasi otomatis pada {x} akan dihapus.", {
        x: user.fullName ?? user.email,
      }),
      translate("Hapus flag"),
      () =>
        void runAction(
          "clear-flag",
          () => clearReviewFlag(userId),
          translate("Flag review dihapus."),
        ),
    )
  }, [confirmDestructive, runAction, user, userId])

  const handleRevokeSession = useCallback(
    (sessionId: string) => {
      confirmDestructive(
        translate("Cabut sesi ini?"),
        translate("Perangkat terkait akan keluar dan harus login ulang."),
        translate("Cabut sesi"),
        () => {
          setRevokingSessionId(sessionId)
          revokeUserSession(userId, sessionId)
            .then(() => sessions.refresh())
            .catch((error: unknown) =>
              Alert.alert(translate("Gagal"), messageOf(error)),
            )
            .finally(() => setRevokingSessionId(null))
        },
      )
    },
    [confirmDestructive, sessions, userId],
  )

  const handleBanConfirm = useCallback(() => {
    const reason = banReason.trim()
    if (reason.length < 5 || !user) return
    setBanSheetOpen(false)
    setBanReason("")
    void runAction("ban", () => banUser(userId, reason), translate("Pengguna diblokir."))
  }, [banReason, runAction, user, userId])

  const handleAdjustConfirm = useCallback(() => {
    const amount = Number(adjustAmount.replace(/[^0-9]/g, ""))
    const reason = adjustReason.trim()
    if (
      !Number.isSafeInteger(amount) ||
      amount < 1 ||
      amount > MAX_ADJUST_IDR ||
      reason.length < 5 ||
      !user
    ) {
      return
    }
    setAdjustSheetOpen(false)
    setAdjustAmount("")
    setAdjustReason("")
    void runAction(
      "adjust",
      () => adjustWallet(userId, { amount, type: adjustType, reason }),
      translate("Saldo disesuaikan."),
    )
  }, [adjustAmount, adjustReason, adjustType, runAction, user, userId])

  if (detail.loading && !user) {
    return <LoadingScreen message={translate("Memuat detail pengguna…")} />
  }

  if (detail.error && !user) {
    return (
      <Screen edges={["top"]}>
        <Header title={translate("Detail Pengguna")} />
        <ErrorState
          title={translate("Gagal memuat detail")}
          description={detail.error}
          onRetry={detail.reload}
          retrying={detail.loading}
        />
      </Screen>
    )
  }

  if (!user) return null

  const displayName = user.fullName?.trim() || translate("Tanpa nama")
  const adjustAmountNum = Number(adjustAmount.replace(/[^0-9]/g, ""))
  const adjustValid =
    Number.isSafeInteger(adjustAmountNum) &&
    adjustAmountNum >= 1 &&
    adjustAmountNum <= MAX_ADJUST_IDR &&
    adjustReason.trim().length >= 5

  return (
    <Screen edges={["top"]} scroll>
      <Header title={displayName} />

      {/* Profil */}
      <SectionHeader title={translate("Profil")} />
      <Card className="mb-2">
        <View className="mb-3 flex-row items-center justify-between gap-2">
          <Badge tone={user.isBanned ? "danger" : "success"}>
            {user.isBanned ? translate("Diblokir") : translate("Aktif")}
          </Badge>
          <View className="flex-row gap-1.5">
            <KycBadge status={user.kycStatus} />
            {user.flaggedForReview ? (
              <Badge tone="warning">{translate("Flag review")}</Badge>
            ) : null}
          </View>
        </View>
        <KeyValue label={translate("Nama")} value={displayName} />
        {user.username ? (
          <KeyValue label={translate("Username")} value={`@${user.username}`} mono />
        ) : null}
        <KeyValue label={translate("Email")} value={user.email} />
        {user.phoneNumber ? (
          <KeyValue label={translate("No. HP")} value={user.phoneNumber} mono />
        ) : null}
        {user.isBanned && user.banReason ? (
          <KeyValue
            label={translate("Alasan blokir")}
            value={user.banReason}
          />
        ) : null}
        <KeyValue
          label={translate("Terdaftar")}
          value={formatDateTime(user.createdAt)}
        />
        {user.lastLoginAt ? (
          <KeyValue
            label={translate("Login terakhir")}
            value={formatDateTime(user.lastLoginAt)}
          />
        ) : null}
        <KeyValue
          label={translate("Order")}
          value={translate("{x} beli · {y} jual · {z} selesai", {
            x: user.totalOrdersAsBuyer,
            y: user.totalOrdersAsSeller,
            z: user.totalOrdersCompleted,
          })}
        />
        <KeyValue
          label={translate("Laporan diterima")}
          value={String(user.reportsReceivedCount)}
        />
      </Card>

      {/* Wallet */}
      <SectionHeader title={translate("Wallet")} />
      <Card className="mb-2">
        {user.wallet ? (
          <>
            <KeyValue
              label={translate("Saldo total")}
              value={formatRupiah(user.wallet.totalBalance)}
              emphasis
            />
            <KeyValue
              label={translate("Saldo tersedia")}
              value={formatRupiah(user.wallet.availableBalance)}
            />
            <KeyValue
              label={translate("Saldo escrow")}
              value={formatRupiah(user.wallet.escrowBalance)}
            />
          </>
        ) : (
          <Text tone="secondary">{translate("Wallet belum dibuat.")}</Text>
        )}
        <View className="mt-3">
          <Button
            variant="secondary"
            onPress={() => setAdjustSheetOpen(true)}
            accessibilityLabel={translate("Sesuaikan saldo pengguna")}
          >
            {translate("Sesuaikan saldo")}
          </Button>
        </View>
      </Card>

      {/* Sesi aktif */}
      <SectionHeader title={translate("Sesi aktif")} />
      <Card className="mb-2">
        {sessions.loading && !sessions.data ? (
          <Text tone="secondary">{translate("Memuat sesi…")}</Text>
        ) : sessions.error && !sessions.data ? (
          <ErrorState
            title={translate("Gagal memuat sesi")}
            description={sessions.error}
            onRetry={sessions.reload}
            compact
          />
        ) : (sessions.data?.data.length ?? 0) === 0 ? (
          <EmptyState
            icon={Devices}
            title={translate("Tidak ada sesi aktif")}
            description={translate("Pengguna sedang tidak login di perangkat mana pun.")}
          />
        ) : (
          sessions.data?.data.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              revoking={revokingSessionId === session.id}
              onRevoke={() => handleRevokeSession(session.id)}
            />
          ))
        )}
      </Card>

      {/* Order */}
      <SectionHeader title={translate("Order pengguna")} />
      <Card className="mb-2">
        {orders.loading && !orders.data ? (
          <Text tone="secondary">{translate("Memuat order…")}</Text>
        ) : orders.error && !orders.data ? (
          <ErrorState
            title={translate("Gagal memuat order")}
            description={orders.error}
            onRetry={orders.reload}
            compact
          />
        ) : (orders.data?.data.length ?? 0) === 0 ? (
          <EmptyState
            icon={Receipt}
            title={translate("Belum ada order")}
            description={translate("Pengguna belum pernah bertransaksi.")}
          />
        ) : (
          orders.data?.data.map((order) => (
            <View
              key={order.id}
              className="flex-row items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0"
            >
              <View className="flex-1">
                <Text variant="body" weight={500} numberOfLines={1}>
                  {order.title?.trim() || order.orderId}
                </Text>
                <Text variant="caption" tone="secondary">
                  {formatDateTime(order.createdAt)}
                </Text>
              </View>
              <View className="items-end">
                <Text variant="body" weight={600}>
                  {formatRupiah(order.orderValue)}
                </Text>
                <Text variant="caption" tone="secondary">
                  {order.status}
                </Text>
              </View>
            </View>
          ))
        )}
      </Card>

      {/* Audit log */}
      <SectionHeader title={translate("Audit log")} />
      <Card className="mb-2">
        {audit.loading && !audit.data ? (
          <Text tone="secondary">{translate("Memuat audit log…")}</Text>
        ) : audit.error && !audit.data ? (
          <ErrorState
            title={translate("Gagal memuat audit log")}
            description={audit.error}
            onRetry={audit.reload}
            compact
          />
        ) : (audit.data?.data.length ?? 0) === 0 ? (
          <EmptyState
            icon={ListChecks}
            title={translate("Belum ada aktivitas")}
            description={translate("Tidak ada jejak audit untuk pengguna ini.")}
          />
        ) : (
          audit.data?.data.map((entry) => (
            <View
              key={entry.id}
              className="border-b border-border py-2.5 last:border-b-0"
            >
              <Text variant="body" numberOfLines={2}>
                {entry.description?.trim() || entry.action}
              </Text>
              <Text variant="caption" tone="secondary">
                {formatDateTime(entry.createdAt)}
                {entry.ipAddress ? ` · ${entry.ipAddress}` : ""}
              </Text>
            </View>
          ))
        )}
      </Card>

      {/* Aksi */}
      <SectionHeader title={translate("Aksi admin")} />
      <Card className="mb-6">
        <View style={{ gap: 12 }}>
          {user.isBanned ? (
            <Button
              variant="secondary"
              loading={acting === "unban"}
              onPress={handleUnban}
              accessibilityLabel={translate("Buka blokir pengguna ini")}
            >
              {translate("Buka blokir")}
            </Button>
          ) : (
            <Button
              variant="destructive"
              loading={acting === "ban"}
              onPress={() => setBanSheetOpen(true)}
              accessibilityLabel={translate("Blokir pengguna ini")}
            >
              {translate("Blokir")}
            </Button>
          )}
          <Button
            variant="destructive"
            loading={acting === "force-logout"}
            onPress={handleForceLogout}
            accessibilityLabel={translate("Paksa logout pengguna ini")}
          >
            {translate("Paksa logout")}
          </Button>
          <Button
            variant="secondary"
            loading={acting === "reset-password"}
            onPress={handleResetPassword}
            accessibilityLabel={translate("Kirim email reset kata sandi")}
          >
            {translate("Reset kata sandi")}
          </Button>
          {user.flaggedForReview ? (
            <Button
              variant="secondary"
              loading={acting === "clear-flag"}
              onPress={handleClearFlag}
              accessibilityLabel={translate("Hapus flag review pengguna ini")}
            >
              {translate("Hapus flag review")}
            </Button>
          ) : null}
        </View>
      </Card>

      {/* Sheet: blokir */}
      <BottomSheet
        visible={banSheetOpen}
        onRequestClose={() => setBanSheetOpen(false)}
        title={translate("Blokir pengguna")}
        description={translate("Tulis alasan pemblokiran {x}.", { x: displayName })}
        avoidKeyboard
        footer={
          <Button
            variant="destructive"
            loading={acting === "ban"}
            disabled={banReason.trim().length < 5}
            onPress={handleBanConfirm}
            accessibilityLabel={translate("Konfirmasi blokir")}
          >
            {translate("Blokir")}
          </Button>
        }
      >
        <Input
          variant="multiline"
          rows={4}
          label={translate("Alasan blokir")}
          placeholder={translate("Minimal 5 karakter…")}
          value={banReason}
          onChangeText={setBanReason}
          maxLength={500}
          accessibilityLabel={translate("Alasan blokir")}
        />
      </BottomSheet>

      {/* Sheet: sesuaikan saldo */}
      <BottomSheet
        visible={adjustSheetOpen}
        onRequestClose={() => setAdjustSheetOpen(false)}
        title={translate("Sesuaikan saldo")}
        description={translate("Penyesuaian manual tercatat sebagai mutasi admin.")}
        avoidKeyboard
        footer={
          <Button
            variant="primary"
            loading={acting === "adjust"}
            disabled={!adjustValid}
            onPress={handleAdjustConfirm}
            accessibilityLabel={translate("Konfirmasi penyesuaian saldo")}
          >
            {translate("Simpan penyesuaian")}
          </Button>
        }
      >
        <SegmentedControl<WalletAdjustType>
          items={[
            { value: "CREDIT", label: translate("Kredit") },
            { value: "DEBIT", label: translate("Debit") },
          ]}
          value={adjustType}
          onChange={setAdjustType}
          accessibilityLabel={translate("Jenis penyesuaian")}
        />
        <Input
          label={translate("Jumlah (Rp)")}
          placeholder="100000"
          value={adjustAmount}
          onChangeText={(text) => setAdjustAmount(text.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
          maxLength={8}
          helperText={translate("{x} – {y}", { x: 1, y: formatRupiah(MAX_ADJUST_IDR) })}
          accessibilityLabel={translate("Jumlah penyesuaian dalam Rupiah")}
        />
        <Input
          variant="multiline"
          rows={3}
          label={translate("Alasan penyesuaian")}
          placeholder={translate("Minimal 5 karakter…")}
          value={adjustReason}
          onChangeText={setAdjustReason}
          maxLength={1000}
          accessibilityLabel={translate("Alasan penyesuaian saldo")}
        />
      </BottomSheet>
    </Screen>
  )
}
