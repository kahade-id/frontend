/**
 * Kahade — <ShowcaseHtmlView> + <ShowcaseHtmlDescriptionEditor>
 * (benefit 7 Kahade+, "custom etalase").
 *
 * Anggota Kahade+ aktif menulis deskripsi karya sebagai HTML ringan.
 * - <ShowcaseHtmlView>: me-render HTML yang SUDAH disanitasi
 *   (`sanitizeShowcaseHtml`) menjadi <Text> native — TIDAK PERNAH me-render
 *   HTML mentah. Aman dipakai untuk pratinjau maupun (nanti) tampilan detail.
 * - <ShowcaseHtmlDescriptionEditor>: textarea + toolbar sisip tag + pratinjau
 *   live. Dipakai di form create/edit etalase HANYA bila `isActive`.
 *   Pengguna biasa tetap memakai <TextArea> plaintext.
 */
import { useMemo, useState } from "react"
import { Linking, Pressable, View } from "react-native"
import { LinkSimple, ListBullets, ListNumbers, TextB, TextItalic, TextUnderline } from "phosphor-react-native"

import { IconButton } from "@/components/ui/icon-button"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { translate } from "@/lib/i18n/translate"
import {
  parseShowcaseHtmlBlocks,
  sanitizeShowcaseHtml,
  type ShowcaseHtmlBlock,
  type ShowcaseHtmlSegment,
} from "@/lib/showcase-html"
import { logWarn } from "@/lib/telemetry"
import { tokens } from "@/lib/tokens"

function SegmentText({ segment }: { segment: ShowcaseHtmlSegment }) {
  const inner = (
    <Text
      variant="inherit"
      style={{
        fontWeight: segment.bold ? "700" : undefined,
        fontStyle: segment.italic ? "italic" : undefined,
        textDecorationLine: [
          segment.underline ? "underline" : "",
          segment.strike ? "line-through" : "",
        ]
          .filter(Boolean)
          .join(" ") as "underline" | "line-through" | "underline line-through" | undefined,
      }}
    >
      {segment.text}
    </Text>
  )
  if (!segment.href) return inner
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={segment.href}
      onPress={() => {
        Linking.openURL(segment.href!).catch((error) => logWarn("showcase-html:open-link", error))
      }}
    >
      <Text variant="inherit" tone="info">
        {inner}
      </Text>
    </Pressable>
  )
}

function BlockView({ block }: { block: ShowcaseHtmlBlock }) {
  const body = (
    <Text variant="body" tone="primary">
      {block.segments.map((s, i) => (
        <SegmentText key={i} segment={s} />
      ))}
    </Text>
  )
  if (block.bullet === "ul") {
    return (
      <View className="flex-row gap-2" style={{ marginBottom: tokens.space[1] }}>
        <Text variant="body" tone="primary">
          {"\u2022"}
        </Text>
        <View className="flex-1">{body}</View>
      </View>
    )
  }
  if (block.bullet === "ol") {
    return (
      <View className="flex-row gap-2" style={{ marginBottom: tokens.space[1] }}>
        <Text variant="body" tone="primary" className="tabular-nums">
          {`${block.index ?? 1}.`}
        </Text>
        <View className="flex-1">{body}</View>
      </View>
    )
  }
  if (block.quote) {
    return (
      <View
        className="border-l-2 border-border pl-3"
        style={{ marginBottom: tokens.space[2] }}
      >
        <Text variant="body" tone="secondary">
          {block.segments.map((s, i) => (
            <SegmentText key={i} segment={s} />
          ))}
        </Text>
      </View>
    )
  }
  return <View style={{ marginBottom: tokens.space[2] }}>{body}</View>
}

/**
 * Render aman HTML deskripsi etalase. `html` disanitasi ulang di sini
 * (defense in depth) — pemanggil tidak perlu melakukannya dulu.
 */
export function ShowcaseHtmlView({ html }: { html: string }) {
  const blocks: ShowcaseHtmlBlock[] = useMemo(() => parseShowcaseHtmlBlocks(html), [html])
  if (blocks.length === 0) return null
  return (
    <View>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </View>
  )
}

export type ShowcaseHtmlDescriptionEditorProps = {
  label?: string
  value: string
  onChangeText: (text: string) => void
  maxLength?: number
  hint?: string
  disabled?: boolean
}

type InsertKind = "b" | "i" | "u" | "ul" | "ol" | "a"

const INSERT_SNIPPET: Record<InsertKind, string> = {
  b: "<b></b>",
  i: "<i></i>",
  u: "<u></u>",
  ul: "<ul>\n<li></li>\n</ul>",
  ol: "<ol>\n<li></li>\n</ol>",
  a: '<a href="https://"></a>',
}

/**
 * Editor deskripsi HTML untuk anggota Kahade+. Nilai yang disimpan adalah
 * HTML mentah ketikan user; sanitasi (`sanitizeShowcaseHtml`) dilakukan saat
 * pratinjau dan WAJIB diulang sebelum dikirim ke backend (lihat call site).
 */
export function ShowcaseHtmlDescriptionEditor({
  label,
  value,
  onChangeText,
  maxLength,
  hint,
  disabled,
}: ShowcaseHtmlDescriptionEditorProps) {
  const [previewOpen, setPreviewOpen] = useState(true)
  const sanitized = useMemo(() => sanitizeShowcaseHtml(value), [value])

  const insert = (kind: InsertKind) => {
    if (disabled) return
    onChangeText(`${value}${value && !value.endsWith("\n") ? "\n" : ""}${INSERT_SNIPPET[kind]}`)
  }

  const tools: { kind: InsertKind; icon: typeof TextB; label: string }[] = [
    { kind: "b", icon: TextB, label: translate("Tebal") },
    { kind: "i", icon: TextItalic, label: translate("Miring") },
    { kind: "u", icon: TextUnderline, label: translate("Garis bawah") },
    { kind: "ul", icon: ListBullets, label: translate("Daftar bullet") },
    { kind: "ol", icon: ListNumbers, label: translate("Daftar bernomor") },
    { kind: "a", icon: LinkSimple, label: translate("Tautan") },
  ]

  return (
    <View className="gap-2">
      <TextArea
        label={label ?? translate("Deskripsi")}
        value={value}
        onChangeText={onChangeText}
        maxLength={maxLength}
        rows={6}
        multiline
        disabled={disabled}
        placeholder={translate("Tulis deskripsi dengan format HTML ringan, mis. <b>tebal</b>, <i>miring</i>, <ul><li>daftar</li></ul>")}
        helperText={hint}
      />
      <View className="flex-row items-center gap-1">
        {tools.map((t) => (
          <IconButton
            key={t.kind}
            icon={t.icon}
            size="sm"
            variant="ghost"
            accessibilityLabel={t.label}
            disabled={disabled}
            onPress={() => insert(t.kind)}
          />
        ))}
        <View className="flex-1" />
        <Pressable
          accessibilityRole="button"
          onPress={() => setPreviewOpen((v) => !v)}
          hitSlop={8}
        >
          <Text variant="caption" weight={600} tone="info">
            {previewOpen ? translate("Sembunyikan pratinjau") : translate("Tampilkan pratinjau")}
          </Text>
        </Pressable>
      </View>
      {previewOpen ? (
        <View className="rounded-md border border-border bg-surface p-3">
          <Text variant="caption" weight={600} tone="tertiary" className="mb-2">
            {translate("Pratinjau")}
          </Text>
          <ShowcaseHtmlView html={sanitized} />
        </View>
      ) : null}
    </View>
  )
}
