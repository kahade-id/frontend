/**
 * Kahade — <QuickReplyPicker> (item 23, 2026-09-28).
 *
 * Panel yang muncul di atas composer saat teks diawali "/" — daftar template
 * balasan cepat yang bisa dipilih; memilih memasukkan teks template ke
 * composer (mengganti token "/..."). Mode "Kelola" untuk tambah/ubah/hapus
 * template custom (per perangkat, lihat lib/quick-replies.ts).
 *
 * Panel dirender absolute di dalam container <ChatComposer> (relative) —
 * bukan overlay global: posisinya menempel composer dan hilang bersama
 * keyboard/blur karena pemanggil menutupnya begitu teks tidak lagi diawali
 * "/".
 */
import { Plus, Trash, X } from "phosphor-react-native"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ScrollView, TextInput, View } from "react-native"

import { IconButton } from "@/components/ui/icon-button"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { useTheme } from "@/components/theme-provider"
import { tokens } from "@/lib/tokens"
import { translate, useLanguage } from "@/lib/i18n"
import {
  addQuickReply,
  filterQuickReplies,
  loadQuickReplies,
  QUICK_REPLY_MAX,
  removeQuickReply,
  updateQuickReply,
  type QuickReplyTemplate,
} from "@/lib/quick-replies"

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
  const [templates, setTemplates] = useState<QuickReplyTemplate[] | null>(null)
  const [manage, setManage] = useState(false)
  const [draft, setDraft] = useState("")
  const [editing, setEditing] = useState<QuickReplyTemplate | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setTemplates(await loadQuickReplies())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const matches = useMemo(
    () => (templates ? filterQuickReplies(templates, query) : []),
    [templates, query],
  )

  const saveDraft = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      if (editing) await updateQuickReply(editing.id, draft)
      else await addQuickReply(draft)
      setDraft("")
      setEditing(null)
      await refresh()
      toast.show({
        title: translate(editing ? "Template diperbarui" : "Template ditambahkan"),
        description: translate("Template tersimpan di perangkat ini."),
        tone: "success",
        duration: 2500,
      })
    } catch (err: unknown) {
      toast.show({
        title: translate("Gagal menyimpan template"),
        description: err instanceof Error ? err.message : undefined,
        tone: "danger",
      })
    } finally {
      setBusy(false)
    }
  }, [busy, draft, editing, refresh, toast.show])

  const handleRemove = useCallback(
    async (t: QuickReplyTemplate) => {
      try {
        await removeQuickReply(t.id)
        await refresh()
      } catch {
        toast.show({ title: translate("Gagal menghapus template"), tone: "danger" })
      }
    },
    [refresh, toast.show],
  )

  return (
    <View
      className="absolute bottom-full left-0 right-0 mb-2"
      style={{ maxHeight: 300 }}
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
          {templates === null ? (
            <View className="px-4 py-3">
              <Text variant="caption" tone="secondary">
                {translate("Memuat template…")}
              </Text>
            </View>
          ) : manage ? (
            templates
              .filter((t) => !t.builtin)
              .map((t) => (
                <View key={t.id} className="flex-row items-center gap-2 px-4 py-2">
                  <PressableScale
                    className="min-w-0 flex-1"
                    accessibilityRole="button"
                    accessibilityLabel={translate("Ubah template")}
                    onPress={() => {
                      setEditing(t)
                      setDraft(t.text)
                    }}
                  >
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
                accessibilityLabel={t.text}
                onPress={() => onSelect(t.text)}
              >
                <Text variant="body" tone="primary" numberOfLines={2}>
                  {highlightMatch(t.text, query)}
                </Text>
              </PressableScale>
            ))
          )}
        </ScrollView>

        {manage ? (
          <View className="gap-2 border-t border-border p-3">
            <View className="flex-row items-center gap-2 rounded-sm border border-border-control px-3">
              <TextInput
                value={draft}
                onChangeText={(v) => setDraft(v.slice(0, QUICK_REPLY_MAX))}
                placeholder={translate(editing ? "Ubah template…" : "Template baru…")}
                placeholderTextColor={palette.textSecondary}
                className="min-h-10 flex-1 py-2 font-sans-400 text-bodyLarge text-text-primary"
                multiline
                accessibilityLabel={translate("Teks template")}
              />
              <IconButton
                icon={Plus}
                size="sm"
                variant="primary"
                shape="pill"
                accessibilityLabel={translate("Simpan template")}
                disabled={busy || draft.trim().length === 0}
                loading={busy}
                onPress={() => void saveDraft()}
              />
            </View>
            <Text variant="caption" tone="secondary">
              {translate("Template tersimpan di perangkat ini saja. Sinkronisasi akun belum tersedia.")}
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
