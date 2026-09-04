/**
 * Kahade — generator tipe request DTO dari docs/api/kahade-api-mobile.json
 * → lib/api/types.ts
 *
 * Jalankan: `npm run gen:api`
 *
 * Hanya DTO yang BENAR-BENAR direferensikan oleh salah satu path di spec yang
 * dihasilkan (schema admin-only seperti AdminLoginDto, BanUserDto, dsb.
 * dilewati). Tipe dihasilkan persis dari `properties` + `required` — jangan
 * edit lib/api/types.ts manual; ubah spec lalu regenerate.
 *
 * Catatan jujur: spec ini (NestJS/Swagger) hanya mendeskripsikan REQUEST body
 * dan parameter. Response body tidak punya schema (kecuali /v1/health), jadi
 * tipe response ditulis manual di modul domain (lib/api/*.ts) dan ditandai
 * sebagai "belum diverifikasi terhadap backend".
 */
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const specPath = resolve(root, "docs/api/kahade-api-mobile.json")
const outPath = resolve(root, "lib/api/types.ts")

const spec = JSON.parse(readFileSync(specPath, "utf8"))
const schemas = spec.components?.schemas ?? {}

// ------------------------------------------------------------------
// 1. Kumpulkan schema yang direferensikan path (transitif lewat $ref)
// ------------------------------------------------------------------
const referenced = new Set()
const queue = []

function collectRefs(node) {
  if (!node || typeof node !== "object") return
  if (Array.isArray(node)) return node.forEach(collectRefs)
  if (typeof node.$ref === "string") {
    const name = node.$ref.split("/").pop()
    if (!referenced.has(name)) {
      referenced.add(name)
      queue.push(name)
    }
  }
  Object.values(node).forEach(collectRefs)
}

for (const ops of Object.values(spec.paths)) {
  for (const op of Object.values(ops)) collectRefs(op.requestBody)
}
while (queue.length) collectRefs(schemas[queue.shift()])

// ------------------------------------------------------------------
// 2. Emit TypeScript
// ------------------------------------------------------------------
const INDENT = "  "

function docComment(schema, indent) {
  const lines = []
  if (schema.description) lines.push(schema.description)
  const meta = []
  if (schema.minLength != null) meta.push(`minLength ${schema.minLength}`)
  if (schema.maxLength != null) meta.push(`maxLength ${schema.maxLength}`)
  if (schema.minimum != null) meta.push(`min ${schema.minimum}`)
  if (schema.maximum != null) meta.push(`max ${schema.maximum}`)
  if (schema.minItems != null) meta.push(`minItems ${schema.minItems}`)
  if (schema.maxItems != null) meta.push(`maxItems ${schema.maxItems}`)
  if (schema.format) meta.push(`format ${schema.format}`)
  if (schema.pattern) meta.push(`pattern ${schema.pattern}`)
  if (schema.default !== undefined) meta.push(`default ${JSON.stringify(schema.default)}`)
  if (schema.example !== undefined) meta.push(`contoh ${JSON.stringify(schema.example)}`)
  if (meta.length) lines.push(meta.join(" · "))
  if (!lines.length) return ""
  if (lines.length === 1) return `${indent}/** ${lines[0]} */\n`
  return `${indent}/**\n${lines.map((l) => `${indent} * ${l}`).join("\n")}\n${indent} */\n`
}

function tsType(schema, indent) {
  if (!schema) return "unknown"
  if (schema.$ref) return schema.$ref.split("/").pop()
  if (Array.isArray(schema.oneOf)) return schema.oneOf.map((s) => tsType(s, indent)).join(" | ")
  if (Array.isArray(schema.anyOf)) return schema.anyOf.map((s) => tsType(s, indent)).join(" | ")
  if (Array.isArray(schema.allOf)) return schema.allOf.map((s) => tsType(s, indent)).join(" & ")

  let t
  if (Array.isArray(schema.enum)) {
    t = schema.enum.map((v) => JSON.stringify(v)).join(" | ")
  } else {
    switch (schema.type) {
      case "string":
        t = schema.format === "binary" ? "Blob" : "string"
        break
      case "number":
      case "integer":
        t = "number"
        break
      case "boolean":
        t = "boolean"
        break
      case "array":
        t = `Array<${tsType(schema.items, indent)}>`
        break
      case "object":
        t = schema.properties ? objectLiteral(schema, indent) : "Record<string, unknown>"
        break
      default:
        t = schema.properties ? objectLiteral(schema, indent) : "unknown"
    }
  }
  return schema.nullable ? `${t} | null` : t
}

function objectLiteral(schema, indent) {
  const inner = indent + INDENT
  const required = new Set(schema.required ?? [])
  const props = Object.entries(schema.properties ?? {})
  if (!props.length) return "Record<string, never>"
  const body = props
    .map(([name, prop]) => {
      const key = /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name)
      return `${docComment(prop, inner)}${inner}${key}${required.has(name) ? "" : "?"}: ${tsType(prop, inner)}`
    })
    .join("\n")
  return `{\n${body}\n${indent}}`
}

const names = Object.keys(schemas).filter((n) => referenced.has(n))
const skipped = Object.keys(schemas).filter((n) => !referenced.has(n))

let out = `/**
 * Kahade — tipe REQUEST DTO, DIHASILKAN OTOMATIS dari
 * docs/api/kahade-api-mobile.json oleh scripts/gen-api-types.mjs.
 *
 * JANGAN EDIT MANUAL. Ubah spec → \`npm run gen:api\`.
 *
 * Spec: ${spec.info?.title ?? "Kahade API"} v${spec.info?.version ?? "?"} · ${names.length} DTO dipakai
 * (${skipped.length} schema admin-only dilewati).
 */

`

for (const name of names) {
  const schema = schemas[name]
  out += docComment(schema, "")
  out += `export type ${name} = ${tsType(schema, "")}\n\n`
}

writeFileSync(outPath, out.trimEnd() + "\n")
console.log(`✓ ${names.length} DTO → ${outPath.replace(root + "/", "")}`)
if (skipped.length) console.log(`  dilewati (tidak direferensikan path): ${skipped.join(", ")}`)
