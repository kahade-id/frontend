/**
 * Kahade — <QuickReplyPicker> (revisi batch 43 FE-CHAT, 2026-09-28).
 *
 * Panel yang muncul di atas composer saat teks diawali "/" — daftar template
 * balasan cepat yang bisa dipilih; memilih memasukkan teks template ke
 * composer (mengganti token "/...").
 *
 * REVISI dari versi per-perangkat (item 23): template kini TERSINKRON
 * backend (GET/POST/PATCH/DELETE /v1/chat/reply-templates) via
 * `lib/reply-templates.ts` — ikut akun, sinkron antar perangkat. Backend
 * mewajibkan `shortcut` (huruf kecil/angka/underscore, ≤32) + `text`
 * (≤500); mode Kelola meminta keduanya. Maksimum 50 template.
 *
 * Panel dirender absolute di dalam container <ChatComposer> (relative) —
 * bukan overlay global: posisinya menempel composer dan hilang bersama
 * keyboard/blur karena pemanggil menutupnya begitu teks tidak lagi diawali
 * "/".
 */
import { Plus, Trash, X } from "phosphor-react-native"
import { useCallback, useMemo, useState } from "react"
import { ScrollView, TextInput, View } from "react-native"

import { IconButton } from "@/components/ui/icon-button"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { useTheme } from "@/components/theme-provider"
import { tokens } from "@/lib/tokens"
import { translate, useLanguage } from "@/lib/i18n"
import {
  addReplyTemplate,
  editReplyTemplate,
  filterReplyTemplates,
  normalizeTemplateShortcut,
  removeReplyTemplate,
  useReplyTemplates,
  validateTemplateInput,
  REPLY_TEMPLATE_TEXT_MAX,
  type ChatReplyTemplate,
} from "@/lib/reply-templates"
import { isApiError, userMessage } from "@/lib/api"

/** Batas backend: maksimum 50 template per user. */
const REPLY_TEMPLATE_LIMIT = 50

export type QuickReplyPickerProps = {
  /** Teks setelah "/" — dipakai menyaring template. */
  query: string
  onSelect: (text: string) => void
  onClose: () => void
}

