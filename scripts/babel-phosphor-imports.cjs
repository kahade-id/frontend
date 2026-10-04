// Metro does not tree-shake this package's barrel. Resolve only icons actually used;
// keep type/context imports intact. This trims thousands of unused SVG definitions.
const fs = require("node:fs")
const path = require("node:path")
const { resolvePhosphorRoot } = require("./phosphor-root.cjs")

const root = resolvePhosphorRoot()
const ICON_DIR = path.join(root, "src/icons")

/**
 * Menentukan berkas ikon untuk sebuah nama ekspor barrel.
 *
 * phosphor v3 tidak seragam: sebagian ikon punya `export const X` (mis.
 * Camera.tsx), sebagian LAIN hanya punya ekspor beralias `export { I as
 * XIcon }` tanpa `export const X` (mis. Circle.tsx). Jadi:
 *  - "Camera"    → src/icons/Camera.tsx
 *  - "CircleIcon"→ src/icons/Circle.tsx  (bukan CircleIcon.tsx, tidak ada)
 *
 * Tanpa cabang kedua, nama beralias tetap di barrel dan Metro menarik
 * seluruh 1512 definisi ikon ke bundle — persis yang plugin ini ada untuk
 * cegah. Ekspor beraliasnya diverifikasi dari isi berkas, bukan ditebak dari
 * nama, supaya tidak pernah menunjuk ekspor yang tidak ada.
 *
 * @returns {string | null} nama berkas ikon tanpa ekstensi, atau null bila
 *   nama itu bukan ikon (tipe/konteks) dan harus tetap di barrel.
 */
function iconFileFor(name) {
  if (fs.existsSync(path.join(ICON_DIR, `${name}.tsx`))) return name
  if (name.endsWith("Icon")) {
    const base = name.slice(0, -"Icon".length)
    const file = path.join(ICON_DIR, `${base}.tsx`)
    if (fs.existsSync(file)) {
      const source = fs.readFileSync(file, "utf8")
      const exported = new RegExp(`\\bas\\s+${name}\\b|export\\s+const\\s+${name}\\b`).test(source)
      if (exported) return base
    }
  }
  return null
}

module.exports = ({ types: t }) => ({
  name: "kahade-phosphor-imports",
  visitor: {
    ImportDeclaration(p) {
      if (p.node.source.value !== "phosphor-react-native" || p.node.importKind === "type") return
      const remaining = []
      const imports = []
      for (const specifier of p.node.specifiers) {
        const name = specifier.imported?.name
        const iconFile =
          t.isImportSpecifier(specifier) && specifier.importKind !== "type" && name
            ? iconFileFor(name)
            : null
        if (iconFile) {
          // phosphor-react-native v3 hanya punya ekspor bernama di
          // src/icons/*.tsx — tidak ada default export. Import default di sini
          // menghasilkan komponen undefined saat runtime (Babel/Metro tidak
          // mengeluh), jadi specifier bernama dipertahankan; modulnya tetap
          // satu ikon sehingga tree-shaking-nya sama.
          imports.push(
            t.importDeclaration(
              [t.importSpecifier(specifier.local, t.identifier(name))],
              t.stringLiteral(`phosphor-react-native/src/icons/${iconFile}`),
            ),
          )
        } else remaining.push(specifier)
      }
      if (!imports.length) return
      if (remaining.length) imports.push(t.importDeclaration(remaining, p.node.source))
      p.replaceWithMultiple(imports)
    },
  },
})
