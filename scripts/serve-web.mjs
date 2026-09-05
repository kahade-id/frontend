import { createServer } from "node:http"
import { createReadStream, existsSync, statSync } from "node:fs"
import path from "node:path"

// Serve the real static export without Metro's per-request SSR overhead.
// API calls still go to the configured HTTPS API, not to localhost in a user's browser.
const root = path.resolve(process.env.WEB_ROOT || "dist")
if (!existsSync(path.join(root, "index.html")))
  throw new Error("Web export missing. Run npm run build:web first.")
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
}
const server = createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405)
    response.end()
    return
  }
  let pathname
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://preview.invalid").pathname)
  } catch {
    response.writeHead(400)
    response.end()
    return
  }
  const candidate = path.resolve(root, "." + pathname)
  if (candidate !== root && !candidate.startsWith(root + path.sep)) {
    response.writeHead(403)
    response.end()
    return
  }
  const file = [candidate, candidate + ".html", path.join(candidate, "index.html")].find(
    (file) => existsSync(file) && statSync(file).isFile(),
  )
  // Dynamic Expo routes bootstrap from the same document, then resolve the URL in Router.
  const target = file || (!path.extname(pathname) ? path.join(root, "index.html") : null)
  if (!target) {
    response.writeHead(404)
    response.end()
    return
  }
  const extension = path.extname(target)
  response.writeHead(200, {
    "Content-Type": types[extension] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control":
      extension === ".html"
        ? "no-cache"
        : /[a-f0-9]{16,}/.test(path.basename(target))
          ? "public, max-age=31536000, immutable"
          : "no-cache",
  })
  if (request.method === "HEAD") response.end()
  else
    createReadStream(target)
      .on("error", () => response.destroy())
      .pipe(response)
})
server.listen(Number(process.env.PORT || 8081), "0.0.0.0", () =>
  console.log(`Kahade web preview on 0.0.0.0:${process.env.PORT || 8081}`),
)
