/**
 * Kahade — Admin: Tim (manajemen akun admin).
 *
 * Daftar akun admin (nama, email, peran, status aktif/terkunci), tambah admin
 * baru, ubah peran/nonaktifkan, reset 2FA, unlock akun terkunci, dan hapus
 * (soft-delete) — semua aksi destruktif memakai konfirmasi.
 */
import { useCallback, useEffect, useState } from "react"
import { Alert, FlatList, View } from "react-native"
import { Users } from "phosphor-react-native"

import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { Button } from "@/components/ui/button"
import { Card, CardBody } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Input } from "@/components/ui/input"
import { PasswordField } from "@/components/ui/password-field"
import { Select, SelectOptionList } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { EmptyState } from "@/components/ui/empty-state"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/components/ui/toast"
import { translate } from "@/lib/i18n/translate"
import { userMessage } from "@/lib/api"
import {
  ADMIN_ROLES,
  listAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  resetAdmin2fa,
  unlockAdmin,
  type AdminRole,
  type AdminUserItem,
} from "@/lib/api/admin/management"

const PAGE_LIMIT = 20

/** Nilai enum AdminRole di backend — dipakai persis apa adanya. */
const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: "Super Admin",
  DISPUTE_ADMIN: "Admin Sengketa",
  KYC_ADMIN: "Admin KYC",
  FINANCE_ADMIN: "Admin Keuangan",
  CUSTOMER_SUPPORT: "Layanan Pelanggan",
}

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

function isLocked(admin: AdminUserItem): boolean {
  if (!admin.lockedUntil) return false
  return new Date(admin.lockedUntil).getTime() > Date.now()
}

/* ------------------------------------------------------------------ */
/* Form tambah admin                                                    */
/* ------------------------------------------------------------------ */

