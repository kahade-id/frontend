/**
 * Kahade — penanda "konten ini hidup di dalam overlay bergerak Reanimated".
 *
 * Kenapa context ini ada (non-obvious):
 *
 * Di New Architecture (Fabric) Android, Pressable bawaan react-native
 * memvalidasi tiap gerak jari terhadap "responder region" yang diukur lewat
 * `UIManager.measure` di SHADOW TREE, bukan view native yang tampil di layar.
 * Reanimated menganimasikan transform di UI thread dan TIDAK menulis balik
 * nilai akhirnya ke shadow tree (facebook/react-native#51621; reanimated
 * belum sync-after-animation). Akibatnya, setelah BottomSheet terbuka,
 * shadow tree masih mengira sheet ada di translateY = tinggi layar (posisi
 * awal, di luar layar): region Pressable di dalamnya ikut bergeser ke bawah,
 * jari keluar region saat sedikit bergerak (LEAVE_PRESS_RECT), dan `onPress`
 * tidak pernah dipanggil — aksi seperti "Hapus notifikasi" mati di Android
 * padahal jalan di web (DOM memakai posisi nyata).
 *
 * Solusi resmi untuk pola ini adalah Pressable berbasis gesture-handler
 * (RNGH), yang menghitung target dari hierarki view NATIVE:
 *   https://github.com/facebook/react-native/issues/51621#potential-solutions
 *
 * BottomSheet memasang provider ini di sekitar seluruh kartu sheet;
 * PressableScale membacanya dan otomatis memakai GesturePressable
 * (components/ui/gesture-pressable) hanya pada native — web tetap memakai
 * Pressable react-native-web apa adanya.
 *
 * Modal/Dialog TIDAK perlu provider: animasinya memakai RN `Animated`
 * (useNativeDriver) yang men-sync nilai akhir ke shadow tree saat animasi
 * selesai (RN #43374).
 */
import { createContext } from "react"

export const InsideReanimatedOverlayContext = createContext(false)
