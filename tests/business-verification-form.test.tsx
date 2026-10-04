import type { ReactNode } from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  preventRemove: null as ((event: { data: { action: unknown } }) => void) | null,
  dispatch: vi.fn(),
}))

vi.mock("expo-router", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigation: () => ({ dispatch: mocks.dispatch }),
  usePreventRemove: (
    prevent: boolean,
    listener: (event: { data: { action: unknown } }) => void,
  ) => {
    mocks.preventRemove = prevent ? listener : null
  },
}))

vi.mock("react-native", async () => {
  const React = await vi.importActual<typeof import("react")>("react")
  const actual = await vi.importActual<typeof import("react-native")>("react-native")
  return {
    ...actual,
    View: ({ children }: { children?: ReactNode }) => React.createElement("div", null, children),
    TextInput: () => React.createElement("input"),
  }
})

vi.mock("@/lib/api", () => ({ api: {}, userMessage: () => "Gagal" }))
vi.mock("@/lib/api/business-verification", () => ({
  toBusinessVerificationUiStatus: (status: string | null | undefined) => status ?? "NOT_SUBMITTED",
}))
vi.mock("@/lib/use-api-query", () => ({
  useApiQuery: () => ({
    data: {
      state: { status: "NOT_SUBMITTED", latestRequest: null },
      history: [],
    },
    loading: false,
    error: null,
    refreshing: false,
    refresh: vi.fn(),
    reload: vi.fn(),
  }),
}))
vi.mock("@/lib/image-picker", () => ({ pickImage: vi.fn() }))
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ show: vi.fn(), dismiss: vi.fn(), dismissAll: vi.fn() }),
}))

vi.mock("@/components/ui/data-screen", async () => {
  const React = await vi.importActual<typeof import("react")>("react")
  return {
    DataScreen: (props: { keyboardAvoiding?: boolean; children?: ReactNode }) =>
      React.createElement(
        "div",
        {
          "data-testid": "data-screen",
          "data-keyboard-avoiding": String(Boolean(props.keyboardAvoiding)),
        },
        props.children,
      ),
  }
})
vi.mock("@/components/ui/form-section", async () => {
  const React = await vi.importActual<typeof import("react")>("react")
  return { FormSection: ({ children }: { children?: ReactNode }) => React.createElement("section", null, children) }
})
vi.mock("@/components/ui/field", async () => {
  const React = await vi.importActual<typeof import("react")>("react")
  return {
    Field: ({ label, children }: { label: string; children?: ReactNode }) =>
      React.createElement("label", null, label, children),
  }
})
vi.mock("@/components/ui/input", async () => {
  const React = await vi.importActual<typeof import("react")>("react")
  return {
    Input: (props: { value: string; onChangeText: (value: string) => void }) =>
      React.createElement("input", {
        value: props.value,
        onChange: (event: { target: { value: string } }) => props.onChangeText(event.target.value),
      }),
  }
})
vi.mock("@/components/ui/button", async () => {
  const React = await vi.importActual<typeof import("react")>("react")
  return {
    Button: (props: {
      children?: ReactNode
      onPress?: () => void
      disabled?: boolean
      loading?: boolean
      accessibilityLabel?: string
    }) => React.createElement(
      "button",
      {
        type: "button",
        disabled: props.disabled || props.loading,
        onClick: props.onPress,
        "aria-label": props.accessibilityLabel,
      },
      props.children,
    ),
  }
})
vi.mock("@/components/ui/modal", async () => {
  const React = await vi.importActual<typeof import("react")>("react")
  return {
    Dialog: (props: {
      visible: boolean
      title: string
      confirmLabel?: string
      cancelLabel?: string
      onConfirm?: () => void
      onCancel?: () => void
    }) => props.visible
      ? React.createElement("div", null,
          React.createElement("p", null, props.title),
          React.createElement("button", { type: "button", onClick: props.onConfirm }, props.confirmLabel),
          React.createElement("button", { type: "button", onClick: props.onCancel }, props.cancelLabel),
        )
      : null,
  }
})
vi.mock("@/components/ui/kyc-status-card", async () => {
  const React = await vi.importActual<typeof import("react")>("react")
  return {
    KycStatusCard: (props: { onSubmit?: () => void; onResubmit?: () => void }) =>
      React.createElement("button", { type: "button", onClick: props.onSubmit ?? props.onResubmit }, "Verifikasi bisnis"),
  }
})
vi.mock("@/components/ui/text", async () => {
  const React = await vi.importActual<typeof import("react")>("react")
  return { Text: ({ children }: { children?: ReactNode }) => React.createElement("span", null, children) }
})
vi.mock("@/components/ui/upload-field", async () => {
  const React = await vi.importActual<typeof import("react")>("react")
  return { UploadField: ({ label }: { label: string }) => React.createElement("button", null, label) }
})
vi.mock("@/components/ui/key-value", () => ({ KeyValue: () => null, KeyValueList: () => null }))
vi.mock("@/components/ui/kyc-history-list-item", () => ({ KycHistoryListItem: () => null }))
vi.mock("@/components/ui/route-link", () => ({ RouteLink: ({ children }: { children?: ReactNode }) => children }))
vi.mock("@/components/ui/section", async () => {
  const React = await vi.importActual<typeof import("react")>("react")
  return { SectionHeader: ({ title }: { title: string }) => React.createElement("h2", null, title) }
})

