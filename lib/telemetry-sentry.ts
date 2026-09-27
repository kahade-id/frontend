/**
 * Kahade — sink telemetri produksi (G476 audit 2026-09-26).
 *
 * Didaftarkan di entry point (`app/_layout.tsx`) lewat `installSentrySink()`,
 * TETAPI default-nya AMAN: tanpa `EXPO_PUBLIC_SENTRY_DSN`, fungsi ini tidak
 * mendaftarkan apa pun dan tidak ada satu byte pun yang meninggalkan
 * perangkat (kontrak yang sama dengan remote sink bawaan telemetry.ts).
 *
 * Bila DSN diisi, sink mengirim event yang SUDAH diredaksi (redaksi terjadi
 * di `dispatch()` sebelum sink dipanggil) sebagai envelope Sentry minimal
 * ke endpoint `/api/<projectId>/envelope/` — tanpa menambah dependensi SDK
 * (keputusan non-obvious telemetry.ts: tanpa dependensi baru).
 *
 * Format DSN: `https://<publicKey>@<host>/<projectId>`
 * Env opsional: `EXPO_PUBLIC_SENTRY_ENVIRONMENT` (default "production"),
 * `EXPO_PUBLIC_SENTRY_SAMPLE_ERRORS` (default "1" = semua error).
 */

import { addTelemetrySink, type TelemetryEvent } from "@/lib/telemetry"

const SINK_CLIENT = "kahade-telemetry/1.0"

type ParsedDsn = { host: string; projectId: string; publicKey: string; protocol: string }

function parseDsn(dsn: string): ParsedDsn | null {
  const m = /^(https?):\/\/([^@]+)@([^/]+)\/(\d+)\/?$/.exec(dsn.trim())
  if (!m) return null
  return { protocol: m[1], publicKey: m[2], host: m[3], projectId: m[4] }
}

function uuid4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function toSentryLevel(level: TelemetryEvent["level"]): string {
  return level === "error" ? "error" : "warning"
}

async function sendEnvelope(dsn: ParsedDsn, event: TelemetryEvent, environment: string): Promise<void> {
  const eventId = uuid4().replace(/-/g, "")
  const envelopeHeader = JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() })
  const itemHeader = JSON.stringify({ type: "event" })
  const payload = JSON.stringify({
    event_id: eventId,
    timestamp: Math.floor(event.at / 1000),
    platform: "javascript",
    level: toSentryLevel(event.level),
    logger: `kahade/${event.scope}`,
    environment,
    release: event.appVersion ?? "unknown",
    tags: {
      "app.platform": event.platform ?? "unknown",
      ...(event.apiCode ? { "api.code": event.apiCode } : {}),
      ...(event.status ? { "http.status": String(event.status) } : {}),
      ...(event.path ? { "http.path": event.path } : {}),
    },
    exception: {
      values: [
        {
          type: event.errorName ?? "TelemetryEvent",
          // message SUDAH diredaksi di dispatch() — tidak ada PII di sini.
          value: event.message,
        },
      ],
    },
  })
  const body = `${envelopeHeader}\n${itemHeader}\n${payload}\n`
  const url = `${dsn.protocol}://${dsn.host}/api/${dsn.projectId}/envelope/`
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-sentry-envelope",
      "X-Sentry-Auth":
        `Sentry sentry_version=7, sentry_client=${SINK_CLIENT}, sentry_key=${dsn.publicKey}`,
    },
    body,
    keepalive: true,
  })
}

/**
 * Pasang sink produksi. Idempoten. Mengembalikan true bila sink aktif.
 * Tanpa DSN → false, tidak ada sink yang didaftarkan (default aman).
 */
export function installSentrySink(): boolean {
  const rawDsn = process.env.EXPO_PUBLIC_SENTRY_DSN
  if (!rawDsn) return false
  const dsn = parseDsn(rawDsn)
  if (!dsn) {
    if (__DEV__) console.warn("[kahade/telemetry-sentry] EXPO_PUBLIC_SENTRY_DSN tidak valid — sink tidak dipasang")
    return false
  }
  const environment = process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || "production"
  const sampleErrors = process.env.EXPO_PUBLIC_SENTRY_SAMPLE_ERRORS ?? "1"

  addTelemetrySink((event) => {
    // Sampling: hanya warn yang bisa di-skip; error selalu dikirim.
    if (event.level === "warn" && sampleErrors !== "1") return
    // Fire-and-forget: kegagalan kirim tidak boleh melahirkan telemetri baru.
    void sendEnvelope(dsn, event, environment).catch(() => undefined)
  })
  return true
}
