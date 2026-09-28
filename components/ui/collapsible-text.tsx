/**
 * Kahade — <CollapsibleText> teks yang dilipat setelah N baris.
 *
 * Dipakai deskripsi detail Etalase (mega-batch FE-IMP-1, item 152): deskripsi
 * panjang dilipat ke 4 baris dengan tautan "Selengkapnya"/"Tutup".
 *
 * Deteksi overflow memakai `onTextLayout` pada Text yang dibatasi
 * `numberOfLines` — bila jumlah baris ter-render mencapai batas, tombol
 * tampil. Teks yang pas ≤ batas tidak mendapat tombol sama sekali.
 */
import { useState } from "react"
import { View } from "react-native"

import { translate } from "@/lib/i18n/translate"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"

import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"

export type CollapsibleTextProps = {
  text: string
  /** Batas baris sebelum dilipat (default 4 — item 152). */
  maxLines?: number
  className?: string
}

export function CollapsibleText({ text, maxLines = 4, className }: CollapsibleTextProps) {
  const [expanded, setExpanded] = useState(false)
  const [renderedLines, setRenderedLines] = useState(0)
  // overflow ≈ baris ter-render menyentuh batas saat dilipat.
  const overflowing = renderedLines >= maxLines

  return (
    <View className={className}>
      <Text
        variant="body"
        tone="primary"
        weight={400}
        numberOfLines={expanded ? undefined : maxLines}
        onTextLayout={(event) => setRenderedLines(event.nativeEvent.lines.length)}
      >
        {text}
      </Text>
      {overflowing ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={expanded ? translate("Tutup deskripsi") : translate("Lihat deskripsi selengkapnya")}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((prev) => !prev)}
          containerClassName={cn("self-start rounded-sm", focusRing)}
          className="py-1"
        >
          <Text variant="body" tone="accent" weight={500}>
            {expanded ? translate("Tutup") : translate("Selengkapnya")}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  )
}