function CreateAdminForm({
  onCreated,
}: {
  onCreated: () => void
}) {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<AdminRole>("CUSTOMER_SUPPORT")
  const [roleSheetOpen, setRoleSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const toast = useToast()

  async function handleSubmit() {
    setFormError(null)
    if (fullName.trim().length < 2) {
      setFormError(translate("Nama lengkap minimal 2 karakter."))
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setFormError(translate("Format email tidak valid."))
      return
    }
    if (password.length < 12) {
      setFormError(translate("Kata sandi minimal 12 karakter."))
      return
    }
    setSaving(true)
    try {
      await createAdmin({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        role,
      })
      toast.show({ tone: "success", title: translate("Akun admin dibuat.") })
      onCreated()
    } catch (e) {
      setFormError(userMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className="gap-3">
      {formError ? (
        <Text tone="danger" accessibilityRole="alert">
          {formError}
        </Text>
      ) : null}
      <Input
        label={translate("Nama lengkap")}
        value={fullName}
        onChangeText={setFullName}
        maxLength={60}
        required
      />
      <Input
        label={translate("Email")}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        required
      />
      <PasswordField
        label={translate("Kata sandi awal")}
        value={password}
        onChangeText={setPassword}
        helperText={translate("Min. 12 karakter: huruf besar, kecil, angka, dan simbol.")}
        required
      />
      <Select<AdminRole>
        label={translate("Peran")}
        value={role}
        options={ADMIN_ROLES.map((r) => ({ value: r, label: translate(ROLE_LABELS[r]) }))}
        onPress={() => setRoleSheetOpen(true)}
        open={roleSheetOpen}
      />
      <Button loading={saving} onPress={handleSubmit}>
        {translate("Tambah admin")}
      </Button>

      <BottomSheet
        visible={roleSheetOpen}
        onRequestClose={() => setRoleSheetOpen(false)}
        title={translate("Pilih peran")}
        padding="none"
      >
        <SelectOptionList<AdminRole>
          options={ADMIN_ROLES.map((r) => ({ value: r, label: translate(ROLE_LABELS[r]) }))}
          value={role}
          onSelect={(v) => {
            setRole(v)
            setRoleSheetOpen(false)
          }}
        />
      </BottomSheet>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/* Sheet detail/kelola admin                                            */
/* ------------------------------------------------------------------ */

function ManageAdminSheet({
  admin,
  onClose,
  onChanged,
}: {
  admin: AdminUserItem | null
  onClose: () => void
  onChanged: () => void
}) {
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState<AdminRole>("CUSTOMER_SUPPORT")
  const [isActive, setIsActive] = useState(true)
  const [roleSheetOpen, setRoleSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => {
    if (admin) {
      setFullName(admin.fullName)
      setRole(admin.role)
      setIsActive(admin.isActive)
      setFormError(null)
    }
  }, [admin])

  async function handleSave() {
    if (!admin) return
    setFormError(null)
    if (fullName.trim().length < 2) {
      setFormError(translate("Nama lengkap minimal 2 karakter."))
      return
    }
    setSaving(true)
    try {
      await updateAdmin(admin.id, {
        fullName: fullName.trim(),
        role,
        isActive,
      })
      toast.show({ tone: "success", title: translate("Akun admin diperbarui.") })
      onChanged()
      onClose()
    } catch (e) {
      setFormError(userMessage(e))
    } finally {
      setSaving(false)
    }
  }

  function runAction(
    kind: "reset-2fa" | "unlock" | "delete",
    title: string,
    message: string,
    confirmLabel: string,
    action: (id: string) => Promise<{ message: string }>,
    success: string,
    destructive: boolean,
  ) {
    Alert.alert(title, message, [
      { text: translate("Batal"), style: "cancel" },
      {
        text: confirmLabel,
        style: destructive ? "destructive" : "default",
        onPress: () => {
          void (async () => {
            if (!admin) return
            setBusyAction(kind)
            try {
              await action(admin.id)
              toast.show({ tone: "success", title: success })
              onChanged()
              onClose()
            } catch (e) {
              Alert.alert(translate("Gagal"), userMessage(e))
            } finally {
              setBusyAction(null)
            }
          })()
        },
      },
    ])
  }

  const locked = admin ? isLocked(admin) : false

  return (
    <>
      <BottomSheet
        visible={admin != null}
        onRequestClose={onClose}
        title={admin ? admin.fullName : ""}
        avoidKeyboard
      >
        {admin ? (
          <View className="gap-3">
            {formError ? (
              <Text tone="danger" accessibilityRole="alert">
                {formError}
              </Text>
            ) : null}
            <Input
              label={translate("Nama lengkap")}
              value={fullName}
              onChangeText={setFullName}
              maxLength={60}
            />
            <Select<AdminRole>
              label={translate("Peran")}
              value={role}
              options={ADMIN_ROLES.map((r) => ({ value: r, label: translate(ROLE_LABELS[r]) }))}
              onPress={() => setRoleSheetOpen(true)}
              open={roleSheetOpen}
            />
            <Switch
              label={translate("Akun aktif")}
              description={translate("Akun nonaktif tidak bisa login ke panel admin.")}
              value={isActive}
              onChange={setIsActive}
            />
            <Button loading={saving} onPress={handleSave}>
              {translate("Simpan perubahan")}
            </Button>

            <View className="gap-2 pt-2">
              {locked ? (
                <Button
                  variant="secondary"
                  loading={busyAction === "unlock"}
                  onPress={() =>
                    runAction(
                      "unlock",
                      translate("Buka akun?"),
                      translate("Akun {x} akan dibuka dan bisa login kembali.", {
                        x: admin.fullName,
                      }),
                      translate("Buka akun"),
                      unlockAdmin,
                      translate("Akun dibuka."),
                      false,
                    )
                  }
                >
                  {translate("Buka akun terkunci")}
                </Button>
              ) : null}
              <Button
                variant="secondary"
                loading={busyAction === "reset-2fa"}
                onPress={() =>
                  runAction(
                    "reset-2fa",
                    translate("Reset 2FA?"),
                    translate(
                      "{x}FA akun {y} akan direset. Admin harus menyiapkan ulang authenticator.",
                      { x: 2, y: admin.fullName },
                    ),
                    translate("Reset 2FA"),
                    resetAdmin2fa,
                    translate("2FA direset."),
                    false,
                  )
                }
              >
                {translate("Reset 2FA")}
              </Button>
              <Button
                variant="destructive"
                loading={busyAction === "delete"}
                onPress={() =>
                  runAction(
                    "delete",
                    translate("Hapus admin?"),
                    translate("Akun {x} akan dinonaktifkan (soft-delete).", {
                      x: admin.fullName,
                    }),
                    translate("Hapus"),
                    deleteAdmin,
                    translate("Akun admin dihapus."),
                    true,
                  )
                }
              >
                {translate("Hapus admin")}
              </Button>
            </View>
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet
        visible={roleSheetOpen}
        onRequestClose={() => setRoleSheetOpen(false)}
        title={translate("Pilih peran")}
        padding="none"
      >
        <SelectOptionList<AdminRole>
          options={ADMIN_ROLES.map((r) => ({ value: r, label: translate(ROLE_LABELS[r]) }))}
          value={role}
          onSelect={(v) => {
            setRole(v)
            setRoleSheetOpen(false)
          }}
        />
      </BottomSheet>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Layar utama                                                          */
/* ------------------------------------------------------------------ */

export default function AdminTeamScreen() {
  const [data, setData] = useState<AdminUserItem[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [searchText, setSearchText] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [managing, setManaging] = useState<AdminUserItem | null>(null)

  const load = useCallback(
    async (pageToLoad: number, mode: "initial" | "more" | "refresh", query: string) => {
      if (mode === "initial") setLoading(true)
      else if (mode === "more") setLoadingMore(true)
      setError(null)
      try {
        const res = await listAdmins({
          page: pageToLoad,
          limit: PAGE_LIMIT,
          search: query || undefined,
        })
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
    [],
  )

  useEffect(() => {
    void load(1, "initial", search)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, search])

  function submitSearch() {
    setSearch(searchText.trim())
  }

  return (
    <Screen scroll padded>
      <View className="gap-4 pb-8">
        <Button onPress={() => setCreateOpen(true)}>
          {translate("Tambah admin")}
        </Button>

        <Input
          label={translate("Cari admin")}
          value={searchText}
          onChangeText={setSearchText}
          placeholder={translate("Nama, email, atau ID admin")}
          onSubmitEditing={submitSearch}
          returnKeyType="search"
        />

        {loading ? (
          <View className="items-center py-8">
            <Spinner accessibilityLabel={translate("Memuat tim admin")} />
          </View>
        ) : error ? (
          <Card>
            <CardBody className="gap-3">
              <Text tone="danger" accessibilityRole="alert">
                {error}
              </Text>
              <Button variant="secondary" onPress={() => void load(1, "refresh", search)}>
                {translate("Coba lagi")}
              </Button>
            </CardBody>
          </Card>
        ) : data.length === 0 ? (
          <EmptyState
            icon={Users}
            title={translate("Belum ada admin")}
            description={translate("Tambah akun admin pertama untuk tim.")}
            action={
              <Button fullWidth={false} onPress={() => setCreateOpen(true)}>
                {translate("Tambah admin")}
              </Button>
            }
          />
        ) : (
          <FlatList
            data={data}
            keyExtractor={(a) => a.id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View className="h-3" />}
            renderItem={({ item }) => {
              const locked = isLocked(item)
              return (
                <Card>
                  <CardBody className="gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text variant="h3" className="flex-1">
                        {item.fullName}
                      </Text>
                      <Badge tone={locked ? "danger" : item.isActive ? "success" : "neutral"} dot>
                        {locked
                          ? translate("Terkunci")
                          : item.isActive
                            ? translate("Aktif")
                            : translate("Nonaktif")}
                      </Badge>
                    </View>
                    <Text variant="body" tone="secondary">
                      {item.email}
                    </Text>
                    <View className="flex-row flex-wrap gap-x-4 gap-y-1">
                      <Text variant="caption" tone="tertiary">
                        {translate(ROLE_LABELS[item.role])}
                      </Text>
                      {item.lastLoginAt ? (
                        <Text variant="caption" tone="tertiary">
                          {translate("Login terakhir")}: {formatDateTime(item.lastLoginAt)}
                        </Text>
                      ) : null}
                    </View>
                    <Button
                      variant="secondary"
                      size="sm"
                      onPress={() => setManaging(item)}
                    >
                      {translate("Kelola")}
                    </Button>
                  </CardBody>
                </Card>
              )
            }}
            onEndReached={() => {
              if (!loadingMore && hasMore) void load(page + 1, "more", search)
            }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loadingMore ? (
                <View className="items-center py-4">
                  <Spinner accessibilityLabel={translate("Memuat lagi")} />
                </View>
              ) : null
            }
          />
        )}
      </View>

      <BottomSheet
        visible={createOpen}
        onRequestClose={() => setCreateOpen(false)}
        title={translate("Tambah admin")}
        avoidKeyboard
      >
        <CreateAdminForm
          key="create-admin"
          onCreated={() => {
            setCreateOpen(false)
            void load(1, "refresh", search)
          }}
        />
      </BottomSheet>

      <ManageAdminSheet
        admin={managing}
        onClose={() => setManaging(null)}
        onChanged={() => void load(1, "refresh", search)}
      />
    </Screen>
  )
}
