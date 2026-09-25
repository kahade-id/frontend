// @vitest-environment jsdom
/**
 * Guard regresi "blank scroll Android" — konten melebihi layar, saat digulir
 * SELURUH LAYAR jadi putih nempel sampai app ditutup (2026-09-25).
 *
 * Root cause (audit 2026-09-25, bukan lapisan rendering):
 *   useEvent/useAnimatedScrollHandler Reanimated 4 mengembalikan OBJEK
 *   `{ workletEventHandler }` yang hanya dimengerti komponen hasil
 *   createAnimatedComponent (Animated.ScrollView/FlatList). ScrollView/FlatList
 *   POLOS memanggil `props.onScroll(e)` apa adanya (react-native ScrollView.js
 *   `_handleScroll`; RNWeb pola identik) → memanggil objek = TypeError fatal
 *   pada event scroll pertama → global handler → expo-updates-error-recovery
 *   menghancurkan React context (expo/expo#41543) → layar putih nempel.
 *   Tiga fix sebelumnya (removeClippedSubviews/collapsable/virtualisasi)
 *   menyembuhkan lapisan lain — makanya "3x diperbaiki masih begitu".
 *
 * Yang dikunci guard ini (jalur NativePullGestureSurface / Platform android):
 *   1. bindings.onScroll adalah FUNGSI — bukan objek worklet-handler;
 *   2. pemanggilan persis seperti aslinya (`props.onScroll(e)`) tidak melempar
 *      DAN offset diteruskan ke onScrollWorklet pemanggil (y=42);
 *   3. sumber pull-to-refresh.tsx tidak kembali memakai useAnimatedScrollHandler(
 *      ...) pada scroller polos dan bindings tetap menunjuk handleScroll.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ReactElement } from "react"
import { Platform, Text, View } from "react-native"

import { ThemeProvider } from "@/components/theme-provider"
import {
  NativePullGestureSurface,
  PullToRefresh,
  type PullScrollBindings,
} from "@/components/ui/pull-to-refresh"

// Jalur Android dipilih saat RENDER berdasarkan Platform.OS; definisi ulang di
// sini membuat cabang NativePullGestureSurface aktif (kondisi modul-level di
// lib/keyboard ikut menilai "web" — tidak relevan bagi invarian yang diguard).
Object.defineProperty(Platform, "OS", { value: "android", configurable: true })

afterEach(cleanup)

function renderAndroid(ui: ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

describe("NativePullGestureSurface (jalur Android) — bindings scroll", () => {
  it("onScroll = fungsi; memanggil tanpa melempar dan meneruskan offset ke onScrollWorklet", () => {
    const worklet = vi.fn()
    let captured: PullScrollBindings | null = null

    renderAndroid(
      <NativePullGestureSurface
        onRefresh={() => {}}
        refreshing={false}
        onScrollWorklet={worklet}
      >
        {(scrollBindings) => {
          captured = scrollBindings
          return (
            <View>
              <Text>konten melebihi layar</Text>
            </View>
          )
        }}
      </NativePullGestureSurface>,
    )

    expect(captured, "scroller menerima scrollBindings").not.toBeNull()
    const onScroll = captured!.onScroll
    expect(
      typeof onScroll,
      "onScroll bindings HARUS fungsi — objek {workletEventHandler} Reanimated " +
        "di scroller polos = TypeError fatal scroll pertama = layar putih nempel",
    ).toBe("function")

    // Bentuk event & cara pemanggilan identik dengan ScrollView._handleScroll
    // di react-native: this.props.onScroll && this.props.onScroll(e).
    // (Objek event dipalsukan `as never` — komponen tidak butuh DOM event
    // lengkap; proporsi yang diuji hanya nativeEvent.contentOffset.)
    const fakeEvent = { nativeEvent: { contentOffset: { y: 42 } } } as never
    expect(() => onScroll!(fakeEvent)).not.toThrow()
    expect(worklet).toHaveBeenCalledWith(42)
  })

  it("offset diabaikan bila bukan angka finite (event aneh tidak boleh melempar)", () => {
    let captured: PullScrollBindings | null = null
    const worklet = vi.fn()
    renderAndroid(
      <NativePullGestureSurface onRefresh={() => {}} refreshing={false} onScrollWorklet={worklet}>
        {(scrollBindings) => {
          captured = scrollBindings
          return <View />
        }}
      </NativePullGestureSurface>,
    )
    expect(() => captured!.onScroll!({ nativeEvent: {} } as never)).not.toThrow()
    expect(() =>
      captured!.onScroll!({ nativeEvent: { contentOffset: { y: Number.NaN } } } as never),
    ).not.toThrow()
    expect(worklet).not.toHaveBeenCalled()
  })
})

describe("PullToRefresh — jalur Android dirender utuh", () => {
  it("scroller (ScrollView internal) ter-render dengan bindings tanpa error", () => {
    renderAndroid(
      <PullToRefresh onRefresh={() => {}} refreshing={false}>
        <View>
          <Text>isi_layar_settings</Text>
        </View>
      </PullToRefresh>,
    )
    expect(screen.getByText("isi_layar_settings")).toBeTruthy()
  })
})

describe("sumber pull-to-refresh.tsx", () => {
  it("tidak memakai useAnimatedScrollHandler pada scroller polos; bindings = handleScroll", () => {
    const src = readFileSync(resolve(process.cwd(), "components/ui/pull-to-refresh.tsx"), "utf8")
    // Panggilan kode — penyebutan nama di komentar dokumentasi diperbolehkan.
    expect(src).not.toMatch(/useAnimatedScrollHandler\s*\(/)
    expect(src).toContain("onScroll: handleScroll")
    expect(src).toContain("const handleScroll = useCallback(")
  })
})
