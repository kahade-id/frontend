/**
 * Kahade — Pengaturan pesan (rute /chat/settings; desain ulang 2026-10-08).
 *
 * Rancangan ulang (permintaan produk, bagian 5): tata letak rapi, grup jelas,
 * copy singkat, minimalis ala situs Apple. Yang berubah dari versi batch 43:
 *
 *   1. DUA grup bernama jelas — "Privasi" dan "Balasan cepat" — dengan
 *      subtitle satu baris. Sebelumnya kontrol privasi bercampur dalam satu
 *      kolom tanpa batas antar konsep.
 *   2. Setiap kontrol berbentuk BARIS dalam kartu bergaris pemisah (iOS/
 *      Settings), bukan tumpukan kartu terpisah: satu kartu = satu konsep,
 *      pemisah 1px memisahkan pilihan di dalamnya. Kartu-per-item membuat
 *      halaman terasa seperti daftar kartu, bukan pengaturan.
 *   3. Copy dipendekkan. Kalimat panjang tidak menambah pemahaman — pengguna
 *      membaca label, bukan paragraf.
 *   4. Form template TERSEMBUNYI di balik satu baris "+ Template baru" dan
 *      hanya terbuka saat dipakai (atau saat mengubah template yang ada).
 *      Halaman pengaturan dibuka untuk MENGATUR, bukan untuk mengisi form.
 *   5. Label aksesibilitas bertemplate memakai `translate("… {x}", …)` —
 *      sebelumnya literal (`Ubah template /salam`) sehingga gate a11y
 *      menandainya dan pembaca layar berbahasa Inggris tetap mendengar
 *      kalimat Indonesia.
 *
 * Fungsi tidak berubah: GET/PATCH /v1/chat/privacy (hideReadReceipts,
 * dmPolicy) + CRUD template balasan "/" lewat lib/reply-templates.
 */
import { useEffect, useMemo, useState } from "react"
import { View } from "react-native"

import {
  DM_POLICY_OPTIONS,
  getChatPrivacy,
  updateChatPrivacy,
  type ChatPrivacySettings,
  type DmPolicy,
} from "@/lib/api/chat"
import { useHasSession } from "@/lib/guest-gate"
import { logWarn } from "@/lib/telemetry"
import { showMutationError } from "@/lib/mutation-toast"
import { translate } from "@/lib/i18n"

