/**
 * Kahade — helper UI murni untuk layar-layar profil (audit UI/UX 2026-09-27,
 * TIM PROFILE).
 *
 * Hanya berisi `atHandle`. Helper kepemilikan pertanyaan/komentar
 * (`isOwnQuestion`, `isOwnQuestionComment`) hidup di `lib/api/users.ts`
 * (ditambahkan tim konkuren di working tree yang sama — implementasinya
 * diverifikasi ekuivalen, jadi tidak diduplikasi di sini agar satu sumber
 * kebenaran).
 */

/**
 * `@username`, atau string kosong bila username tidak ada — jangan pernah
 * render "@undefined" (UI-P014).
 */
export function atHandle(username: string | null | undefined): string {
  const clean = (username ?? "").trim()
  return clean ? `@${clean}` : ""
}
