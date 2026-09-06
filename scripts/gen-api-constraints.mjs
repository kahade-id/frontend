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
const names = [
  "SubscribeDto",
  "TopupDto",
  "WithdrawDto",
  "TransferDto",
  "CreateOrderDto",
  "CreateOrderLinkDto",
  "RequestExtensionDto",
  "PhoneRegisterDto",
  "SendMessageDto",
  "BatchNotificationIdsDto",
  "PresignedUrlDto",
]
const constraints = {}
for (const name of names) {
  const schema = spec.components.schemas[name]
  if (!schema) throw new Error(`Schema missing: ${name}`)
  constraints[name] = Object.fromEntries(
    Object.entries(schema.properties ?? {}).flatMap(([name, prop]) => {
      const rules = Object.fromEntries(
        Object.entries(prop).filter(([key]) =>
          [
            "minimum",
            "maximum",
            "minLength",
            "maxLength",
            "minItems",
            "maxItems",
            "enum",
            "pattern",
          ].includes(key),
        ),
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
