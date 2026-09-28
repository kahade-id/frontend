/**
 * Kahade — Pengaturan chat (batch 43 FE-CHAT, 2026-09-28).
 *
 * Rute: /chat/settings (ROUTES.chatSettings).
 *
 *   - Privasi: sembunyikan centang baca (hideReadReceipts) + kebijakan DM
 *     (EVERYONE / FOLLOWING / NONE) — GET/PATCH /v1/chat/privacy.
 *   - Template balasan "/": kelola penuh (tersinkron backend).
 */
import { useEffect, useState } from "react"
import { Pressable, View } from "react-native"

import {
  DM_POLICY_OPTIONS,
  getChatPrivacy,
  updateChatPrivacy,
  type ChatPrivacySettings,
  type DmPolicy,
} from "@/lib/api/chat"
import { isApiError, userMessage } from "@/lib/api"
import { useHasSession } from "@/lib/guest-gate"
import { logWarn } from "@/lib/telemetry"

import { Screen } from "@/components/ui/screen"
import { GuestLoginPrompt } from "@/components/web-guest-gate"
import { Header } from "@/components/ui/header"
import { SectionHeader } from "@/components/ui/section"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"
import { Icon } from "@/components/ui/icon"
import { Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
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

export default function ChatSettingsScreen() {
  const toast = useToast()
  /** NAV-004: endpoint privasi/template semuanya auth-required — jangan
   *  menembak tanpa sesi (overlay web bisa me-mount layar ini). */
  const hasSession = useHasSession()
  const [privacy, setPrivacy] = useState<ChatPrivacySettings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!hasSession) return
    let alive = true
    getChatPrivacy()
      .then((p) => {
        if (alive) setPrivacy(p)
      })
      .catch((err: unknown) => {
        logWarn("chat:settings-privacy-load", err)
        if (alive)
          toast.show({
            title: "Gagal memuat pengaturan privasi",
            description: isApiError(err) ? userMessage(err) : undefined,
            tone: "danger",
          })
      })
    return () => {
      alive = false
    }
  }, [toast, hasSession])

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
      toast.show({
        title: "Gagal menyimpan",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setSaving(false)
    }
  }

  // NAV-004: tamu tidak melihat/mengubah pengaturan chat.
  if (!hasSession) {
    return (
      <Screen edges={["top"]} padded={false}>
        <Header title="Pengaturan chat" />
        <GuestLoginPrompt bare next="/chat/settings" />
      </Screen>
    )
  }

  return (
    // CHT-006: daftar template (maks 50) harus bisa di-scroll, dan form
    // "Template baru" di bawah tidak boleh tertutup keyboard.
    <Screen edges={["top"]} padded={false} scroll keyboardAvoiding>
      <Header title="Pengaturan chat" />
      <View className="gap-5 px-5 pb-8 pt-3">
        <View className="gap-3">
          <SectionHeader
            title="Privasi"
            subtitle="Berlaku untuk akun Anda di semua perangkat."
          />
          {privacy === null ? (
            <View className="items-center py-4">
              <Spinner />
            </View>
          ) : (
            <>
              <Switch
                value={privacy.hideReadReceipts}
                onChange={(v) => void patchPrivacy({ hideReadReceipts: v })}
                label="Sembunyikan centang baca"
                description="Orang lain tidak melihat tanda pesan telah Anda baca. Anda juga tidak melihat tanda baca mereka."
                disabled={saving}
              />
              <View className="gap-2">
                <Text variant="body" weight={600} tone="primary">
                  Siapa yang bisa mengirimi saya pesan langsung
                </Text>
                {DM_POLICY_OPTIONS.map((opt) => {
                  const active = privacy.dmPolicy === opt.value
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => void patchPrivacy({ dmPolicy: opt.value as DmPolicy })}
                      disabled={saving}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      className={`flex-row items-center gap-3 rounded-md border p-3 ${
                        active ? "border-primary bg-primary/10" : "border-border"
                      }`}
                    >
                      <View className="flex-1">
                        <Text variant="body" weight={active ? 700 : 400} tone="primary">
                          {opt.label}
                        </Text>
                        <Text variant="caption" tone="secondary">
                          {opt.description}
                        </Text>
                      </View>
                      {active ? (
                        <Icon icon={CheckCircle} size={20} tone="active" weight="fill" />
                      ) : null}
                    </Pressable>
                  )
                })}
              </View>
            </>
          )}
        </View>

        <ReplyTemplateManager />
      </View>
    </Screen>
  )
}

