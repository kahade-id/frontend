/**
 * Kahade — penanda "konten ini dipindahkan oleh transform Reanimated yang
 * tidak ikut tercermin di shadow tree Fabric".
 *
 * Kenapa context ini ada (non-obvious):
 *
 * Di New Architecture (Fabric) Android, Pressable bawaan react-native
 * memvalidasi tiap gerak jari terhadap "responder region" yang diukur lewat
 * `UIManager.measure` di SHADOW TREE, bukan view native yang tampil di layar.
 * Reanimated menganimasikan transform di UI thread dan TIDAK menulis balik
 * nilai akhirnya ke shadow tree (facebook/react-native#51621; reanimated
 * belum sync-after-animation). Akibatnya, setelah induk beranimasi ke posisi
 * non-identitas (sheet di-translate dari luar layar, baris swipe yang
 * tersnap terbuka), region tombol di dalamnya menurut shadow tree ada di
 * posisi LAMA: jari keluar region saat sedikit bergerak (LEAVE_PRESS_RECT)
 * dan `onPress` tidak pernah dipanggil — di web (posisi DOM nyata) semua baik.
 *
 * Solusi resmi untuk pola ini adalah Pressable berbasis gesture-handler
 * (RNGH), yang menghitung target dari hierarki view NATIVE:
 *   https://github.com/facebook/react-native/issues/51621#potential-solutions
 *
 * Pemakaian:
 *   - BottomSheet memasang provider melingkupi kartu sheet (posisi animasi
 *     non-identitas sepenuhnya);
 *   - SwipeableListItem memasangnya di sekitar baris yang tersnap terbuka.
 * PressableScale (dan icon Pressable di Input) membacanya dan otomatis
 * memakai GesturePressable (components/ui/gesture-pressable) hanya pada
 * native — web tetap Pressable react-native-web apa adanya.
 *
 * Catatan: Modal/Dialog TIDAK perlu provider: animasinya RN `Animated`
 * (useNativeDriver) yang men-sync nilai akhir ke shadow tree saat selesai
 * (RN #43374).
 */
import { createContext } from "react"

export const InsideReanimatedTransformContext = createContext(false)
