#!/usr/bin/env node
/**
 * Kahade — audit kontrak BODY request terhadap DTO OpenAPI.
 *
 * Kenapa skrip ini ada (celah yang terbukti, bukan pencegahan):
 * `audit-inventory.mjs` hanya membandingkan METHOD + PATH. Akibatnya empat
 * kelas cacat lolos sampai ke pengguna dan baru ketahuan lewat audit manual
 * (docs/audit/API-ENDPOINT-AUDIT.md):
 *
 *   1. `POST /v1/auth/2fa/backup-codes/regenerate` — klien mengirim
 *      `{ password }`, spec mewajibkan `{ password, code }` → selalu 400,
 *      membuat-ulang kode cadangan mati total.
 *   2. `POST /v1/disputes/{id}/call/accept|reject|end` — spec
 *      `requestBody.required: true`, klien mengirim `undefined` → 400/415.
 *      (Cacat identik sudah lebih dulu ditemukan di `/v1/upload/cleanup`.)
 *   3. `POST /v1/wallet/withdraw/cancel` — klien mengirim `{ txId }`, spec
 *      tidak mendeklarasikan requestBody sama sekali.
 *   4. `POST /v1/auth/register` dkk. — klien mengirim `deviceId`/`deviceInfo`
 *      yang tidak ada di DTO; ditolak 400 bila backend memakai
 *      `forbidNonWhitelisted`, atau dibuang diam-diam bila `whitelist`.
 *
 * Skrip ini menutup 1–3 secara otomatis. Nomor 4 TIDAK dijadikan kegagalan:
 * field ekstra dicatat sebagai PERINGATAN, karena mengirim field yang tidak
 * terdokumentasi jauh lebih sering berarti "spec basi" daripada "klien salah",
 * dan menggagalkan build untuk itu akan mendorong orang menghapus field yang
 * justru dibaca backend.
 *
 * Cara kerja: setiap pemanggilan `http.<method>(path, body, opts)` di `lib/api`
 * di-parse dengan TypeScript compiler, tipe argumen `body` di-resolve lewat
 * type-checker (jadi spread & variabel ikut terhitung), lalu dibandingkan dengan
 * skema DTO yang dirujuk `requestBody` di spec.
 *
 * Jalankan:  npm run check:api:body
 *            node scripts/check-api-body.mjs --json   (untuk debugging)
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const specPath = path.join(root, "docs/api/kahade-api-mobile.json")
if (!fs.existsSync(specPath)) {
  console.warn(
    "check:api-body: DILEWATI — docs/api/kahade-api-mobile.json tidak ada.\n" +
      "  Salin spec OpenAPI dari repo backend ke path itu untuk mengaktifkan audit body.",
  )
  process.exit(0)
}

const spec = JSON.parse(fs.readFileSync(specPath, "utf8"))
const schemas = spec.components?.schemas ?? {}
const VERBS = ["get", "post", "put", "patch", "delete"]
const normalize = (url) => url.replace(/\{[^}]+\}/g, "{}")

const documented = new Map()
for (const [url, node] of Object.entries(spec.paths)) {
  for (const verb of VERBS) {
    if (!node[verb]) continue
    documented.set(`${verb.toUpperCase()} ${normalize(url)}`, node[verb])
  }
}

const apiDir = path.join(root, "lib", "api")
const files = fs
  .readdirSync(apiDir)
  .filter((name) => name.endsWith(".ts"))
  .map((name) => path.join("lib", "api", name))

const program = ts.createProgram(files, {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  skipLibCheck: true,
  noEmit: true,
  baseUrl: root,
  paths: { "@/*": ["./*"] },
  types: [],
})
const checker = program.getTypeChecker()

/** Nama properti dari sebuah tipe, mengikuti union/intersection dangkal. */
function propertyNames(type) {
  if (!type) return []
  if (type.isUnion?.()) {
    const sets = type.types.map(propertyNames).filter((names) => names.length > 0)
    return sets.length ? [...new Set(sets.flat())] : []
  }
  return checker.getPropertiesOfType(type).map((symbol) => symbol.name)
}

function isDynamic(typeText) {
  return /^(any|unknown|never|FormData|Blob|undefined)$/.test(typeText)
}

/**
 * Penyimpangan yang DIKETAHUI dan diterima, dengan alasan.
 *
 * Ini bukan daftar "abaikan saja": setiap entri adalah celah di sisi BACKEND
 * yang harus ditutup, dicatat di sini supaya (a) build tetap hijau, (b) celahnya
 * tetap terlihat setiap kali skrip dijalankan, dan (c) begitu spec diperbaiki,
 * entri ini menjadi usang dan `check:api-body` melaporkan
 * `ALLOWLIST_STALE` — pengingat untuk menghapusnya.
 */
const KNOWN_DEVIATIONS = [
  {
    match: "POST /v1/wallet/withdraw/cancel",
    reason:
      "Backend tidak mendeklarasikan requestBody, tetapi pembatalan penarikan " +
      "mustahil tanpa txId. Klien mengirim { txId }; spec yang harus dilengkapi " +
      "(CancelWithdrawDto). Lihat docs/audit/API-ENDPOINT-AUDIT.md API-04.",
  },
]

function isKnownDeviation(operationKey) {
  return KNOWN_DEVIATIONS.find((entry) => operationKey.startsWith(entry.match))
}

const errors = []
const warnings = []
const staleAllowlist = new Set(KNOWN_DEVIATIONS.map((entry) => entry.match))
let checked = 0

