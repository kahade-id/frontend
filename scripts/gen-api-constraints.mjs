import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
const source = new URL("../docs/api/kahade-api-mobile.json", import.meta.url)
const out = new URL("../lib/api/constraints.ts", import.meta.url)
if (!existsSync(source)) {
  console.error(
    "gen-api-constraints: docs/api/kahade-api-mobile.json tidak ada. " +
      "Salin spec OpenAPI terbaru dari repo backend ke path itu, lalu jalankan `npm run gen:api`. " +
      "lib/api/constraints.ts yang sudah di-commit tetap dipakai sampai spec tersedia.",
  )
  process.exit(1)
}
const spec = JSON.parse(readFileSync(source, "utf8"))
/**
 * Daftar DTO DITURUNKAN dari spec, bukan di-hardcode.
 *
 * Versi sebelumnya memuat 11 nama tetap. Akibatnya 47 DTO lain yang direferensikan
 * path mobile dan punya constraint (min/max/enum/length) tidak pernah masuk
 * `API_CONSTRAINTS` — jadi tidak bisa divalidasi di klien, dan komentar seperti
 * di `app/account-type.tsx` yang merujuk `API_CONSTRAINTS.UpdateProfileDto`
 * menunjuk sesuatu yang tidak ada.
 *
 * Kriteria: schema yang (a) direferensikan oleh operasi pada `paths` spec mobile
 * — bukan sekadar menganggur di `components` (spec ini sengaja tidak memangkas
 * skema admin, lihat API-16) — dan (b) punya setidaknya satu constraint.
 * Diurutkan agar output stabil dan diff-nya terbaca.
 */
const CONSTRAINT_KEYS = [
  "minimum",
  "maximum",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "enum",
  "pattern",
]
const referenced = new Set()
for (const node of Object.values(spec.paths ?? {})) {
  for (const verb of ["get", "post", "put", "patch", "delete"]) {
    const operation = node?.[verb]
    if (!operation) continue
    for (const match of JSON.stringify(operation).matchAll(
      /#\/components\/schemas\/([A-Za-z0-9_]+)/g,
    ))
      referenced.add(match[1])
  }
}
const names = [...referenced]
  .filter((name) => {
    const properties = spec.components?.schemas?.[name]?.properties ?? {}
    return Object.values(properties).some((prop) =>
      CONSTRAINT_KEYS.some((key) => prop?.[key] !== undefined),
    )
  })
  .sort()
const constraints = {}
for (const name of names) {
  const schema = spec.components.schemas[name]
  if (!schema) throw new Error(`Schema missing: ${name}`)
  constraints[name] = Object.fromEntries(
    Object.entries(schema.properties ?? {}).flatMap(([name, prop]) => {
      const rules = Object.fromEntries(
        Object.entries(prop).filter(([key]) => CONSTRAINT_KEYS.includes(key)),
      )
      return Object.keys(rules).length ? [[name, rules]] : []
    }),
  )
}
const content =
  "// GENERATED from docs/api/kahade-api-mobile.json. Run npm run gen:api; do not edit.\nexport const API_CONSTRAINTS = " +
  JSON.stringify(constraints, null, 2) +
  " as const\n"
if (process.argv.includes("--check")) {
  if (readFileSync(out, "utf8") !== content)
    throw new Error("API constraints are stale: npm run gen:api")
} else {
  writeFileSync(out, content)
  console.log(`Generated ${fileURLToPath(out)}`)
}
