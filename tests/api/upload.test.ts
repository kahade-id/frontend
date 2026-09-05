import { afterEach, expect, it, vi } from "vitest"
vi.mock("@/lib/api/client", () => ({ http: { post: vi.fn() }, seg: encodeURIComponent }))
import { uploadToPresignedUrl } from "@/lib/api/upload"
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
it("uses PUT and explicitly omits application cookies", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }))
  vi.stubGlobal("fetch", fetcher)
  const blob = new Blob(["image"], { type: "image/png" })
  await uploadToPresignedUrl({ url: "https://storage.example.test/upload" }, blob)
  expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
    method: "PUT",
    body: blob,
    credentials: "omit",
  })
})
it("supports signed POST fields with the file last and a browser-owned multipart boundary", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal("fetch", fetcher)
  await uploadToPresignedUrl(
    {
      url: "https://storage.example.test/upload",
      method: "POST",
      fields: { key: "test-key", policy: "test-policy" },
      headers: { "Content-Type": "multipart/form-data" },
    },
    new Blob(["image"]),
    "proof.png",
  )
  const init = fetcher.mock.calls[0][1]!
  expect(init.method).toBe("POST")
  expect(
    [...(init.body as unknown as { entries(): IterableIterator<[string, unknown]> }).entries()].map(
      ([key]) => key,
    ),
  ).toEqual(["key", "policy", "file"])
  expect(new Headers(init.headers).has("Content-Type")).toBe(false)
})
it("rejects insecure storage URLs before sending file data", async () => {
  const fetcher = vi.fn()
  vi.stubGlobal("fetch", fetcher)
  await expect(
    uploadToPresignedUrl({ url: "http://storage.example.test/upload" }, new Blob()),
  ).rejects.toMatchObject({ code: "VALIDATION" })
  expect(fetcher).not.toHaveBeenCalled()
})
it("times out even if an upload transport ignores abort", async () => {
  vi.useFakeTimers()
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  )
  const upload = uploadToPresignedUrl(
    { url: "https://storage.example.test/upload" },
    new Blob(),
    "file",
    100,
  )
  const result = expect(upload).rejects.toMatchObject({ code: "TIMEOUT" })
  await vi.advanceTimersByTimeAsync(100)
  await result
})
