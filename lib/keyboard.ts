/**
 * Padanan Android untuk `keyboardDismissMode="on-drag"`.
 *
 * Di RN, prop `keyboardDismissMode` pada ScrollView/FlatList hanya diterapkan
 * di iOS (di Android modul scroll tidak punya dukungan native — terlihat dari
 * ReactScrollViewManager yang tidak mengekspos prop ini; hanya DrawerLayout
 * yang punya no-op). Akibatnya di Android keyboard tetap terbuka saat daftar
 * digeser, padahal di iOS/web prop itu bekerja.
 *
 * Spread props ini ke scroller di samping `keyboardDismissMode="on-drag"`:
 *
 *   <ScrollView keyboardDismissMode="on-drag" {...dismissKeyboardOnDragProps}>
 *
 * Keyboard.dismiss() aman/no-op saat keyboard sedang tertutup, jadi tidak
 * perlu dijaga dengan state.
 */
import { Keyboard, Platform, type ScrollViewProps } from "react-native"

export const dismissKeyboardOnDragProps: Pick<ScrollViewProps, "onScrollBeginDrag"> =
  Platform.OS === "android"
    ? {
        onScrollBeginDrag: () => {
          Keyboard.dismiss()
        },
      }
    : {}
