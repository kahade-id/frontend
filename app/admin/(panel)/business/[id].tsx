/**
 * Admin — Detail verifikasi bisnis: info pengajuan, dokumen, aksi.
 *
 * - Dokumen: tombol "Lihat dokumen" → BottomSheet minta password admin →
 *   getBusinessDocumentUrls() → buka URL via Linking.
 * - Approve: BottomSheet konfirmasi + catatan opsional.
 * - Reject: wajib alasan min 10 karakter + catatan opsional.
 * - Revoke: alasan opsional.
 * - Setelah aksi berhasil → toast + router.back() (list me-refresh
 *   otomatis saat fokus kembali).
 */
import { Briefcase } from "phosphor-react-native"
import { useCallback, useEffect, useState } from "react"
import { Linking, View } from "react-native"
import { Stack, router, useLocalSearchParams } from "expo-router"
import { useIsFocused } from "@react-navigation/native"

import { translate } from "@/lib/i18n/translate"
import { formatDateTimeWIB } from "@/lib/format"
import { userMessage } from "@/lib/api/errors"
import { handleAdminApiError } from "@/lib/admin-session"
import {
  approveBusiness,
  getBusinessDetail,
  getBusinessDocumentUrls,
  rejectBusiness,
  revokeBusiness,
  type BusinessVerificationItem,
  type BusinessVerificationStatus,
} from "@/lib/api/admin/business"

import { Badge, type BadgeTone } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DataScreen } from "@/components/ui/data-screen"
import { Input } from "@/components/ui/input"
import { KeyValue } from "@/components/ui/key-value"
import { Section } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

const STATUS_TONE: Record<BusinessVerificationStatus, BadgeTone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  REVOKED: "neutral",
}

const STATUS_LABEL: Record<BusinessVerificationStatus, string> = {
  PENDING: "Menunggu",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  REVOKED: "Dicabut",
}

type SheetKind = "docs" | "approve" | "reject" | "revoke"

const SHEET_TITLE: Record<SheetKind, string> = {
  docs: "Lihat dokumen bisnis",
  approve: "Setujui verifikasi bisnis",
  reject: "Tolak verifikasi bisnis",
  revoke: "Cabut verifikasi bisnis",
}

