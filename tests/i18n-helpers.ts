/**
 * Lokasi file kamus untuk test integritas.
 *
 * Dipisah dari test karena `import.meta.url` harus dipakai untuk menentukan
 * root (vitest menjalankannya dari cwd repo, tapi test yang sama bisa jalan di
 * CI dengan working directory lain).
 */
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const EN_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../lib/i18n/en")