import BusinessVerificationScreen from "@/app/business-verification"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.preventRemove = null
})

afterEach(() => {
  cleanup()
})

describe("business verification form UX", () => {
  it("enables keyboard avoidance and confirms before discarding entered form data", () => {
    render(<BusinessVerificationScreen />)
    expect(screen.getByTestId("data-screen").getAttribute("data-keyboard-avoiding")).toBe("true")

    fireEvent.click(screen.getByRole("button", { name: "Verifikasi bisnis" }))
    const businessName = screen.getByLabelText("Nama badan usaha") as HTMLInputElement
    fireEvent.change(businessName, { target: { value: "PT Kahade" } })
    const browserClose = new Event("beforeunload", { cancelable: true })
    globalThis.dispatchEvent(browserClose)
    expect(browserClose.defaultPrevented).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: "Batal" }))
    expect(screen.getByText("Buang isian verifikasi?")).toBeTruthy()

    // Cancelling the warning preserves the user's form.
    fireEvent.click(screen.getByRole("button", { name: "Lanjutkan mengisi" }))
    expect(screen.queryByText("Buang isian verifikasi?")).toBeNull()
    expect((screen.getByLabelText("Nama badan usaha") as HTMLInputElement).value).toBe("PT Kahade")

    // Confirming the discard closes the form and clears the sensitive fields.
    fireEvent.click(screen.getByRole("button", { name: "Batal" }))
    fireEvent.click(screen.getByRole("button", { name: "Buang isian" }))
    expect(screen.queryByLabelText("Nama badan usaha")).toBeNull()
    expect(screen.getByRole("button", { name: "Verifikasi bisnis" })).toBeTruthy()
  })

  it("guards hardware/back navigation and dispatches the pending action only after confirmation", async () => {
    render(<BusinessVerificationScreen />)
    fireEvent.click(screen.getByRole("button", { name: "Verifikasi bisnis" }))
    fireEvent.change(screen.getByLabelText("Nama badan usaha"), {
      target: { value: "PT Kahade" },
    })

    const action = { type: "GO_BACK" }
    expect(mocks.preventRemove).toBeTypeOf("function")
    act(() => mocks.preventRemove?.({ data: { action } }))
    expect(screen.getByText("Buang isian verifikasi?")).toBeTruthy()
    expect(mocks.dispatch).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Buang isian" }))
    await waitFor(() => expect(mocks.dispatch).toHaveBeenCalledWith(action))
  })
})
