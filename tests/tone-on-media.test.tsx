// @vitest-environment jsdom
/**
 * VI-01 (audit etalase 2026-10-10): tone `onMedia` = putih di KEDUA mode.
 * `inverse` (primary-foreground) bernilai #000000 di dark mode → hitam di
 * atas scrim hitam `bg-overlay-media`. Ikon di atas scrim harus memakai
 * onMedia.
 */
import * as React from "react"
import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { useIconColor } from "@/components/ui/icon"
import { brand, modes } from "@/lib/tokens"

const h = React.createElement

describe("useIconColor onMedia", () => {
  it("light: onMedia putih; inverse = primary-foreground (hitam)", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => h(ThemeProvider, null, children)
    const onMedia = renderHook(() => useIconColor("onMedia"), { wrapper })
    const inverse = renderHook(() => useIconColor("inverse"), { wrapper })
    expect(onMedia.result.current).toBe(brand.white)
    expect(inverse.result.current).toBe(modes.light.primaryForeground)
  })

  it("nilai token: inverse di dark = #000000 (jebakan yang diperbaiki), onMedia tetap putih", () => {
    expect(modes.dark.primaryForeground).toBe("#000000")
    expect(brand.white).toBe("#FFFFFF")
  })
})