import { Screen } from "@/components/ui/screen"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Divider } from "@/components/ui/divider"
import { GuestLoginPrompt } from "@/components/web-guest-gate"
import { Header } from "@/components/ui/header"
import { SectionHeader } from "@/components/ui/section"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"
import { Icon } from "@/components/ui/icon"
import { Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { PressableScale } from "@/components/ui/pressable-scale"
import { useToast } from "@/components/ui/toast"
import {
  addReplyTemplate,
  editReplyTemplate,
  normalizeTemplateShortcut,
  removeReplyTemplate,
  useReplyTemplates,
  validateTemplateInput,
  REPLY_TEMPLATE_TEXT_MAX,
  type ChatReplyTemplate,
} from "@/lib/reply-templates"
import { CheckCircle, PencilSimple, Plus, Trash, X } from "phosphor-react-native"

/** Batas template per akun (backend) — hanya untuk salinan informasi. */
const REPLY_TEMPLATE_MAX = 50

export default function ChatSettingsScreen() {
  const toast = useToast()
  /** NAV-004: endpoint privasi/template semuanya auth-required — jangan
   *  menembak tanpa sesi (overlay web bisa me-mount layar ini). */
  const hasSession = useHasSession()
  const [privacy, setPrivacy] = useState<ChatPrivacySettings | null>(null)
  const [saving, setSaving] = useState(false)
  // Klasifikasi toast: kegagalan MUAT section → INLINE ErrorState + retry
  // (bukan toast — tanpa ini section hanya spinner selamanya).
  const [privacyError, setPrivacyError] = useState(false)
  const [privacyRetry, setPrivacyRetry] = useState(0)

  useEffect(() => {
    if (!hasSession) return
    let alive = true
    setPrivacyError(false)
    getChatPrivacy()
      .then((p) => {
        if (alive) setPrivacy(p)
      })
      .catch((err: unknown) => {
        logWarn("chat:settings-privacy-load", err)
        if (alive) setPrivacyError(true)
      })
    return () => {
      alive = false
    }
  }, [hasSession, privacyRetry])

  const patchPrivacy = async (patch: Partial<ChatPrivacySettings>) => {
    if (!privacy || saving) return
    const prev = privacy
    setPrivacy({ ...privacy, ...patch })
    setSaving(true)
    try {
      setPrivacy(await updateChatPrivacy(patch))
    } catch (err) {
      logWarn("chat:settings-privacy-save", err)
      setPrivacy(prev)
      // Klasifikasi toast: error mutasi non-blokir via showMutationError.
      showMutationError(toast.show, {
        failTitle: translate("Gagal menyimpan"),
        uncertainHint: translate(
          "Perubahan mungkin sudah tersimpan — buka ulang halaman untuk memastikan.",
        ),
        err: err,
        scope: "chat:settings:menyimpan",
      })
    } finally {
      setSaving(false)
    }
  }

  // NAV-004: tamu tidak melihat/mengubah pengaturan chat.
  if (!hasSession) {
    return (
      <Screen edges={["top"]} padded={false}>
        <Header title={translate("Pengaturan pesan")} />
        <GuestLoginPrompt bare next="/chat/settings" />
      </Screen>
    )
  }

  return (
    // CHT-006: daftar template (maks 50) harus bisa di-scroll, dan form
    // "Template baru" di bawah tidak boleh tertutup keyboard.
    <Screen edges={["top"]} padded={false} scroll keyboardAvoiding>
      <Header title={translate("Pengaturan pesan")} />
      {/* Ritme halaman: gap 6 (24px) antar grup, 2 (8px) di dalam grup. */}
      <View className="gap-6 px-5 pb-10 pt-3">
        {/* ── Grup 1: Privasi ─────────────────────────────────────────── */}
        <View className="gap-2">
          <SectionHeader
            title={translate("Privasi")}
            subtitle={translate("Berlaku di semua perangkat Anda.")}
          />
          {privacy === null ? (
            privacyError ? (
              <ErrorState
                compact
                title={translate("Gagal memuat pengaturan privasi")}
                onRetry={() => setPrivacyRetry((n) => n + 1)}
              />
            ) : (
              <View className="items-center py-4">
                <Spinner />
              </View>
            )
          ) : (
            <Card padded={false} className="overflow-hidden">
              <Switch
                value={privacy.hideReadReceipts}
                onChange={(v) => void patchPrivacy({ hideReadReceipts: v })}
                label={translate("Sembunyikan centang dibaca")}
                description={translate(
                  "Anda dan lawan bicara tidak melihat tanda pesan sudah dibaca.",
                )}
                disabled={saving}
                className="px-4 py-3"
              />
              <Divider inset />
              <View className="gap-1 px-4 pb-1 pt-3">
                <Text variant="body" weight={600} tone="primary">
                  {translate("Siapa yang bisa memulai percakapan")}
                </Text>
                <Text variant="caption" tone="secondary">
                  {translate("Percakapan yang sudah ada tidak terpengaruh.")}
                </Text>
              </View>
              {DM_POLICY_OPTIONS.map((opt) => {
                const active = privacy.dmPolicy === opt.value
                return (
                  <PressableScale
                    key={opt.value}
                    onPress={() => void patchPrivacy({ dmPolicy: opt.value as DmPolicy })}
                    disabled={saving}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    accessibilityLabel={translate(opt.label)}
                    accessibilityHint={translate(opt.description)}
                    className="flex-row items-center gap-3 px-4 py-3"
                  >
                    <View className="min-w-0 flex-1">
                      <Text variant="body" weight={active ? 600 : 400} tone="primary">
                        {translate(opt.label)}
                      </Text>
                      <Text variant="caption" tone="secondary">
                        {translate(opt.description)}
                      </Text>
                    </View>
                    {active ? (
                      <Icon icon={CheckCircle} size={20} tone="active" weight="fill" />
                    ) : null}
                  </PressableScale>
                )
              })}
            </Card>
          )}
        </View>

        {/* ── Grup 2: Balasan cepat ───────────────────────────────────── */}
        <ReplyTemplateManager />
      </View>
    </Screen>
  )
}

function ReplyTemplateManager() {
  const toast = useToast()
  const { templates, loading, error, refresh } = useReplyTemplates()
  const [shortcut, setShortcut] = useState("")
  const [draft, setDraft] = useState("")
  const [editing, setEditing] = useState<ChatReplyTemplate | null>(null)
  const [busy, setBusy] = useState(false)
  /** Form tertutup sampai diminta (atau otomatis terbuka saat mengubah). */
  const [formOpen, setFormOpen] = useState(false)

  const validation = validateTemplateInput(shortcut, draft)
  // FRM-013: tempel pesan validasi ke field penyebabnya — pesan lib selalu
  // diawali nama field ("Shortcut …" / "Isi template …"), tanpa ubah logikanya.
  const anyTouched = shortcut.length > 0 || draft.length > 0
  const shortcutError =
    !validation.ok && anyTouched && validation.message.startsWith("Shortcut")
      ? validation.message
      : undefined
  const draftError =
    !validation.ok && anyTouched && validation.message.startsWith("Isi template")
      ? validation.message
      : undefined

  const closeForm = () => {
    setFormOpen(false)
    setEditing(null)
    setShortcut("")
    setDraft("")
  }

  const openCreate = () => {
    setEditing(null)
    setShortcut("")
    setDraft("")
    setFormOpen(true)
  }

  const openEdit = (t: ChatReplyTemplate) => {
    setEditing(t)
    setShortcut(t.shortcut)
    setDraft(t.text)
    setFormOpen(true)
  }

  const save = async () => {
    if (busy) return
    if (!validation.ok) {
      toast.show({
        title: translate("Template tidak valid"),
        description: validation.message,
        tone: "danger",
      })
      return
    }
    setBusy(true)
    try {
      if (editing) {
        await editReplyTemplate(editing.id, {
          shortcut: normalizeTemplateShortcut(shortcut),
          text: draft.trim(),
        })
      } else {
        await addReplyTemplate(shortcut, draft)
      }
      closeForm()
      await refresh()
      toast.show({
        title: editing ? translate("Template diperbarui") : translate("Template ditambahkan"),
        tone: "success",
        duration: 2500,
      })
    } catch (err) {
      logWarn("chat:settings-template-save", err)
      // Klasifikasi toast: error mutasi non-blokir via showMutationError.
      if (
        showMutationError(toast.show, {
          failTitle: translate("Gagal menyimpan template"),
          uncertainHint: translate("Aksi mungkin sudah diproses — memuat ulang…"),
          err: err,
          scope: "chat:settings:menyimpan-template",
        })
      ) {
        void refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  const remove = async (t: ChatReplyTemplate) => {
    try {
      await removeReplyTemplate(t.id)
      await refresh()
    } catch (err) {
      logWarn("chat:settings-template-remove", err)
      // Klasifikasi toast: error mutasi non-blokir via showMutationError.
      if (
        showMutationError(toast.show, {
          failTitle: translate("Gagal menghapus template"),
          uncertainHint: translate("Aksi mungkin sudah diproses — memuat ulang…"),
          err: err,
          scope: "chat:settings:menghapus-template",
        })
      ) {
        void refresh()
      }
    }
  }

  const items = useMemo(() => templates ?? [], [templates])

  return (
    <View className="gap-2">
      <SectionHeader
        title={translate("Balasan cepat")}
        subtitle={translate("Ketik “/” di kolom pesan untuk memakainya.")}
      />
      {loading || templates === null ? (
        <View className="items-center py-4">
          <Spinner />
        </View>
      ) : error ? (
        /* UX-FDB-003: kegagalan muat DIBEDAKAN dari "belum ada template". */
        <ErrorState
          compact
          title={translate("Gagal memuat template")}
          description={error}
          onRetry={() => void refresh()}
        />
      ) : items.length === 0 && !formOpen ? (
        <EmptyState
          compact
          icon={Plus}
          title={translate("Belum ada template")}
          description={translate("Simpan kalimat yang sering dipakai agar tidak mengetik ulang.")}
          action={
            <Button fullWidth={false} onPress={openCreate}>
              {translate("Buat template")}
            </Button>
          }
        />
      ) : (
        <>
          {items.length > 0 ? (
            <Card padded={false} className="overflow-hidden">
              {items.map((t, index) => (
                <View key={t.id}>
                  {index > 0 ? <Divider inset /> : null}
                  <View className="flex-row items-center gap-3 px-4 py-3">
                    <View className="min-w-0 flex-1">
                      <Text variant="caption" weight={700} tone="info">
                        /{t.shortcut}
                      </Text>
                      <Text variant="body" tone="primary" numberOfLines={2}>
                        {t.text}
                      </Text>
                    </View>
                    <IconButton
                      icon={PencilSimple}
                      size="sm"
                      variant="ghost"
                      accessibilityLabel={translate("Ubah template /{x}", { x: t.shortcut })}
                      onPress={() => openEdit(t)}
                    />
                    <IconButton
                      icon={Trash}
                      size="sm"
                      variant="ghost"
                      accessibilityLabel={translate("Hapus template /{x}", { x: t.shortcut })}
                      onPress={() => void remove(t)}
                    />
                  </View>
                </View>
              ))}
            </Card>
          ) : null}

          {formOpen ? (
            <Card padded={false} className="gap-3 p-4">
              <View className="flex-row items-center justify-between">
                <Text variant="body" weight={600} tone="primary">
                  {editing
                    ? translate("Ubah /{x}", { x: editing.shortcut })
                    : translate("Template baru")}
                </Text>
                <IconButton
                  icon={X}
                  size="sm"
                  variant="ghost"
                  accessibilityLabel={translate("Tutup form template")}
                  onPress={closeForm}
                />
              </View>
              <Input
                value={shortcut}
                onChangeText={(v) => setShortcut(v.slice(0, 32))}
                // FRM-013: label visual (bukan hanya placeholder/a11y).
                label={translate("Shortcut")}
                errorText={shortcutError}
                placeholder={translate("huruf kecil, angka, _")}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={translate("Shortcut template")}
              />
              <Input
                value={draft}
                onChangeText={(v) => setDraft(v.slice(0, REPLY_TEMPLATE_TEXT_MAX))}
                label={translate("Isi template")}
                errorText={draftError}
                placeholder={translate("Tulis kalimat yang sering Anda pakai")}
                multiline
                accessibilityLabel={translate("Isi template")}
              />
              {!validation.ok && (shortcut || draft) ? (
                <Text variant="caption" tone="danger">
                  {validation.message}
                </Text>
              ) : null}
              <Button
                fullWidth
                loading={busy}
                disabled={!validation.ok}
                onPress={() => void save()}
                accessibilityLabel={
                  editing ? translate("Simpan perubahan") : translate("Tambah template")
                }
              >
                {editing ? translate("Simpan perubahan") : translate("Tambah template")}
              </Button>
            </Card>
          ) : (
            <PressableScale
              onPress={openCreate}
              accessibilityRole="button"
              accessibilityLabel={translate("Buat template")}
              className="flex-row items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-3"
            >
              <Icon icon={Plus} size="sm" tone="default" />
              <Text variant="body" weight={500} tone="primary">
                {translate("Buat template")}
              </Text>
            </PressableScale>
          )}
        </>
      )}
      <Text variant="caption" tone="secondary">
        {translate("Maksimum {x} template per akun.", { x: REPLY_TEMPLATE_MAX })}
      </Text>
    </View>
  )
}
