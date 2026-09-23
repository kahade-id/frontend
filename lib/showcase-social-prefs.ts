/**
 * Kahade — store bersama preferensi sosial Etalase (suka & simpan).
 *
 * Kenapa modul ini ada (audit A-06/A-07/C-05/C-06): state suka & simpan
 * sebelumnya `useState` LOKAL di TIGA layar berbeda (feed, tab Etalase
 * profil, halaman detail). Akibatnya:
 *   - Simpan di feed → buka detail → ikon bookmark kosong (dan sebaliknya).
 *   - Unlike di detail → kembali ke feed → kartu masih menampilkan ♥ penuh
 *     dengan angka lama (patch optimistis menimpa data segar tanpa batas).
 *
 * Solusinya: SATU store eksternal (pola `lib/api/session.ts`) yang dibaca
 * ketiga layar lewat `useShowcaseSaved` / `useShowcaseLikeOverride` dan
 * ditulis lewat `toggleShowcaseSaved` / `setShowcaseLikeState`. Nilai like
 * yang disimpan adalah NILAI FINAL SERVER (`{liked, likeCount}` hasil
 * sinkronisasi), jadi override ini lebih akurat daripada data feed yang bisa
 * basi — bukan tebakan optimistis berumur panjang.
 *
 * Cakupan sengaja memori-sesi (backend belum punya endpoint koleksi
 * tersimpan, dan repo tidak membawa AsyncStorage/MMKV): konsisten di semua
 * layar selama app hidup; tidak berpura-pura persisten lintas instal.
 *
 * `feedDirtyVersion`: spanduk "etalase saya berubah" — mutasi di layar
 * manajemen memanggil `markShowcaseFeedDirty()`; tab feed mengonsumsinya
 * saat fokus kembali (audit A-08: item baru dahulu tidak pernah muncul di
 * feed tanpa refresh manual).
 */
import { useCallback, useSyncExternalStore } from "react"

export type ShowcaseLikeState = { isLiked: boolean; likeCount: number }

type SocialPrefs = {
  /** id item yang disimpan pengguna (bookmark). */
  saved: Record<string, true>
  /** state suka terakhir yang DIKETAHUI (nilai final server). */
  likes: Record<string, ShowcaseLikeState>
  /** Naik setiap ada mutasi "etalase saya" (buat/ubah/hapus). */
  feedDirtyVersion: number
}

const EMPTY: SocialPrefs = { saved: {}, likes: {}, feedDirtyVersion: 0 }

let state: SocialPrefs = EMPTY
const listeners = new Set<() => void>()

function emit(next: Partial<SocialPrefs>) {
  state = { ...state, ...next }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

// Snapshot SELECTOR primitif per item (bukan objek state utuh): boolean /
// entry per id identitasnya stabil antar emit yang tidak menyentuh item tsb,
// jadi kartu lain tidak ikut re-render saat satu kartu berubah.

// ------------------------------------------------------------------
// Simpan (bookmark) — bersifat lokal sampai kontrak koleksi ada.
// ------------------------------------------------------------------

export function toggleShowcaseSaved(id: string) {
  const saved = { ...state.saved }
  if (saved[id]) delete saved[id]
  else saved[id] = true
  emit({ saved })
}

export function isShowcaseSaved(id: string): boolean {
  return state.saved[id] === true
}

/** `saved` untuk SATU item; stabil: hanya re-render saat nilai item ini toggle. */
export function useShowcaseSaved(id: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => state.saved[id] === true,
    () => false,
  )
}

// ------------------------------------------------------------------
// Suka — override nilai feed/detail dengan nilai final hasil interaksi.
// ------------------------------------------------------------------

export function setShowcaseLikeState(id: string, like: ShowcaseLikeState) {
  emit({ likes: { ...state.likes, [id]: like } })
}

/** Override suka untuk satu item (undefined = belum pernah berinteraksi sesi ini). */
export function useShowcaseLikeOverride(id: string): ShowcaseLikeState | undefined {
  return useSyncExternalStore(
    subscribe,
    () => state.likes[id],
    () => undefined,
  )
}

/** Pembacaan non-reaktif (handler yang tidak butuh re-render). */
export function getShowcaseLikeOverride(id: string): ShowcaseLikeState | undefined {
  return state.likes[id]
}

// ------------------------------------------------------------------
// Spanduk "feed harus disegarkan" (mutasi dari layar manajemen).
// ------------------------------------------------------------------

export function markShowcaseFeedDirty() {
  emit({ feedDirtyVersion: state.feedDirtyVersion + 1 })
}

/** Versi dirty saat ini — bandingkan dengan snapshot yang disimpan pemanggil. */
export function showcaseFeedDirtyVersion(): number {
  return state.feedDirtyVersion
}

/** Hook kecil untuk handler aksi sosial yang digerbang sesi (audit A-05). */
export function useRequireSessionAction(hasSession: boolean) {
  return useCallback(
    (action: () => void, onGuest: () => void) => {
      if (!hasSession) onGuest()
      else action()
    },
    [hasSession],
  )
}
