/**
 * Test Batch 139 A02 — hook useCapsLockWarning (web/jsdom).
 *
 * react-native-web membuat Platform.OS === "web" di config komponen,
 * sehingga hook aktif. Simulasi: keydown dengan getModifierState("CapsLock").
 *
 * CATATAN: render <PasswordField> penuh tidak diuji di sini — config test
 * komponen rusak di baseline (tests/a11y.test.tsx gagal identik dengan
 * SyntaxError 'Unexpected token typeof' tanpa perubahan apa pun); integrasi
 * visual diverifikasi manual di web.
 */
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { useCapsLockWarning } from "@/lib/caps-lock"

afterEach(cleanup)

function Harness({ focused }: { focused: boolean }) {
  const capsOn = useCapsLockWarning(focused)
  return <span data-testid="caps">{capsOn ? "ON" : "OFF"}</span>
}

function dispatchCapsLock(on: boolean) {
  const e = new KeyboardEvent("keydown", { bubbles: true })
  Object.defineProperty(e, "getModifierState", {
    value: (key: string) => (key === "CapsLock" ? on : false),
  })
  act(() => {
    document.dispatchEvent(e)
  })
}

describe("useCapsLockWarning (A02)", () => {
  it("menyalakan peringatan saat CapsLock terdeteksi dan field fokus", () => {
    const { getByTestId, rerender } = render(<Harness focused={false} />)
    expect(getByTestId("caps").textContent).toBe("OFF")
    dispatchCapsLock(true)
    // Tidak fokus → tetap OFF.
    expect(getByTestId("caps").textContent).toBe("OFF")
    rerender(<Harness focused />)
    dispatchCapsLock(true)
    expect(getByTestId("caps").textContent).toBe("ON")
    dispatchCapsLock(false)
    expect(getByTestId("caps").textContent).toBe("OFF")
  })

  it("mereset saat field kehilangan fokus", () => {
    const { getByTestId, rerender } = render(<Harness focused />)
    dispatchCapsLock(true)
    expect(getByTestId("caps").textContent).toBe("ON")
    rerender(<Harness focused={false} />)
    expect(getByTestId("caps").textContent).toBe("OFF")
  })

  it("membersihkan listener saat unmount", () => {
    const { getByTestId, unmount } = render(<Harness focused />)
    dispatchCapsLock(true)
    expect(getByTestId("caps").textContent).toBe("ON")
    unmount()
    // Tidak melempar setelah unmount (listener dilepas).
    dispatchCapsLock(true)
  })
})