export function QuickReplyPicker({ query, onSelect, onClose }: QuickReplyPickerProps) {
  useLanguage()
  const toast = useToast()
  const { mode } = useTheme()
  const palette = tokens.colors[mode]
  const { templates, loading, refresh } = useReplyTemplates()
  const [manage, setManage] = useState(false)
  const [shortcut, setShortcut] = useState("")
  const [draft, setDraft] = useState("")
  const [editing, setEditing] = useState<ChatReplyTemplate | null>(null)
  const [busy, setBusy] = useState(false)

  const matches = useMemo(
    () => (templates ? filterReplyTemplates(templates, query) : []),
    [templates, query],
  )

  const validation = validateTemplateInput(shortcut, draft)

  const saveDraft = useCallback(async () => {
    if (busy || !validation.ok) {
      if (!validation.ok)
        toast.show({ title: translate("Template tidak valid"), description: validation.message, tone: "danger" })
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
      toast.show({
        title: translate(editing ? "Template diperbarui" : "Template ditambahkan"),
        description: translate("Template tersinkron ke akun Anda."),
        tone: "success",
        duration: 2500,
      })
    } catch (err: unknown) {
      toast.show({
        title: translate("Gagal menyimpan template"),
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setBusy(false)
    }
  }, [busy, validation, editing, shortcut, draft, refresh, toast])

  const handleRemove = useCallback(
    async (t: ChatReplyTemplate) => {
      try {
        await removeReplyTemplate(t.id)
        await refresh()
      } catch (err: unknown) {
        toast.show({
          title: translate("Gagal menghapus template"),
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      }
    },
    [refresh, toast],
  )

  const atLimit = (templates?.length ?? 0) >= REPLY_TEMPLATE_LIMIT

  return (
    <View
      className="absolute bottom-full left-0 right-0 mb-2"
      style={{ maxHeight: 320 }}
      accessibilityRole="menu"
      accessibilityLabel={translate("Template balasan cepat")}
    >
      <View className="overflow-hidden rounded-md border border-border-control bg-background shadow-lg">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-2">
          <Text variant="label" weight={600} tone="primary">
            {manage ? translate("Kelola template") : translate("Balasan cepat")}
          </Text>
          <View className="flex-row items-center gap-1">
            <IconButton
              icon={manage ? X : Plus}
              size="sm"
              variant="ghost"
              accessibilityLabel={manage ? translate("Tutup kelola") : translate("Kelola template")}
              onPress={() => {
                setManage((v) => !v)
                setEditing(null)
                setShortcut("")
                setDraft("")
              }}
            />
            <IconButton
              icon={X}
              size="sm"
              variant="ghost"
              accessibilityLabel={translate("Tutup template")}
              onPress={onClose}
            />
          </View>
        </View>

        <ScrollView
          style={{ maxHeight: 200 }}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="py-1"
        >
          {loading || templates === null ? (
            <View className="px-4 py-3">
              <Text variant="caption" tone="secondary">
                {translate("Memuat template…")}
              </Text>
            </View>
          ) : manage ? (
            templates.length === 0 ? (
              <View className="px-4 py-3">
                <Text variant="caption" tone="secondary">
                  {translate("Belum ada template. Tambahkan di bawah.")}
                </Text>
              </View>
            ) : (
              templates.map((t) => (
                <View key={t.id} className="flex-row items-center gap-2 px-4 py-2">
                  <PressableScale
                    className="min-w-0 flex-1"
                    accessibilityRole="button"
                    accessibilityLabel={translate("Ubah template")}
                    onPress={() => {
                      setEditing(t)
                      setShortcut(t.shortcut)
                      setDraft(t.text)
                    }}
                  >
                    <Text variant="caption" weight={700} tone="info" numberOfLines={1}>
                      /{t.shortcut}
                    </Text>
                    <Text variant="body" tone="primary" numberOfLines={2}>
                      {t.text}
                    </Text>
                  </PressableScale>
                  <IconButton
                    icon={Trash}
                    size="sm"
                    variant="ghost"
                    accessibilityLabel={translate("Hapus template")}
                    onPress={() => void handleRemove(t)}
                  />
                </View>
              ))
            )
          ) : matches.length === 0 ? (
            <View className="px-4 py-3">
              <Text variant="caption" tone="secondary">
                {translate("Tidak ada template yang cocok. Ketik untuk membuat baru lewat Kelola.")}
              </Text>
            </View>
          ) : (
            matches.map((t) => (
              <PressableScale
                key={t.id}
                className="px-4 py-2.5"
                accessibilityRole="menuitem"
                accessibilityLabel={`/${t.shortcut}: ${t.text}`}
                onPress={() => onSelect(t.text)}
              >
                <Text variant="caption" weight={700} tone="info" numberOfLines={1}>
                  /{t.shortcut}
                </Text>
                <Text variant="body" tone="primary" numberOfLines={2}>
                  {highlightMatch(t.text, query)}
                </Text>
              </PressableScale>
            ))
          )}
        </ScrollView>

        {manage ? (
          <View className="gap-2 border-t border-border p-3">
            <View className="flex-row items-center gap-2">
              <View className="w-28 rounded-sm border border-border-control px-3">
                <TextInput
                  value={shortcut}
                  onChangeText={(v) => setShortcut(v.slice(0, 32))}
                  placeholder="/shortcut"
                  placeholderTextColor={palette.textSecondary}
                  className="min-h-10 py-2 font-sans-400 text-bodyLarge text-text-primary"
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel={translate("Shortcut template")}
                />
              </View>
              <View className="flex-1 rounded-sm border border-border-control px-3">
                <TextInput
                  value={draft}
                  onChangeText={(v) => setDraft(v.slice(0, REPLY_TEMPLATE_TEXT_MAX))}
                  placeholder={translate(editing ? "Ubah template…" : "Template baru…")}
                  placeholderTextColor={palette.textSecondary}
                  className="min-h-10 py-2 font-sans-400 text-bodyLarge text-text-primary"
                  multiline
                  accessibilityLabel={translate("Teks template")}
                />
              </View>
              <IconButton
                icon={Plus}
                size="sm"
                variant="primary"
                shape="pill"
                accessibilityLabel={translate("Simpan template")}
                disabled={busy || !validation.ok || (!editing && atLimit)}
                loading={busy}
                onPress={() => void saveDraft()}
              />
            </View>
            <Text variant="caption" tone="secondary">
              {atLimit
                ? translate("Batas 50 template tercapai.")
                : translate("Shortcut: huruf kecil/angka/underscore. Tersinkron ke akun Anda.")}
            </Text>
          </View>
        ) : (
          <View className="border-t border-border px-4 py-2">
            <Text variant="caption" tone="secondary">
              {translate("Ketik \"/\" lalu kata kunci untuk menyaring.")}
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}

/** Sorot kecocokan kueri di dalam teks template (satu segmen, case-insensitive). */
function highlightMatch(text: string, query: string) {
  const q = query.trim()
  if (!q) return text
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx < 0) return text
  return (
    <>
      {text.slice(0, idx)}
      <Text variant="body" weight={700} tone="primary">
        {text.slice(idx, idx + q.length)}
      </Text>
      {text.slice(idx + q.length)}
    </>
  )
}
