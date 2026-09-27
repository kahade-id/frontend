import { describe, it, expect } from "vitest"
import "react"
import { AppState } from "react-native"
import { io } from "socket.io-client"
import { refreshAccessToken } from "@/lib/api/client"

describe("probe", () => {
  it("loads", () => {
    // Modul-modul inti harus bisa diimpor tanpa crash (probe integrasi).
    expect(AppState).toBeDefined()
    expect(io).toBeDefined()
    expect(refreshAccessToken).toBeDefined()
    expect(true).toBe(true)
  })
})
