/**
 * Stub `nativewind/jsx-runtime` & `nativewind/jsx-dev-runtime` untuk Vitest.
 *
 * tsconfig repo memakai `jsxImportSource: "nativewind"` (plugin Babel saat
 * build app). Sejak Vitest 5 (Vite 8/Rolldown, transform oxc), override
 * `esbuild.jsxImportSource` di config tidak lagi menimpa tsconfig, jadi JSX
 * test tetap dikompilasi ke import `nativewind/jsx-dev-runtime`. Modul itu
 * menarik runtime css-interop asli yang tidak bisa hidup di jsdom — alias
 * ini membelokkannya ke runtime JSX React biasa (className diteruskan apa
 * adanya ke DOM; styling bukan objek test).
 */
export { jsxDEV } from "react/jsx-dev-runtime"
export { jsx, jsxs, Fragment } from "react/jsx-runtime"
