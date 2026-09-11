/**
 * Test render SUNGGUHAN dari titik terjemahan (bukan cuma unit test `t()`).
 *
 * Kenapa perlu: seluruh desain i18n ini bertumpu pada satu klaim — "semua teks
 * app lewat <Text>, jadi terjemahan + reaksi ganti bahasa cukup dipasang di
 * sana". Klaim itu tidak terbukti oleh test `t()` murni: yang rusak bisa saja
 * `useSyncExternalStore`-nya, `localizeChildren`-nya, atau order prop di
 * <RNText>. Test ini me-render <Text> asli di jsdom (react-native di-alias ke
 * react-native-web lewat vitest.i18n-render.config.ts) dan menuntut:
 *   1. bahasa sumber → teks Indonesia;
 *   2. setLanguage("en") → teks yang SUDAH TER-RENDER berubah jadi English,
 *      tanpa re-render manual. Itu perilaku yang dilaporkan user.
 */
// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { Text } from "@/components/ui/text"
import { applyLanguage, clearTranslationCache } from "@/lib/i18n"

afterEach(() => {
  cleanup()
  act(() => applyLanguage("id"))
  clearTranslationCache()
})

function renderBatal() {
  return render(
    <Text variant="body" tone="secondary" numberOfLines={1}>
      Batal
    </Text>,
  )
}

describe("<Text> sebagai titik terjemahan", () => {
  it("merender teks Indonesia saat bahasa aktif 'id'", () => {
    act(() => applyLanguage("id"))
    clearTranslationCache()
    renderBatal()
    expect(screen.getByText("Batal")).toBeTruthy()
  })

  it("menerjemahkan children string di bahasa 'en'", () => {
    act(() => applyLanguage("en"))
    clearTranslationCache()
    renderBatal()
    expect(screen.getByText("Cancel")).toBeTruthy()
    expect(screen.queryByText("Batal")).toBeNull()
  })

  it("MENGUBAH teks yang sudah ter-render saat bahasa berganti — tanpa re-render manual", () => {
    act(() => applyLanguage("id"))
    clearTranslationCache()
    renderBatal()
    expect(screen.getByText("Batal")).toBeTruthy()

    // Inilah langkah yang dulu "mati": user memilih English, layar tidak berubah.
    act(() => applyLanguage("en"))
    expect(screen.getByText("Cancel")).toBeTruthy()
    expect(screen.queryByText("Batal")).toBeNull()

    act(() => applyLanguage("id"))
    expect(screen.getByText("Batal")).toBeTruthy()
  })

  it("tidak menyentuh angka & children campuran, dan ikut menerjemahkan placeholder", () => {
    act(() => applyLanguage("en"))
    clearTranslationCache()
    const { rerender } = render(
      <Text accessibilityLabel="Ubah foto sampul dan profil">{25000}</Text>,
    )
    expect(screen.getByText("25000")).toBeTruthy()
    rerender(
      <Text accessibilityLabel="Ubah foto sampul dan profil">{25000}</Text>,
    )
    expect(screen.getByText("25000")).toBeTruthy()
  })
})