function ReplyTemplateManager() {
  const toast = useToast()
  const { templates, loading, refresh } = useReplyTemplates()
  const [shortcut, setShortcut] = useState("")
  const [draft, setDraft] = useState("")
  const [editing, setEditing] = useState<ChatReplyTemplate | null>(null)
  const [busy, setBusy] = useState(false)

  const validation = validateTemplateInput(shortcut, draft)

  const save = async () => {
    if (busy) return
    if (!validation.ok) {
      toast.show({ title: "Template tidak valid", description: validation.message, tone: "danger" })
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
      setShortcut("")
      setDraft("")
      setEditing(null)
      await refresh()
      toast.show({ title: editing ? "Template diperbarui" : "Template ditambahkan", tone: "success", duration: 2500 })
    } catch (err) {
      logWarn("chat:settings-template-save", err)
      toast.show({
        title: "Gagal menyimpan template",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
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
      toast.show({
        title: "Gagal menghapus template",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    }
  }

  return (
    <View className="gap-3">
      <SectionHeader
        title="Template balasan cepat"
        subtitle="Ketik “/” di kolom chat untuk memakai template. Tersinkron ke akun Anda."
      />
      {loading || templates === null ? (
        <View className="items-center py-4">
          <Spinner />
        </View>
      ) : templates.length === 0 && !editing ? (
        <EmptyState
          icon={Plus}
          title="Belum ada template"
          description="Buat template pertama di bawah."
          compact
        />
      ) : (
        <View className="gap-2">
          {templates.map((t) => (
            <View
              key={t.id}
              className="flex-row items-center gap-2 rounded-md border border-border bg-surface p-3"
            >
              <View className="flex-1">
                <Text variant="caption" weight={700} tone="info">
                  /{t.shortcut}
                </Text>
                <Text variant="body" tone="primary" numberOfLines={3}>
                  {t.text}
                </Text>
              </View>
              <IconButton
                icon={PencilSimple}
                size="sm"
                variant="ghost"
                accessibilityLabel={`Ubah template /${t.shortcut}`}
                onPress={() => {
                  setEditing(t)
                  setShortcut(t.shortcut)
                  setDraft(t.text)
                }}
              />
              <IconButton
                icon={Trash}
                size="sm"
                variant="ghost"
                accessibilityLabel={`Hapus template /${t.shortcut}`}
                onPress={() => void remove(t)}
              />
            </View>
          ))}
        </View>
      )}

      <View className="gap-2 rounded-md border border-border p-3">
        <View className="flex-row items-center justify-between">
          <Text variant="body" weight={700} tone="primary">
            {editing ? `Ubah /${editing.shortcut}` : "Template baru"}
          </Text>
          {editing ? (
            <IconButton
              icon={X}
              size="sm"
              variant="ghost"
              accessibilityLabel="Batal mengubah"
              onPress={() => {
                setEditing(null)
                setShortcut("")
                setDraft("")
              }}
            />
          ) : null}
        </View>
        <Input
          value={shortcut}
          onChangeText={(v) => setShortcut(v.slice(0, 32))}
          placeholder="/shortcut (huruf kecil, angka, _)"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Shortcut template"
        />
        <Input
          value={draft}
          onChangeText={(v) => setDraft(v.slice(0, REPLY_TEMPLATE_TEXT_MAX))}
          placeholder="Isi template…"
          multiline
          accessibilityLabel="Isi template"
        />
        {!validation.ok && (shortcut || draft) ? (
          <Text variant="caption" tone="danger">
            {validation.message}
          </Text>
        ) : null}
        <Pressable
          onPress={() => void save()}
          disabled={busy || !validation.ok}
          accessibilityRole="button"
          accessibilityLabel={editing ? "Simpan perubahan" : "Tambah template"}
          className={`items-center rounded-sm py-2.5 ${busy || !validation.ok ? "bg-surface" : "bg-primary"}`}
        >
          <Text variant="body" weight={700} tone={busy || !validation.ok ? "secondary" : "inverse"}>
            {busy ? "Menyimpan…" : editing ? "Simpan perubahan" : "Tambah template"}
          </Text>
        </Pressable>
      </View>
      <Text variant="caption" tone="secondary">
        Maksimum 50 template per akun.
      </Text>
    </View>
  )
}
