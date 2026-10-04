/**
 * Kahade — resolusi path paket `phosphor-react-native`.
 *
 * phosphor-react-native v3 membatasi peta `exports`-nya menjadi "." dan
 * "./src/icons/*". Subpath "./package.json" TIDAK diekspor, jadi
 * `require("phosphor-react-native/package.json")` maupun
 * `require.resolve("phosphor-react-native/package.json")` melempar
 * ERR_PACKAGE_PATH_NOT_EXPORTED.
 *
 * Ini bukan kegagalan halus: babel.config.js dan plugin
 * `babel-phosphor-imports` dievaluasi saat Metro membangun transformer, jadi
 * seluruh bundling (web export, dev server, build native) mati di titik itu.
 *
 * Root paket diturunkan dari entri yang memang diekspor ("." →
 * lib/commonjs/index.js untuk require) dengan memotong path tepat di segmen
 * node_modules/phosphor-react-native — berlaku untuk layout npm/pnpm/yarn.
 */
const path = require("node:path")

const PKG = "phosphor-react-native"

function resolvePhosphorRoot() {
  const entry = require.resolve(PKG)
  const marker = path.join("node_modules", PKG)
  const cut = entry.lastIndexOf(marker)
  if (cut === -1) {
    throw new Error(`kahade: tidak bisa menentukan root paket ${PKG} dari entri ${entry}`)
  }
  return entry.slice(0, cut + marker.length)
}

function resolvePhosphorVersion() {
  // Dibaca langsung dari disk; require() atas subpath ini diblokir exports.
  return require(path.join(resolvePhosphorRoot(), "package.json")).version
}

module.exports = { PKG, resolvePhosphorRoot, resolvePhosphorVersion }
