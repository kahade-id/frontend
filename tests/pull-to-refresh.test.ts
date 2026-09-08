/**
 * Regression guard untuk insiden force-close PullToRefresh 2026-09-08.
 *
 * Komponen React Native tidak dapat di-mount oleh Vitest/jsdom karena paket
 * `react-native` yang terpasang berisi Flow source dan hanya diproses Metro.
 * Karena akar insiden adalah ARSITEKTUR input (state machine gesture kedua di
 * atas ScrollView), kontrak keselamatan dikunci langsung pada source. Test ini
 * sengaja melarang seluruh keluarga implementasi berisiko, bukan hanya satu
 * nama fungsi yang kebetulan memicu insiden terakhir.
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

const here = fileURLToPath(import.meta.url)
const source = readFileSync(
  resolve(here, "..", "..", "components", "ui", "pull-to-refresh.tsx"),
  "utf8",
)

// Hilangkan komentar agar penjelasan audit boleh menyebut API yang dilarang
// tanpa menghasilkan false positive.
const executable = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

describe("PullToRefresh — kontrak keselamatan scroll native", () => {
  it("memakai ScrollView + RefreshControl resmi React Native", () => {
    expect(executable).toMatch(/from ["']react-native["']/)
    expect(executable).toMatch(/<ScrollView\b/)
    expect(executable).toMatch(/<RefreshControl\b/)
    expect(executable).toMatch(/refreshControl=\{refreshControl\}/)
  })

  it("tidak memasang state machine gesture kedua di atas scroller", () => {
    expect(executable).not.toMatch(/react-native-gesture-handler/)
    expect(executable).not.toMatch(/\bGestureDetector\b|\bGesture\.(?:Pan|Native|Simultaneous)\b/)
    expect(executable).not.toMatch(/\bPanResponder\b|manualActivation|stateManager\.(?:activate|fail)/)
  })

  it("tidak menjalankan worklet/Reanimated pada setiap event scroll", () => {
    expect(executable).not.toMatch(/react-native-reanimated/)
    expect(executable).not.toMatch(/useAnimatedScrollHandler|useSharedValue|runOnJS|["']worklet["']/)
  })

  it("tidak pernah mengikat scrollEnabled ke loading/refreshing", () => {
    expect(executable).not.toMatch(/scrollEnabled\s*=|scrollLocked|setScrollEnabled/)
  })

  it("mematikan fitur, bukan scroll, ketika enabled=false", () => {
    expect(executable).toMatch(/if \(!enabled \|\| refreshing \|\| inFlight\.current\) return/)
    expect(executable).toMatch(/Platform\.OS !== ["']web["'] && \(enabled \|\| refreshing\)/)
  })

  it("mencegah pemanggilan ganda dan unhandled rejection", () => {
    expect(executable).toMatch(/inFlight\.current = true/)
    expect(executable).toMatch(/Promise\.resolve\(result\)/)
    expect(executable).toMatch(/\.catch\(\(\) => undefined\)/)
    expect(executable).toMatch(/\.finally\(\(\) =>/)
  })

  it("memasang refreshControl setelah spread props agar tidak bisa ditimpa", () => {
    const spreadAt = executable.indexOf("{...scrollViewProps}")
    const controlAt = executable.indexOf("refreshControl={refreshControl}")
    expect(spreadAt).toBeGreaterThan(-1)
    expect(controlAt).toBeGreaterThan(spreadAt)
  })
})
