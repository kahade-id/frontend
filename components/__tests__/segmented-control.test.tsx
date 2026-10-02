import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/use-reduced-motion", () => ({ useReducedMotion: () => false }))

import { SegmentedControl } from "@/components/ui/segmented-control"

afterEach(cleanup)

describe("<SegmentedControl>", () => {
  it("keeps radio accessibility and slides one shared indicator to the selected segment", () => {
    const onChange = vi.fn()
    const items = [
      { value: "buyer", label: "Pembeli" },
      { value: "seller", label: "Penjual" },
    ] as const
    const view = render(
      <SegmentedControl
        accessibilityLabel="Peran transaksi"
        items={items}
        value="seller"
        onChange={onChange}
      />,
    )
    const group = screen.getByRole("radiogroup", { name: "Peran transaksi" })
    expect(screen.getAllByRole("radio")).toHaveLength(2)
    expect(screen.getByRole("radio", { name: "Penjual" }).getAttribute("aria-checked")).toBe("true")

    const layoutHandler = (
      group as unknown as {
        __reactLayoutHandler?: (event: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => void
      }
    ).__reactLayoutHandler
    expect(layoutHandler).toBeTypeOf("function")
    act(() => {
      layoutHandler?.({ nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 44 } } })
    })
    const indicator = screen.getByTestId("segmented-control-indicator")
    expect(indicator.style.transform).toContain("translateX(97px)")

    view.rerender(
      <SegmentedControl
        accessibilityLabel="Peran transaksi"
        items={items}
        value="buyer"
        onChange={onChange}
      />,
    )
    expect(screen.getByRole("radio", { name: "Pembeli" }).getAttribute("aria-checked")).toBe("true")
    expect(screen.getByTestId("segmented-control-indicator").style.transform).toContain("translateX(0px)")

    fireEvent.click(screen.getByRole("radio", { name: "Penjual" }))
    expect(onChange).toHaveBeenCalledWith("seller")
  })
})
