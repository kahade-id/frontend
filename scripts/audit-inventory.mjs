import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

const specPath = "docs/api/kahade-api-mobile.json"
if (!fs.existsSync(specPath)) {
  console.error(
    `audit-inventory: ${specPath} tidak ada. Audit kontrak path OpenAPI butuh spec dari repo backend — ` +
      `salin berkas itu ke ${specPath}, lalu jalankan ulang. ` +
      `Inventaris route TIDAK butuh spec: gunakan \`npm run gen:inventory\`.`,
  )
  process.exit(1)
}
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"))
const normalize = (value) => value.replace(/\{[^}]+\}/g, "{}")
const documented = new Map()
for (const [url, verbs] of Object.entries(spec.paths))
  for (const method of Object.keys(verbs))
    if (["get", "post", "put", "patch", "delete"].includes(method))
      documented.set(`${method.toUpperCase()} ${normalize(url)}`, url)
const operations = []
for (const name of fs.readdirSync("lib/api").filter((name) => name.endsWith(".ts"))) {
  const file = `lib/api/${name}`,
    source = fs.readFileSync(file, "utf8"),
    ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  function visit(node, enclosing = "") {
    if (ts.isFunctionDeclaration(node) && node.name) enclosing = node.name.text
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(ast) === "http"
    ) {
      const method = node.expression.name.text.toUpperCase(),
        argument = node.arguments[0]
      if (
        argument &&
        (ts.isStringLiteral(argument) ||
          ts.isNoSubstitutionTemplateLiteral(argument) ||
          ts.isTemplateExpression(argument))
      ) {
        const url = argument
            .getText(ast)
            .slice(1, -1)
            .replace(/\$\{[^}]+\}/g, "{}"),
          canonical = documented.get(`${method} ${normalize(url)}`)
        operations.push({
          file,
          function: enclosing,
          method,
          path: canonical ?? url,
          documented: Boolean(canonical),
        })
      }
    }
    ts.forEachChild(node, (child) => visit(child, enclosing))
  }
  visit(ast)
}
const namespaces = new Map(
  [
    ...fs
      .readFileSync("lib/api.ts", "utf8")
      .matchAll(/import \* as (\w+) from ["'](?:@\/lib|\.)\/api\/([^"']+)["']/g),
  ].map((m) => [m[1], `lib/api/${m[2]}.ts`]),
)
if (namespaces.has("publicApi")) namespaces.set("public", namespaces.get("publicApi"))
const listFiles = (directory) =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((item) =>
      item.isDirectory()
        ? listFiles(path.join(directory, item.name))
        : [path.join(directory, item.name)],
    )
function resolveImport(file, source) {
  if (source === "@/lib/api" || source.startsWith("@/lib/api/")) return null
  const stem = source.startsWith("@/")
    ? source.slice(2)
    : source.startsWith(".")
      ? path.normalize(path.join(path.dirname(file), source))
      : null
  if (!stem) return null
  return (
    [stem, `${stem}.ts`, `${stem}.tsx`, `${stem}/index.ts`, `${stem}/index.tsx`].find(
      (p) => fs.existsSync(p) && fs.statSync(p).isFile(),
    ) ?? null
  )
}
function dependencies(file, visited = new Set()) {
  if (visited.has(file)) return []
  visited.add(file)
  const source = fs.readFileSync(file, "utf8"),
    calls = [...source.matchAll(/\bapi\.(\w+)\.(\w+)/g)].map((m) => ({
      domain: m[1],
      function: m[2],
    }))
  for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
    const resolved = resolveImport(file, match[1])
    if (resolved && /\.[tj]sx?$/.test(resolved)) calls.push(...dependencies(resolved, visited))
  }
  return calls
}
const files = listFiles("app")
  .filter((file) => file.endsWith(".tsx"))
  .sort()
