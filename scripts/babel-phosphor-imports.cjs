// Metro does not tree-shake this package's barrel. Resolve only icons actually used;
// keep type/context imports intact. This trims thousands of unused SVG definitions.
const fs = require("node:fs")
const path = require("node:path")
const root = path.dirname(require.resolve("phosphor-react-native/package.json"))
module.exports = ({ types: t }) => ({
  name: "kahade-phosphor-imports",
  visitor: {
    ImportDeclaration(p) {
      if (p.node.source.value !== "phosphor-react-native" || p.node.importKind === "type") return
      const remaining = []
      const imports = []
      for (const specifier of p.node.specifiers) {
        const name = specifier.imported?.name
        if (
          t.isImportSpecifier(specifier) &&
          specifier.importKind !== "type" &&
          name &&
          fs.existsSync(path.join(root, "src/icons", `${name}.tsx`))
        ) {
          imports.push(
            t.importDeclaration(
              [t.importDefaultSpecifier(specifier.local)],
              t.stringLiteral(`phosphor-react-native/src/icons/${name}`),
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