for (const file of files) {
  const sourceFile = program.getSourceFile(path.join(root, file))
  if (!sourceFile) continue
  const source = fs.readFileSync(path.join(root, file), "utf8")
  const relative = path.relative(root, path.join(root, file))

  const walk = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(sourceFile) === "http"
    ) {
      const method = node.expression.name.text.toUpperCase()
      const pathArg = node.arguments[0]
      const bodyArg = node.arguments[1]
      const line = source.slice(0, node.getStart(sourceFile)).split("\n").length

      let url = pathArg ? pathArg.getText(sourceFile).slice(1, -1) : null
      if (pathArg && ts.isTemplateExpression(pathArg))
        url = url.replace(/\$\{[^}]+\}/g, "{}")

      const operation = url ? documented.get(`${method} ${normalize(url)}`) : undefined
      const target = url ? normalize(url) : "<unknown>"
      const dtoName =
        operation?.requestBody?.content?.["application/json"]?.schema?.$ref?.split("/").pop() ?? null
      const dto = dtoName ? schemas[dtoName] : null

      // `formData` memakai transport multipart; DTO JSON tidak berlaku.
      const optionsText = node.arguments[2] ? node.arguments[2].getText(sourceFile) : ""
      const usesFormData = /formData/.test(optionsText)

      if (method === "POST" || method === "PUT" || method === "PATCH") {
        const bodyText = bodyArg ? bodyArg.getText(sourceFile) : null
        const sendsNothing = bodyText === null || bodyText === "undefined"
        const bodyType = bodyArg ? checker.typeToString(checker.getTypeAtLocation(bodyArg)) : ""
        const sent =
          bodyArg && !sendsNothing && !isDynamic(bodyType) ? propertyNames(checker.getTypeAtLocation(bodyArg)) : []

        if (operation?.requestBody?.required && sendsNothing && !usesFormData) {
          errors.push({
            kind: "MISSING_BODY",
            where: `${relative}:${line}`,
            detail:
              `${method} ${target} — spec menandai requestBody REQUIRED` +
              (dtoName ? ` (${dtoName})` : "") +
              ", klien tidak mengirim body sama sekali. Kirim `{}` eksplisit.",
          })
        } else if (!operation?.requestBody && !sendsNothing && !usesFormData && sent.length > 0) {
          const known = isKnownDeviation(`${method} ${target}`)
          if (known) {
            staleAllowlist.delete(known.match)
            warnings.push({
              kind: "KNOWN_DEVIATION",
              where: `${relative}:${line}`,
              detail: `${method} ${target} — ${known.reason}`,
            })
          } else {
            errors.push({
              kind: "UNDECLARED_BODY",
              where: `${relative}:${line}`,
              detail:
                `${method} ${target} — klien mengirim {${sent.join(", ")}} tetapi spec ` +
                "tidak mendeklarasikan requestBody. Tambahkan DTO-nya di backend.",
            })
          }
        } else if (dto && sent.length > 0) {
          checked += 1
          const declared = Object.keys(dto.properties ?? {})
          const required = dto.required ?? []
          const missing = required.filter((key) => !sent.includes(key))
          const extra = sent.filter((key) => !declared.includes(key))
          if (missing.length > 0)
            errors.push({
              kind: "MISSING_REQUIRED_FIELD",
              where: `${relative}:${line}`,
              detail:
                `${method} ${target} — ${dtoName} mewajibkan [${missing.join(", ")}] ` +
                `tetapi tipe body klien hanya punya {${sent.join(", ")}}. Request akan 400.`,
            })
          if (extra.length > 0 && declared.length > 0)
            warnings.push({
              kind: "EXTRA_FIELD",
              where: `${relative}:${line}`,
              detail:
                `${method} ${target} — klien mengirim [${extra.join(", ")}] yang tidak ada di ` +
                `${dtoName}. Bila backend memakai forbidNonWhitelisted ini 400; bila whitelist, ` +
                "field dibuang diam-diam. Selaraskan spec atau klien.",
            })
        } else if (dto && Object.keys(dto.properties ?? {}).length === 0 && !sendsNothing) {
          // DTO kosong di spec (mis. CallActionDto) — apa pun yang dikirim tidak
          // bisa diverifikasi. Bukan kegagalan, tapi layak terlihat.
          warnings.push({
            kind: "EMPTY_DTO",
            where: `${relative}:${line}`,
            detail: `${method} ${target} — ${dtoName} kosong di spec; body klien tidak terverifikasi.`,
          })
        }
      }
    }
    ts.forEachChild(node, walk)
  }
  walk(sourceFile)
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ errors, warnings, checked }, null, 2))
  process.exit(errors.length ? 1 : 0)
}

console.log(
  `check:api-body — ${checked} pemanggilan ber-DTO dibandingkan terhadap spec, ` +
    `${errors.length} pelanggaran, ${warnings.length} peringatan.`,
)

if (warnings.length > 0) {
  console.log("\nPeringatan (tidak menggagalkan build):")
  for (const w of warnings) console.log(`  ${w.kind.padEnd(20)} ${w.where}\n      ${w.detail}`)
}

if (staleAllowlist.size > 0) {
  console.log(
    `\nALLOWLIST usang — spec sudah menutup celah ini, hapus entri KNOWN_DEVIATIONS: ` +
      [...staleAllowlist].join(", "),
  )
}

if (errors.length > 0) {
  console.error(`\ncheck:api-body GAGAL — ${errors.length} pelanggaran kontrak body:`)
  for (const e of errors) console.error(`  ${e.kind.padEnd(20)} ${e.where}\n      ${e.detail}`)
  process.exit(1)
}
