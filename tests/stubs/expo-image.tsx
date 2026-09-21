/**
 * Stub `expo-image` untuk Vitest (config komponen) — <img> polos sudah
 * cukup untuk test yang mengunci teks/perilaku, bukan decode gambar.
 */
import React from "react"
import type { ReactNode } from "react"

type Source = { uri?: string } | { uri?: string }[] | number | undefined

function firstUri(source: Source): string | undefined {
  if (Array.isArray(source)) return source[0]?.uri
  if (source && typeof source === "object") return source.uri
  return undefined
}

export type ImageProps = {
  source?: Source
  testID?: string
  accessibilityLabel?: string
  alt?: string
  style?: unknown
  children?: ReactNode
  [key: string]: unknown
}

export function Image({ source, testID, accessibilityLabel, alt }: ImageProps) {
  return React.createElement("img", {
    src: firstUri(source) ?? "",
    "data-testid": testID,
    "aria-label": accessibilityLabel,
    alt: alt ?? "",
  })
}

export default { Image }