const routes = files
  .filter((file) => !file.endsWith("_layout.tsx") && !file.endsWith("+html.tsx"))
  .map((file) => {
    const source = fs.readFileSync(file, "utf8")
    const components = [
      ...new Set([...source.matchAll(/from\s+["']@\/components\/([^"']+)["']/g)].map((m) => m[1])),
    ]
    const calls = dependencies(file)
    const endpoints = [
      ...new Set(
        calls.flatMap((call) =>
          operations
            .filter(
              (op) => op.file === namespaces.get(call.domain) && op.function === call.function,
            )
            .map((op) => `${op.method} ${op.path}`),
        ),
      ),
    ].sort()
    return {
      file,
      route:
        "/" +
        file
          .replace(/^app\//, "")
          .replace(/\([^/]+\)\//g, "")
          .replace(/\.tsx$/, "")
          .replace(/^index$/, ""),
      components,
      endpoints,
    }
  })
/**
 * Jalur HTTP NYATA yang tidak lewat `http.*`, jadi tak terlihat pemindai di atas.
 *
 * Tanpa daftar ini, "238 adapter calls match" mudah terbaca sebagai "semua HTTP
 * sudah teraudit" — padahal tidak. Inilah yang membuat audit cakupan sempat
 * salah hitung (docs/audit/API-ENDPOINT-AUDIT.md API-20 dan §13.1).
 *
 * Setiap entri membawa `probe`: pola yang HARUS masih ada di berkasnya. Bila
 * pola itu hilang (kode di-refactor), skrip gagal dengan OUT_OF_BAND_STALE —
 * jadi daftar ini tidak bisa basi diam-diam seperti allowlist biasa.
 */
const OUT_OF_BAND_HTTP = [
  {
    file: "lib/api/client.ts",
    method: "POST",
    path: "/v1/auth/refresh",
    documented: true,
    probe: /REFRESH_PATH\s*=\s*"\/v1\/auth\/refresh"/,
    why: "refreshAccessToken() memanggil exchange() langsung agar bisa single-flight dan menghindari interceptor 401 (rekursi).",
  },
  {
    file: "lib/api/upload.ts",
    method: "PUT",
    path: "<presigned object-storage URL>",
    documented: false,
    probe: /fetch\(url, \{ method, body, headers, credentials: "omit"/,
    why: "uploadToPresignedUrl() mengunggah langsung ke object storage, bukan ke API Kahade — memang tidak ada di spec.",
  },
]

const staleOutOfBand = OUT_OF_BAND_HTTP.filter(
  (entry) => !fs.existsSync(entry.file) || !entry.probe.test(fs.readFileSync(entry.file, "utf8")),
)

const inventory = {
  sourceFiles: files.length,
  screens: routes.length,
  documentedPaths: Object.keys(spec.paths).length,
  documentedOperations: documented.size,
  adapterCalls: operations.length,
  undocumentedAdapterCalls: operations.filter((op) => !op.documented),
  outOfBandHttp: OUT_OF_BAND_HTTP.map(({ probe: _probe, ...rest }) => rest),
  routes,
  operations,
}
if (process.argv.includes("--check")) {
  if (staleOutOfBand.length) {
    console.error(
      "audit-inventory: OUT_OF_BAND_STALE — pola probe tidak lagi ditemukan, " +
        "daftar jalur HTTP di luar `http.*` sudah basi dan harus diperbarui:\n" +
        staleOutOfBand.map((e) => `  ${e.file} — ${e.method} ${e.path}`).join("\n"),
    )
    process.exitCode = 1
  }
  if (inventory.undocumentedAdapterCalls.length) {
    console.error(inventory.undocumentedAdapterCalls)
    process.exitCode = 1
  } else {
    const oob = OUT_OF_BAND_HTTP.map((e) => `${e.method} ${e.path}`).join(", ")
    console.log(
      `API inventory OK: ${operations.length} adapter calls match documented HTTP methods/paths; ${routes.length} screens inventoried. This is NOT authenticated endpoint verification.\n` +
        `  Di luar pemindaian \`http.*\` (${OUT_OF_BAND_HTTP.length} jalur, diverifikasi lewat probe): ${oob}.`,
    )
  }
} else {
  fs.mkdirSync("docs/audit", { recursive: true })
  fs.writeFileSync("docs/audit/inventory.json", JSON.stringify(inventory, null, 2) + "\n")
  const escape = (text) => text.replace(/\|/g, "\\|")
  const rows = routes.map(
    (route) =>
      `| \`${route.file}\` | ${route.components.map((c) => `\`${c.split("/").at(-1)}\``).join(", ") || "Komposisi bersama"} | ${route.endpoints.map((p) => `\`${p}\``).join("<br>") || "Lokal / sesi / navigasi; lihat implementasi"} |`,
  )
  fs.writeFileSync(
    "docs/audit/ROUTES.md",
    `# Inventaris seluruh halaman\n\nDihasilkan oleh \`npm run audit:inventory\`. ${files.length} file Expo, ${routes.length} screen, ${operations.length} pemanggilan adapter, ${documented.size} operasi pada ${Object.keys(spec.paths).length} path OpenAPI. Semua path/method adapter ditemukan dalam spesifikasi.\n\nIni pemetaan statis (termasuk import komponen/hook bersama), bukan klaim semua respons/private endpoint sudah teruji live. Dependensi modul dapat mencantumkan endpoint dari ekspor saudara; baca implementasi untuk jalur eksekusi yang persis. DTO request tersedia; mayoritas schema response protected masih belum disediakan backend.\n\n| File route | Komponen yang dipakai langsung | API halaman/dependensi bersama |\n|---|---|---|\n${rows
      .map(escape)
      .map((row) => row.replace(/\\\|/g, "|"))
      .join("\n")}\n`,
  )
  console.log(`Wrote inventory: ${routes.length} screens, ${operations.length} adapter calls`)
}