export default function AdminBusinessDetailScreen() {
  const toast = useToast()
  const isFocused = useIsFocused()
  const { id } = useLocalSearchParams<{ id: string }>()
  const verificationId = Array.isArray(id) ? id[0] : (id ?? "")

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<BusinessVerificationItem | null>(null)

  const [sheet, setSheet] = useState<SheetKind | null>(null)
  const [password, setPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [docUrls, setDocUrls] = useState<string[] | null>(null)
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [note, setNote] = useState("")
  const [reason, setReason] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (!verificationId) return
      if (mode === "initial") setLoading(true)
      else setRefreshing(true)
      setError(null)
      try {
        const res = await getBusinessDetail(verificationId)
        setDetail(res)
      } catch (e) {
        if (!handleAdminApiError(e)) setError(userMessage(e))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [verificationId],
  )

  useEffect(() => {
    if (isFocused) void load("initial")
  }, [isFocused, load])

  const openSheet = useCallback((kind: SheetKind) => {
    setSheet(kind)
    setPassword("")
    setPasswordError(null)
    setNote("")
    setReason("")
    setFormError(null)
  }, [])

  const closeSheet = useCallback(() => {
    if (submitting || loadingDocs) return
    setSheet(null)
  }, [submitting, loadingDocs])

  const handleFetchDocs = useCallback(async () => {
    const pwd = password.trim()
    if (pwd.length === 0) {
      setPasswordError(translate("Password wajib diisi."))
      return
    }
    setLoadingDocs(true)
    try {
      const res = await getBusinessDocumentUrls(verificationId, pwd)
      setDocUrls(res.urls)
    } catch (e) {
      if (!handleAdminApiError(e)) setPasswordError(userMessage(e))
    } finally {
      setLoadingDocs(false)
    }
  }, [password, verificationId])

  const handleOpenUrl = useCallback(
    (url: string, label: string) => {
      Linking.openURL(url).catch(() => {
        toast.show({
          title: translate("Gagal membuka dokumen"),
          description: translate("Tidak dapat membuka {x}.", {
            x: label,
          }),
          tone: "danger",
        })
      })
    },
    [toast],
  )

  const handleAction = useCallback(async () => {
    if (!sheet || sheet === "docs" || submitting) return
    const trimmedReason = reason.trim()
    const trimmedNote = note.trim()
    if (sheet === "reject" && trimmedReason.length < 10) {
      setFormError(translate("Alasan minimal 10 karakter."))
      return
    }
    setSubmitting(true)
    try {
      if (sheet === "approve") {
        await approveBusiness(verificationId, trimmedNote || undefined)
        toast.show({
          title: translate("Verifikasi bisnis disetujui"),
          tone: "success",
        })
      } else if (sheet === "reject") {
        await rejectBusiness(
          verificationId,
          trimmedReason,
          trimmedNote || undefined,
        )
        toast.show({
          title: translate("Verifikasi bisnis ditolak"),
          tone: "success",
        })
      } else {
        await revokeBusiness(verificationId, trimmedReason || undefined)
        toast.show({
          title: translate("Verifikasi bisnis dicabut"),
          tone: "success",
        })
      }
      setSheet(null)
      router.back()
    } catch (e) {
      if (!handleAdminApiError(e)) {
        toast.show({
          title: translate("Gagal memproses verifikasi bisnis"),
          description: userMessage(e),
          tone: "danger",
        })
      }
    } finally {
      setSubmitting(false)
    }
  }, [sheet, submitting, reason, note, verificationId, toast])

  const status = detail?.status
  const canDecide = status === "PENDING"
  const canRevoke = status === "APPROVED"

  const sheetTitle = sheet ? translate(SHEET_TITLE[sheet]) : ""

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <DataScreen
        title={translate("Detail Verifikasi")}
        state={{
          loading,
          refreshing,
          error,
          refresh: () => load("refresh"),
          reload: () => load("initial"),
        }}
        loadingMessage={translate("Memuat detail verifikasi…")}
        errorTitle={translate("Gagal memuat detail verifikasi")}
        empty={
          detail == null && {
            icon: Briefcase,
            title: translate("Belum ada data"),
            description: translate("Pengajuan verifikasi tidak ditemukan."),
          }
        }
      >
        {detail ? (
          <View className="gap-6 pb-8">
            <Section title={translate("Pengajuan")}>
              <Card padded>
                <View className="flex-row items-center justify-between gap-2">
                  <Text variant="body" weight={600}>
                    {translate("Status")}
                  </Text>
                  <Badge tone={STATUS_TONE[detail.status]}>
                    {translate(STATUS_LABEL[detail.status])}
                  </Badge>
                </View>
                <View className="mt-3 gap-2">
                  <KeyValue
                    label={translate("Diajukan pada")}
                    value={formatDateTimeWIB(detail.createdAt)}
                  />
                  {detail.reviewedAt ? (
                    <KeyValue
                      label={translate("Direview pada")}
                      value={formatDateTimeWIB(detail.reviewedAt)}
                    />
                  ) : null}
                  {detail.rejectionReason ? (
                    <KeyValue
                      label={translate("Alasan penolakan")}
                      value={detail.rejectionReason}
                    />
                  ) : null}
                </View>
              </Card>
            </Section>

            <Section title={translate("Bisnis")}>
              <Card padded>
                <View className="gap-2">
                  <KeyValue
                    label={translate("Nama bisnis")}
                    value={detail.businessName ?? "—"}
                  />
                  {detail.user ? (
                    <>
                      <KeyValue
                        label={translate("Nama pemilik")}
                        value={detail.user.fullName ?? "—"}
                      />
                      <KeyValue
                        label={translate("Email pemilik")}
                        value={detail.user.email}
                      />
                    </>
                  ) : null}
                  <KeyValue
                    label={translate("ID pengguna")}
                    value={detail.userId}
                    mono
                  />
                </View>
              </Card>
            </Section>

            <Section title={translate("Dokumen")}>
              <Button
                variant="secondary"
                onPress={() => openSheet("docs")}
                accessibilityLabel={translate("Lihat dokumen verifikasi bisnis")}
              >
                {translate("Lihat dokumen")}
              </Button>
              <Text variant="caption" tone="secondary" className="mt-2">
                {translate(
                  "Dokumen memerlukan password admin dan hanya berlaku 5 menit.",
                )}
              </Text>
            </Section>

            {canDecide || canRevoke ? (
              <Section title={translate("Tindakan")}>
                <View className="gap-2">
                  {canDecide ? (
                    <View className="flex-row gap-2">
                      <Button
                        variant="secondary"
                        className="flex-1"
                        onPress={() => openSheet("reject")}
                        accessibilityLabel={translate(
                          "Tolak verifikasi bisnis",
                        )}
                      >
                        {translate("Tolak")}
                      </Button>
                      <Button
                        className="flex-1"
                        onPress={() => openSheet("approve")}
                        accessibilityLabel={translate(
                          "Setujui verifikasi bisnis",
                        )}
                      >
                        {translate("Setujui")}
                      </Button>
                    </View>
                  ) : null}
                  {canRevoke ? (
                    <Button
                      variant="destructive"
                      onPress={() => openSheet("revoke")}
                      accessibilityLabel={translate("Cabut verifikasi bisnis")}
                    >
                      {translate("Cabut verifikasi")}
                    </Button>
                  ) : null}
                </View>
              </Section>
            ) : null}
          </View>
        ) : null}
      </DataScreen>

      <BottomSheet
        visible={sheet !== null}
        onRequestClose={closeSheet}
        title={sheetTitle}
        avoidKeyboard
        footer={
          sheet === "docs" ? (
            docUrls ? undefined : (
              <View className="flex-row gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onPress={closeSheet}
                  disabled={loadingDocs}
                >
                  {translate("Batal")}
                </Button>
                <Button
                  className="flex-1"
                  loading={loadingDocs}
                  onPress={() => void handleFetchDocs()}
                  accessibilityLabel={translate("Tampilkan dokumen bisnis")}
                >
                  {translate("Tampilkan")}
                </Button>
              </View>
            )
          ) : (
            <View className="flex-row gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onPress={closeSheet}
                disabled={submitting}
              >
                {translate("Batal")}
              </Button>
              <Button
                variant={sheet === "approve" ? "primary" : "destructive"}
                className="flex-1"
                loading={submitting}
                onPress={() => void handleAction()}
                accessibilityLabel={sheetTitle}
              >
                {sheet === "approve"
                  ? translate("Setujui")
                  : sheet === "reject"
                    ? translate("Tolak")
                    : translate("Cabut")}
              </Button>
            </View>
          )
        }
      >
        {sheet === "docs" ? (
          docUrls ? (
            <View className="gap-2">
              {docUrls.length === 0 ? (
                <Text variant="body" tone="secondary">
                  {translate("Tidak ada dokumen tersedia.")}
                </Text>
              ) : (
                docUrls.map((url, i) => {
                  const label = translate("Dokumen {x}", { x: i + 1 })
                  return (
                    <Button
                      key={url}
                      variant="secondary"
                      onPress={() => handleOpenUrl(url, label)}
                      accessibilityLabel={translate("Buka {x}", {
                        x: label,
                      })}
                    >
                      {translate("Buka {x}", { x: label })}
                    </Button>
                  )
                })
              )}
            </View>
          ) : (
            <View>
              <Text variant="body" tone="secondary">
                {translate(
                  "Masukkan password admin untuk membuka dokumen verifikasi bisnis.",
                )}
              </Text>
              <Input
                label={translate("Password admin")}
                secureTextEntry
                value={password}
                onChangeText={(v) => {
                  setPassword(v)
                  if (passwordError) setPasswordError(null)
                }}
                errorText={passwordError ?? undefined}
                placeholder={translate("Password admin")}
                className="mt-3"
                autoCapitalize="none"
              />
            </View>
          )
        ) : (
          <View>
            {sheet === "approve" ? (
              <Text variant="body" tone="secondary">
                {translate(
                  "Verifikasi yang disetujui menandai bisnis terverifikasi. Tindakan ini dicatat.",
                )}
              </Text>
            ) : sheet === "reject" ? (
              <Text variant="body" tone="secondary">
                {translate(
                  "Pengajuan yang ditolak bisa diajukan ulang oleh pengguna. Tulis alasan yang jelas.",
                )}
              </Text>
            ) : (
              <Text variant="body" tone="secondary">
                {translate(
                  "Pencabutan membatalkan status terverifikasi bisnis.",
                )}
              </Text>
            )}
            {sheet === "reject" || sheet === "revoke" ? (
              <Input
                label={
                  sheet === "reject"
                    ? translate("Alasan penolakan")
                    : translate("Alasan pencabutan (opsional)")
                }
                required={sheet === "reject"}
                multiline
                numberOfLines={3}
                value={reason}
                onChangeText={(v) => {
                  setReason(v)
                  if (formError) setFormError(null)
                }}
                errorText={formError ?? undefined}
                placeholder={
                  sheet === "reject"
                    ? translate("Contoh: dokumen tidak lengkap…")
                    : translate("Contoh: ditemukan data tidak valid…")
                }
                className="mt-3"
              />
            ) : null}
            {sheet !== "revoke" ? (
              <Input
                label={translate("Catatan (opsional)")}
                multiline
                numberOfLines={2}
                value={note}
                onChangeText={setNote}
                placeholder={translate("Contoh: sudah dicek manual…")}
                className="mt-3"
              />
            ) : null}
          </View>
        )}
      </BottomSheet>
    </>
  )
}
