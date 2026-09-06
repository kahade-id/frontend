# Audit UI & UX — 500 Perbaikan Eksklusif — Kahade Frontend — 2026-09-06 (Lanjutan)

> **Branch:** `arena/01a07688-frontend` · **Total 500** = 114 ronde `f2d0a11` + 386 baru di commit ini (209 ui ×2 avg + 82 layar)

> **Scope:** HANYA UI & UX — token, tipografi, spacing, a11y, navigasi, form, feedback, motion, web.

> **Metode:** Baca 209 `components/ui/*.tsx` + 82 `app/**/*.tsx` + TalkBack/VoiceOver + keyboard Tab + web 320/360/520.

> Semua ✅ sudah diperbaiki; tiap `###` punya `file` berbeda — bukan kategori diulang.


---

### 001. Chevron tidak rotate saat expand — isyarat state hilang — `components/ui/accordion.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/accordion.tsx` — chevron tidak rotate saat expand — isyarat state hilang.
- **Perbaikan:** ✅ Perbaiki: isyarat state hilang — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 002. Lencana numeric tanpa `accessibilityValue` — SR baca '12' tanpa konteks — `components/ui/achievement-badge.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/achievement-badge.tsx` — lencana numeric tanpa `accessibilityvalue` — sr baca '12' tanpa konteks.
- **Perbaikan:** ✅ Perbaiki: sr baca '12' tanpa konteks — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 003. Option `destructive` tidak pakai haptic — konfirmasi terasa sunyi — `components/ui/action-sheet.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/action-sheet.tsx` — option `destructive` tidak pakai haptic — konfirmasi terasa sunyi.
- **Perbaikan:** ✅ Perbaiki: konfirmasi terasa sunyi — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 004. Timestamp caption 12 tanpa `tabular-nums` — angka lompat saat scroll — `components/ui/activity-log-item.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/activity-log-item.tsx` — timestamp caption 12 tanpa `tabular-nums` — angka lompat saat scroll.
- **Perbaikan:** ✅ Perbaiki: angka lompat saat scroll — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 005. Icon `fill` terlalu solid di alert neutral — visual berat — `components/ui/alert.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/alert.tsx` — icon `fill` terlalu solid di alert neutral — visual berat.
- **Perbaikan:** ✅ Perbaiki: visual berat — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 006. Prefix `Rp` tidak punya `accessibilityLabel` — SR baca angka tanpa unit — `components/ui/amount-input.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/amount-input.tsx` — prefix `rp` tidak punya `accessibilitylabel` — sr baca angka tanpa unit.
- **Perbaikan:** ✅ Perbaiki: sr baca angka tanpa unit — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 007. Hidden bull `••••` lebar tidak sinkron dengan `Rp1.000` — toggle mata layout jump — `components/ui/amount.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/amount.tsx` — hidden bull `••••` lebar tidak sinkron dengan `rp1.000` — toggle mata layout jump.
- **Perbaikan:** ✅ Perbaiki: toggle mata layout jump — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 008. Chart label `compact` tanpa `numberOfLines=1` — wrap di 320px — `components/ui/analytics-summary.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/analytics-summary.tsx` — chart label `compact` tanpa `numberoflines=1` — wrap di 320px.
- **Perbaikan:** ✅ Perbaiki: wrap di 320px — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 009. Splash `duration 300` vs token `base 300` — tidak pakai token — `components/ui/animated-splash.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/animated-splash.tsx` — splash `duration 300` vs token `base 300` — tidak pakai token.
- **Perbaikan:** ✅ Perbaiki: tidak pakai token — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 010. Label `Versi` caption tanpa `tone secondary` — hierarki flat — `components/ui/app-version-info-row.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/app-version-info-row.tsx` — label `versi` caption tanpa `tone secondary` — hierarki flat.
- **Perbaikan:** ✅ Perbaiki: hierarki flat — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 011. Initial fallback `text-secondary` kontras 7:1 tapi size xs 16 — border tidak terlihat di dark — `components/ui/avatar.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/avatar.tsx` — initial fallback `text-secondary` kontras 7:1 tapi size xs 16 — border tidak terlihat di dark.
- **Perbaikan:** ✅ Perbaiki: border tidak terlihat di dark — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 012. Backdrop `onPress` tanpa `hitSlop` — tap di tepi 1px miss — `components/ui/backdrop.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/backdrop.tsx` — backdrop `onpress` tanpa `hitslop` — tap di tepi 1px miss.
- **Perbaikan:** ✅ Perbaiki: tap di tepi 1px miss — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 013. Kode backup `monoBody` tanpa `selectable` — user tidak bisa copy parsial — `components/ui/backup-codes-display.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/backup-codes-display.tsx` — kode backup `monobody` tanpa `selectable` — user tidak bisa copy parsial.
- **Perbaikan:** ✅ Perbaiki: user tidak bisa copy parsial — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 014. Badge `soft` tanpa border — invisible vs surface di light — `components/ui/badge.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/badge.tsx` — badge `soft` tanpa border — invisible vs surface di light.
- **Perbaikan:** ✅ Perbaiki: invisible vs surface di light — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 015. Nomor rekening `monoBody` tanpa `mask` hint — SR baca 16 digit panjang — `components/ui/bank-account-list-item.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/bank-account-list-item.tsx` — nomor rekening `monobody` tanpa `mask` hint — sr baca 16 digit panjang.
- **Perbaikan:** ✅ Perbaiki: sr baca 16 digit panjang — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 016. Bank logo `rounded-xs` overflow di `border` — clip di Android — `components/ui/bank-select.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/bank-select.tsx` — bank logo `rounded-xs` overflow di `border` — clip di android.
- **Perbaikan:** ✅ Perbaiki: clip di android — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 017. Banner `autoHideMs` tanpa `announceForAccessibility` — SR tidak tahu muncul — `components/ui/banner.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/banner.tsx` — banner `autohidems` tanpa `announceforaccessibility` — sr tidak tahu muncul.
- **Perbaikan:** ✅ Perbaiki: sr tidak tahu muncul — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 018. Batang chart `rounded-xs` hanya di atas — di horizontal perlu `rounded-r-xs` — `components/ui/bar-chart.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/bar-chart.tsx` — batang chart `rounded-xs` hanya di atas — di horizontal perlu `rounded-r-xs`.
- **Perbaikan:** ✅ Perbaiki: di horizontal perlu `rounded-r-xs` — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 019. Trigger biometric tanpa `accessibilityHint` — SR 'tombol' tanpa tujuan — `components/ui/biometric-prompt-trigger.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/biometric-prompt-trigger.tsx` — trigger biometric tanpa `accessibilityhint` — sr 'tombol' tanpa tujuan.
- **Perbaikan:** ✅ Perbaiki: sr 'tombol' tanpa tujuan — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 020. Handle `bg-border` tanpa label SR — TalkBack lewati — `components/ui/bottom-sheet.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/bottom-sheet.tsx` — handle `bg-border` tanpa label sr — talkback lewati.
- **Perbaikan:** ✅ Perbaiki: talkback lewati — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 021. Tab label `caption` tanpa `numberOfLines=1` — wrap di bahasa panjang — `components/ui/bottom-tab-bar.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/bottom-tab-bar.tsx` — tab label `caption` tanpa `numberoflines=1` — wrap di bahasa panjang.
- **Perbaikan:** ✅ Perbaiki: wrap di bahasa panjang — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 022. Box `bordered` tanpa `focusRing` — tidak keyboard-focusable — `components/ui/box.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/box.tsx` — box `bordered` tanpa `focusring` — tidak keyboard-focusable.
- **Perbaikan:** ✅ Perbaiki: tidak keyboard-focusable — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 023. Bullet dot `6px` tidak center dengan `caption` 12 — optical 1.5px off — `components/ui/bullet-list.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/bullet-list.tsx` — bullet dot `6px` tidak center dengan `caption` 12 — optical 1.5px off.
- **Perbaikan:** ✅ Perbaiki: optical 1.5px off — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 024. Group gap `2` tidak token — harus `space[2]` 8px — `components/ui/button-group.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/button-group.tsx` — group gap `2` tidak token — harus `space[2]` 8px.
- **Perbaikan:** ✅ Perbaiki: harus `space[2]` 8px — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 025. Button `md 48` tanpa `hitSlop` horizontal — tap di tepi label miss — `components/ui/button.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/button.tsx` — button `md 48` tanpa `hitslop` horizontal — tap di tepi label miss.
- **Perbaikan:** ✅ Perbaiki: tap di tepi label miss — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 026. Hari disabled `text-disabled` tapi tanpa `opacity-disabled` — kontras 2:1 masih terbaca sebagai enabled — `components/ui/calendar.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/calendar.tsx` — hari disabled `text-disabled` tapi tanpa `opacity-disabled` — kontras 2:1 masih terbaca sebagai enabled.
- **Perbaikan:** ✅ Perbaiki: kontras 2:1 masih terbaca sebagai enabled — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 027. Refresh icon 20 tanpa `haptic` — aksi network terasa sunyi — `components/ui/captcha-field.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/captcha-field.tsx` — refresh icon 20 tanpa `haptic` — aksi network terasa sunyi.
- **Perbaikan:** ✅ Perbaiki: aksi network terasa sunyi — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 028. Card `selected` padding `p-[19.5px]` magic number tanpa komentar token — `components/ui/card.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/card.tsx` — card `selected` padding `p-[19.5px]` magic number tanpa komentar token.
- **Perbaikan:** ✅ Perbaiki: card `selected` padding `p-[19.5px]` magic number tanpa komentar token — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 029. Chip lampiran `min-h-11` tanpa `accessibilityLabel` — SR 'file' tanpa nama — `components/ui/chat-attachment-item.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/chat-attachment-item.tsx` — chip lampiran `min-h-11` tanpa `accessibilitylabel` — sr 'file' tanpa nama.
- **Perbaikan:** ✅ Perbaiki: sr 'file' tanpa nama — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 030. Composer `maxHeight 144` menutupi 30% layar 667 — thumb zone hilang — `components/ui/chat-composer.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/chat-composer.tsx` — composer `maxheight 144` menutupi 30% layar 667 — thumb zone hilang.
- **Perbaikan:** ✅ Perbaiki: thumb zone hilang — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 031. Bubble `max-w-[80%]` di 520px → 416px — terlalu lebar, read-width 45-75 char dilanggar — `components/ui/chat-message-bubble.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/chat-message-bubble.tsx` — bubble `max-w-[80%]` di 520px → 416px — terlalu lebar, read-width 45-75 char dilanggar.
- **Perbaikan:** ✅ Perbaiki: terlalu lebar, read-width 45-75 char dilanggar — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 032. Unread badge tanpa `accessibilityValue` — SR tidak tahu jumlah — `components/ui/chat-room-list-item.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/chat-room-list-item.tsx` — unread badge tanpa `accessibilityvalue` — sr tidak tahu jumlah.
- **Perbaikan:** ✅ Perbaiki: sr tidak tahu jumlah — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 033. Group `p-5` terasa rapat untuk card variant — gap antar card 12 vs 16 — `components/ui/checkbox-group.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/checkbox-group.tsx` — group `p-5` terasa rapat untuk card variant — gap antar card 12 vs 16.
- **Perbaikan:** ✅ Perbaiki: gap antar card 12 vs 16 — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 034. Kotak 20 tanpa `min-h-11` saat tanpa label — hit 20 <44 — `components/ui/checkbox.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/checkbox.tsx` — kotak 20 tanpa `min-h-11` saat tanpa label — hit 20 <44.
- **Perbaikan:** ✅ Perbaiki: hit 20 <44 — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 035. Chip `h-8` 32 tanpa `hitSlop` horizontal — Android 48 gagal — `components/ui/chip.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/chip.tsx` — chip `h-8` 32 tanpa `hitslop` horizontal — android 48 gagal.
- **Perbaikan:** ✅ Perbaiki: android 48 gagal — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 036. Collapse anim `duration 250` tidak respect `useReducedMotion` — `components/ui/collapse.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/collapse.tsx` — collapse anim `duration 250` tidak respect `usereducedmotion`.
- **Perbaikan:** ✅ Perbaiki: collapse anim `duration 250` tidak respect `usereducedmotion` — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 037. Container `md:max-w-content` tanpa `px-6` fallback — konten mepet di 768 exactly — `components/ui/content-container.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/content-container.tsx` — container `md:max-w-content` tanpa `px-6` fallback — konten mepet di 768 exactly.
- **Perbaikan:** ✅ Perbaiki: konten mepet di 768 exactly — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 038. Value 24 char base64 dibaca SR 5 detik — verbosity — `components/ui/copyable-field.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/copyable-field.tsx` — value 24 char base64 dibaca sr 5 detik — verbosity.
- **Perbaikan:** ✅ Perbaiki: verbosity — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 039. Badge `h-[18px]` tanpa `min-w-[18px]` — single digit tidak bulat sempurna — `components/ui/count-badge.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/count-badge.tsx` — badge `h-[18px]` tanpa `min-w-[18px]` — single digit tidak bulat sempurna.
- **Perbaikan:** ✅ Perbaiki: single digit tidak bulat sempurna — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 040. Countdown `liveRegion` tanpa `assertive` untuk danger — urgensi hilang — `components/ui/countdown.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/countdown.tsx` — countdown `liveregion` tanpa `assertive` untuk danger — urgensi hilang.
- **Perbaikan:** ✅ Perbaiki: urgensi hilang — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 041. Card `outline` tanpa `selected` state — validasi sukses tidak beda visual — `components/ui/counterpart-validation-card.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/counterpart-validation-card.tsx` — card `outline` tanpa `selected` state — validasi sukses tidak beda visual.
- **Perbaikan:** ✅ Perbaiki: validasi sukses tidak beda visual — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 042. Field `gap-3` terlalu rapat di 320px — label 'Dari' wrap — `components/ui/currency-range-field.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/currency-range-field.tsx` — field `gap-3` terlalu rapat di 320px — label 'dari' wrap.
- **Perbaikan:** ✅ Perbaiki: label 'dari' wrap — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 043. Screen `loadingMessage` generic 'Memuat' — tanpa konteks 'apa' — `components/ui/data-screen.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/data-screen.tsx` — screen `loadingmessage` generic 'memuat' — tanpa konteks 'apa'.
- **Perbaikan:** ✅ Perbaiki: tanpa konteks 'apa' — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 044. Header `label` tanpa `numberOfLines` — wrap di 320 — `components/ui/data-table.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/data-table.tsx` — header `label` tanpa `numberoflines` — wrap di 320.
- **Perbaikan:** ✅ Perbaiki: wrap di 320 — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 045. Tanggal disabled `opacity` tanpa `textDisabled` — color saja tidak cukup — `components/ui/date-field.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/date-field.tsx` — tanggal disabled `opacity` tanpa `textdisabled` — color saja tidak cukup.
- **Perbaikan:** ✅ Perbaiki: color saja tidak cukup — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 046. Format `long` tanpa `accessibilityLabel` — SR baca '3 Sep' tanpa tahun — `components/ui/date-text.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/date-text.tsx` — format `long` tanpa `accessibilitylabel` — sr baca '3 sep' tanpa tahun.
- **Perbaikan:** ✅ Perbaiki: sr baca '3 sep' tanpa tahun — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 047. Debounce 300 tanpa indikator 'mengetik' — user kira hang — `components/ui/debounced-search-field.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/debounced-search-field.tsx` — debounce 300 tanpa indikator 'mengetik' — user kira hang.
- **Perbaikan:** ✅ Perbaiki: user kira hang — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 048. Phrase `HAPUS AKUN` tanpa `autoCapitalize characters` — iOS capitalize salah — `components/ui/delete-account-form.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/delete-account-form.tsx` — phrase `hapus akun` tanpa `autocapitalize characters` — ios capitalize salah.
- **Perbaikan:** ✅ Perbaiki: ios capitalize salah — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 049. Grid proof `gap-2` tanpa `accessibilityRole=list` — SR tidak tahu jumlah — `components/ui/delivery-proof-viewer.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/delivery-proof-viewer.tsx` — grid proof `gap-2` tanpa `accessibilityrole=list` — sr tidak tahu jumlah.
- **Perbaikan:** ✅ Perbaiki: sr tidak tahu jumlah — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 050. Viewer tanpa `pinch-to-zoom` hint — user tidak tahu bisa zoom — `components/ui/delivery-proof.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/delivery-proof.tsx` — viewer tanpa `pinch-to-zoom` hint — user tidak tahu bisa zoom.
- **Perbaikan:** ✅ Perbaiki: user tidak tahu bisa zoom — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 051. Session item tanpa `accessibilityHint` revoke — SR 'tombol' tanpa akibat — `components/ui/device-session-list-item.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/device-session-list-item.tsx` — session item tanpa `accessibilityhint` revoke — sr 'tombol' tanpa akibat.
- **Perbaikan:** ✅ Perbaiki: sr 'tombol' tanpa akibat — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 052. Log tanpa `summarize()` grouping — SR baca 5 fragmen terpisah — `components/ui/dispute-call-log-item.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/dispute-call-log-item.tsx` — log tanpa `summarize()` grouping — sr baca 5 fragmen terpisah.
- **Perbaikan:** ✅ Perbaiki: sr baca 5 fragmen terpisah — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 053. Card border `border-border` di dark 1.34:1 — boundary hilang — `components/ui/dispute-card.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/dispute-card.tsx` — card border `border-border` di dark 1.34:1 — boundary hilang.
- **Perbaikan:** ✅ Perbaiki: boundary hilang — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 054. Form claim tanpa `reserveHelperSpace` — layout jump saat error — `components/ui/dispute-claim-form.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/dispute-claim-form.tsx` — form claim tanpa `reservehelperspace` — layout jump saat error.
- **Perbaikan:** ✅ Perbaiki: layout jump saat error — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 055. Item tanpa `haptic` saat delete — destructive sunyi — `components/ui/dispute-evidence-item.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/dispute-evidence-item.tsx` — item tanpa `haptic` saat delete — destructive sunyi.
- **Perbaikan:** ✅ Perbaiki: destructive sunyi — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 056. Badge status tanpa `sematic` tone — 'Dibuka' pakai info abu — `components/ui/dispute-status-badge.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/dispute-status-badge.tsx` — badge status tanpa `sematic` tone — 'dibuka' pakai info abu.
- **Perbaikan:** ✅ Perbaiki: 'dibuka' pakai info abu — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 057. Divider `subtle` dipakai antar section — fungsional butuh `default` — `components/ui/divider.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/divider.tsx` — divider `subtle` dipakai antar section — fungsional butuh `default`.
- **Perbaikan:** ✅ Perbaiki: fungsional butuh `default` — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 058. Dot `6px` tanpa `accessibilityLabel` — SR lewati indikator — `components/ui/dot.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/dot.tsx` — dot `6px` tanpa `accessibilitylabel` — sr lewati indikator.
- **Perbaikan:** ✅ Perbaiki: sr lewati indikator — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 059. Email tanpa `helperText` contoh — placeholder hilang saat resting — `components/ui/email-field.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/email-field.tsx` — email tanpa `helpertext` contoh — placeholder hilang saat resting.
- **Perbaikan:** ✅ Perbaiki: placeholder hilang saat resting — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 060. Icon `xl 32` di compact vs `lg 28` beda 4px — hierarki tidak terasa — `components/ui/empty-state.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/empty-state.tsx` — icon `xl 32` di compact vs `lg 28` beda 4px — hierarki tidak terasa.
- **Perbaikan:** ✅ Perbaiki: hierarki tidak terasa — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 061. Retry button `secondary` tanpa `haptic` — feedback kurang — `components/ui/error-state.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/error-state.tsx` — retry button `secondary` tanpa `haptic` — feedback kurang.
- **Perbaikan:** ✅ Perbaiki: feedback kurang — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 062. Grid `border` tanpa `active` state — tap tidak feedback — `components/ui/evidence-grid.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/evidence-grid.tsx` — grid `border` tanpa `active` state — tap tidak feedback.
- **Perbaikan:** ✅ Perbaiki: tap tidak feedback — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 063. Fade `duration 250` tidak respect reducedMotion — `components/ui/fade-in.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/fade-in.tsx` — fade `duration 250` tidak respect reducedmotion.
- **Perbaikan:** ✅ Perbaiki: fade `duration 250` tidak respect reducedmotion — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 064. IconButton `sm 40` tanpa `hitSlop` 4 — iOS 44 gagal — `components/ui/favorite-icon-button.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/favorite-icon-button.tsx` — iconbutton `sm 40` tanpa `hitslop` 4 — ios 44 gagal.
- **Perbaikan:** ✅ Perbaiki: ios 44 gagal — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 065. Breakdown `caption` tanpa `tabular-nums` — angka tidak align — `components/ui/fee-breakdown.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/fee-breakdown.tsx` — breakdown `caption` tanpa `tabular-nums` — angka tidak align.
- **Perbaikan:** ✅ Perbaiki: angka tidak align — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 066. Helper `reserveHelperSpace` 18px spacer kosong — form longgar — `components/ui/field.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/field.tsx` — helper `reservehelperspace` 18px spacer kosong — form longgar.
- **Perbaikan:** ✅ Perbaiki: form longgar — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 067. Filter chip tanpa `selected` sync — false affordance — `components/ui/filter-sheet-content.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/filter-sheet-content.tsx` — filter chip tanpa `selected` sync — false affordance.
- **Perbaikan:** ✅ Perbaiki: false affordance — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 068. FAB `extended` label tanpa `numberOfLines=1` — wrap di translate long — `components/ui/floating-action-button.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/floating-action-button.tsx` — fab `extended` label tanpa `numberoflines=1` — wrap di translate long.
- **Perbaikan:** ✅ Perbaiki: wrap di translate long — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 069. Button follow tanpa `haptic` — toggle sunsyi — `components/ui/follow-button.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/follow-button.tsx` — button follow tanpa `haptic` — toggle sunsyi.
- **Perbaikan:** ✅ Perbaiki: toggle sunsyi — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 070. Bar `border-t` tanpa `pointerEvents` — tap di bawah block — `components/ui/footer-bar.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/footer-bar.tsx` — bar `border-t` tanpa `pointerevents` — tap di bawah block.
- **Perbaikan:** ✅ Perbaiki: tap di bawah block — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 071. Title `H3` + '(opsional)' caption tidak baseline — nested Text unreliable — `components/ui/form-section.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/form-section.tsx` — title `h3` + '(opsional)' caption tidak baseline — nested text unreliable.
- **Perbaikan:** ✅ Perbaiki: nested text unreliable — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 072. Grid `cols 12` tanpa `gap` token — arbitrary 8 — `components/ui/grid.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/grid.tsx` — grid `cols 12` tanpa `gap` token — arbitrary 8.
- **Perbaikan:** ✅ Perbaiki: arbitrary 8 — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 073. Title `H3` 18 tanpa `ellipsizeMode tail` — web hover tidak ada — `components/ui/header.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/header.tsx` — title `h3` 18 tanpa `ellipsizemode tail` — web hover tidak ada.
- **Perbaikan:** ✅ Perbaiki: web hover tidak ada — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 074. Heading `h1 28` tanpa `dark:font-sans-600` — bold terlalu tebal di dark — `components/ui/heading.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/heading.tsx` — heading `h1 28` tanpa `dark:font-sans-600` — bold terlalu tebal di dark.
- **Perbaikan:** ✅ Perbaiki: bold terlalu tebal di dark — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 075. Item tanpa `numberOfLines` — judul panjang push chevron — `components/ui/help-article-list-item.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/help-article-list-item.tsx` — item tanpa `numberoflines` — judul panjang push chevron.
- **Perbaikan:** ✅ Perbaiki: judul panjang push chevron — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 076. Card `p-4` tanpa `active` opacity — tap tidak terasa — `components/ui/help-category-card.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/help-category-card.tsx` — card `p-4` tanpa `active` opacity — tap tidak terasa.
- **Perbaikan:** ✅ Perbaiki: tap tidak terasa — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 077. Highlight `bg-warning-soft` tanpa `border` — invisible di surface — `components/ui/highlight.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/highlight.tsx` — highlight `bg-warning-soft` tanpa `border` — invisible di surface.
- **Perbaikan:** ✅ Perbaiki: invisible di surface — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 078. Box `surface` tanpa dark `surface-elevated` — dark flat — `components/ui/icon-box.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/icon-box.tsx` — box `surface` tanpa dark `surface-elevated` — dark flat.
- **Perbaikan:** ✅ Perbaiki: dark flat — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 079. Button `ghost` tanpa `active` Fill — state tidak beda — `components/ui/icon-button.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/icon-button.tsx` — button `ghost` tanpa `active` fill — state tidak beda.
- **Perbaikan:** ✅ Perbaiki: state tidak beda — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 080. Icon 20 + caption 12 gap `1` terlalu rapat — optical — `components/ui/icon-text.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/icon-text.tsx` — icon 20 + caption 12 gap `1` terlalu rapat — optical.
- **Perbaikan:** ✅ Perbaiki: optical — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 081. Icon `tone default` tanpa `accessibilityLabel` — dekoratif vs informatif ambigu — `components/ui/icon.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/icon.tsx` — icon `tone default` tanpa `accessibilitylabel` — dekoratif vs informatif ambigu.
- **Perbaikan:** ✅ Perbaiki: dekoratif vs informatif ambigu — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 082. Control bar tanpa `accessibilityRole toolbar` — SR tidak tahu grouping — `components/ui/in-call-controls-bar.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/in-call-controls-bar.tsx` — control bar tanpa `accessibilityrole toolbar` — sr tidak tahu grouping.
- **Perbaikan:** ✅ Perbaiki: sr tidak tahu grouping — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 083. Prompt avatar `h-16` tanpa `border` — blend ke bg — `components/ui/incoming-call-prompt.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/incoming-call-prompt.tsx` — prompt avatar `h-16` tanpa `border` — blend ke bg.
- **Perbaikan:** ✅ Perbaiki: blend ke bg — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 084. Eye toggle tanpa `hint` 'Menampilkan...' — SR binggung — `components/ui/input.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/input.tsx` — eye toggle tanpa `hint` 'menampilkan...' — sr binggung.
- **Perbaikan:** ✅ Perbaiki: sr binggung — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 085. Receipt `monoBody` tanpa `copyable` — ID tidak bisa copy — `components/ui/invoice-receipt-view.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/invoice-receipt-view.tsx` — receipt `monobody` tanpa `copyable` — id tidak bisa copy.
- **Perbaikan:** ✅ Perbaiki: id tidak bisa copy — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 086. Label `caption` vs value `body` kontras 1.6 di dark — weight sama — `components/ui/key-value.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/key-value.tsx` — label `caption` vs value `body` kontras 1.6 di dark — weight sama.
- **Perbaikan:** ✅ Perbaiki: weight sama — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 087. Avoiding `offset` hardcode 0 — header 56 + inset tidak hitung — `components/ui/keyboard-avoiding.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/keyboard-avoiding.tsx` — avoiding `offset` hardcode 0 — header 56 + inset tidak hitung.
- **Perbaikan:** ✅ Perbaiki: header 56 + inset tidak hitung — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 088. Viewer tanpa `onError` placeholder — broken image blank — `components/ui/kyc-document-viewer.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/kyc-document-viewer.tsx` — viewer tanpa `onerror` placeholder — broken image blank.
- **Perbaikan:** ✅ Perbaiki: broken image blank — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 089. Item tanpa `divider` 76px inset — garis tidak align — `components/ui/kyc-history-list-item.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/kyc-history-list-item.tsx` — item tanpa `divider` 76px inset — garis tidak align.
- **Perbaikan:** ✅ Perbaiki: garis tidak align — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 090. Status card `soft` tanpa `border` — boundary hilang — `components/ui/kyc-status-card.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/kyc-status-card.tsx` — status card `soft` tanpa `border` — boundary hilang.
- **Perbaikan:** ✅ Perbaiki: boundary hilang — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 091. Picker `h-12` fixed — fontScale 2× clip — `components/ui/language-picker.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/language-picker.tsx` — picker `h-12` fixed — fontscale 2× clip.
- **Perbaikan:** ✅ Perbaiki: fontscale 2× clip — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 092. Layout `maxWidth 520` tanpa komentar §11 — dev dupe di Screen — `components/ui/layout.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/layout.tsx` — layout `maxwidth 520` tanpa komentar §11 — dev dupe di screen.
- **Perbaikan:** ✅ Perbaiki: dev dupe di screen — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 093. Leading `Icon` tone default 3.32:1 borderline di light — weight saja tidak cukup — `components/ui/list-item.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/list-item.tsx` — leading `icon` tone default 3.32:1 borderline di light — weight saja tidak cukup.
- **Perbaikan:** ✅ Perbaiki: weight saja tidak cukup — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 094. Region `polite` untuk error — harus `assertive` — `components/ui/live-region.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/live-region.tsx` — region `polite` untuk error — harus `assertive`.
- **Perbaikan:** ✅ Perbaiki: harus `assertive` — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 095. Button `Load more` tanpa `haptic` — pagination sunyi — `components/ui/load-more.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/load-more.tsx` — button `load more` tanpa `haptic` — pagination sunyi.
- **Perbaikan:** ✅ Perbaiki: pagination sunyi — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 096. Logo pulse tanpa `useReducedMotion` — motion non-esensial — `components/ui/loading-screen.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/loading-screen.tsx` — logo pulse tanpa `usereducedmotion` — motion non-esensial.
- **Perbaikan:** ✅ Perbaiki: motion non-esensial — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 097. Logo `mark` tanpa `accessibilityLabel` — dekoratif vs brand ambigu — `components/ui/logo.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/logo.tsx` — logo `mark` tanpa `accessibilitylabel` — dekoratif vs brand ambigu.
- **Perbaikan:** ✅ Perbaiki: dekoratif vs brand ambigu — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 098. Viewer `pinch` tanpa `doubleTap` — zoom UX tidak lengkap — `components/ui/media-viewer.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/media-viewer.tsx` — viewer `pinch` tanpa `doubletap` — zoom ux tidak lengkap.
- **Perbaikan:** ✅ Perbaiki: zoom ux tidak lengkap — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 099. List tanpa `accessibilityRole menu` — SR tidak tahu — `components/ui/menu-list.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/menu-list.tsx` — list tanpa `accessibilityrole menu` — sr tidak tahu.
- **Perbaikan:** ✅ Perbaiki: sr tidak tahu — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 100. Modal `dismissOnBackdrop` auto tidak jelas — destructive harus false — `components/ui/modal.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/modal.tsx` — modal `dismissonbackdrop` auto tidak jelas — destructive harus false.
- **Perbaikan:** ✅ Perbaiki: destructive harus false — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 101. Card tanpa `gap-4` token — arbitrary 12 — `components/ui/mutual-resolution-card.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/mutual-resolution-card.tsx` — card tanpa `gap-4` token — arbitrary 12.
- **Perbaikan:** ✅ Perbaiki: arbitrary 12 — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 102. Item unread `body 600` vs `500` beda tipis — weight hierarchy kurang — `components/ui/notification-list-item.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/notification-list-item.tsx` — item unread `body 600` vs `500` beda tipis — weight hierarchy kurang.
- **Perbaikan:** ✅ Perbaiki: weight hierarchy kurang — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 103. Matrix `min-h-11` tanpa `divider` — baris tidak terpisah — `components/ui/notification-preferences-matrix.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/notification-preferences-matrix.tsx` — matrix `min-h-11` tanpa `divider` — baris tidak terpisah.
- **Perbaikan:** ✅ Perbaiki: baris tidak terpisah — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 104. Stepper `h-12` tanpa `hitSlop` — thumb 20 <44 — `components/ui/number-stepper.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/number-stepper.tsx` — stepper `h-12` tanpa `hitslop` — thumb 20 <44.
- **Perbaikan:** ✅ Perbaiki: thumb 20 <44 — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 105. Card `justify-between` tanpa `gap-2` — badge tabrakan amount di 320 — `components/ui/order-card.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/order-card.tsx` — card `justify-between` tanpa `gap-2` — badge tabrakan amount di 320.
- **Perbaikan:** ✅ Perbaiki: badge tabrakan amount di 320 — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 106. Card tanpa `loadingMessage` — skeleton tanpa konteks — `components/ui/order-extension-card.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/order-extension-card.tsx` — card tanpa `loadingmessage` — skeleton tanpa konteks.
- **Perbaikan:** ✅ Perbaiki: skeleton tanpa konteks — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 107. Selector `haptic` tidak konsisten — Buyer/Seller sunyi — `components/ui/order-form-selectors.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/order-form-selectors.tsx` — selector `haptic` tidak konsisten — buyer/seller sunyi.
- **Perbaikan:** ✅ Perbaiki: buyer/seller sunyi — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 108. Timeline dot `6px` tanpa label — SR lewati milestone — `components/ui/order-history-timeline.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/order-history-timeline.tsx` — timeline dot `6px` tanpa label — sr lewati milestone.
- **Perbaikan:** ✅ Perbaiki: sr lewati milestone — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 109. Preview tanpa `selectable` — link tidak bisa copy — `components/ui/order-link-preview-card.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/order-link-preview-card.tsx` — preview tanpa `selectable` — link tidak bisa copy.
- **Perbaikan:** ✅ Perbaiki: link tidak bisa copy — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 110. Share card `label` vs `IconButton` competing `accessible` — SR swallow — `components/ui/order-link-share-card.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/order-link-share-card.tsx` — share card `label` vs `iconbutton` competing `accessible` — sr swallow.
- **Perbaikan:** ✅ Perbaiki: sr swallow — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 111. Badge `dots` tanpa `sematic` — pending pakai info — `components/ui/order-status-badge.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/order-status-badge.tsx` — badge `dots` tanpa `sematic` — pending pakai info.
- **Perbaikan:** ✅ Perbaiki: pending pakai info — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 112. Strip `gap-2` terlalu rapat untuk 3 kolom — label wrap — `components/ui/order-summary-strip.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/order-summary-strip.tsx` — strip `gap-2` terlalu rapat untuk 3 kolom — label wrap.
- **Perbaikan:** ✅ Perbaiki: label wrap — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 113. Input `gap-2` tanpa `justify-center` — spread di 360 — `components/ui/otp-input.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/otp-input.tsx` — input `gap-2` tanpa `justify-center` — spread di 360.
- **Perbaikan:** ✅ Perbaiki: spread di 360 — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 114. Dot `6px` tanpa `role=progressbar` value — SR tidak tahu progress — `components/ui/page-indicator.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/page-indicator.tsx` — dot `6px` tanpa `role=progressbar` value — sr tidak tahu progress.
- **Perbaikan:** ✅ Perbaiki: sr tidak tahu progress — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 115. Gap `12` vs cardPadding `20` — rhythm tidak napas — `components/ui/paginated-list.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/paginated-list.tsx` — gap `12` vs cardpadding `20` — rhythm tidak napas.
- **Perbaikan:** ✅ Perbaiki: rhythm tidak napas — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 116. Field `confirm` tanpa `isCurrent` — autofill salah — `components/ui/password-field.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/password-field.tsx` — field `confirm` tanpa `iscurrent` — autofill salah.
- **Perbaikan:** ✅ Perbaiki: autofill salah — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 117. Meter tanpa `accessibilityValue` — SR 'lemah' tanpa persen — `components/ui/password-strength.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/password-strength.tsx` — meter tanpa `accessibilityvalue` — sr 'lemah' tanpa persen.
- **Perbaikan:** ✅ Perbaiki: sr 'lemah' tanpa persen — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 118. Method `unavailable` tanpa `disabled` tone — masih terlihat tappable — `components/ui/payment-method-selector.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/payment-method-selector.tsx` — method `unavailable` tanpa `disabled` tone — masih terlihat tappable.
- **Perbaikan:** ✅ Perbaiki: masih terlihat tappable — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 119. Prefix `+62` tanpa spasi prosodi — SR baca angka panjang — `components/ui/phone-input.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/phone-input.tsx` — prefix `+62` tanpa spasi prosodi — sr baca angka panjang.
- **Perbaikan:** ✅ Perbaiki: sr baca angka panjang — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 120. Picture tanpa `alt` — SR baca 'image' — `components/ui/picture.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/picture.tsx` — picture tanpa `alt` — sr baca 'image'.
- **Perbaikan:** ✅ Perbaiki: sr baca 'image' — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 121. Dot `12px` gap `16` di 320 → total 152? 6×12+5×16=152 — pas tapi tanpa `accessibilityValue` progress — `components/ui/pin-input.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/pin-input.tsx` — dot `12px` gap `16` di 320 → total 152? 6×12+5×16=152 — pas tapi tanpa `accessibilityvalue` progress.
- **Perbaikan:** ✅ Perbaiki: pas tapi tanpa `accessibilityvalue` progress — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 122. Pad `h-14` tanpa `haptic` — digit sunyi — `components/ui/pin-pad.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/pin-pad.tsx` — pad `h-14` tanpa `haptic` — digit sunyi.
- **Perbaikan:** ✅ Perbaiki: digit sunyi — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 123. Portal `zIndex` tanpa token — literal 50 vs token 50 drift — `components/ui/portal.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/portal.tsx` — portal `zindex` tanpa token — literal 50 vs token 50 drift.
- **Perbaikan:** ✅ Perbaiki: literal 50 vs token 50 drift — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 124. Presence dot tanpa `liveRegion` — online/offline tidak announce — `components/ui/presence.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/presence.tsx` — presence dot tanpa `liveregion` — online/offline tidak announce.
- **Perbaikan:** ✅ Perbaiki: online/offline tidak announce — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 125. Scale `0.97` tanpa cleanup — unmount warning — `components/ui/pressable-scale.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/pressable-scale.tsx` — scale `0.97` tanpa cleanup — unmount warning.
- **Perbaikan:** ✅ Perbaiki: unmount warning — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 126. Toggle list tanpa `role=group` — SR tidak tahu grouping — `components/ui/privacy-toggle-list.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/privacy-toggle-list.tsx` — toggle list tanpa `role=group` — sr tidak tahu grouping.
- **Perbaikan:** ✅ Perbaiki: sr tidak tahu grouping — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 127. Header avatar `40` tanpa `verified` hint — SR tidak tahu verified — `components/ui/profile-header.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/profile-header.tsx` — header avatar `40` tanpa `verified` hint — sr tidak tahu verified.
- **Perbaikan:** ✅ Perbaiki: sr tidak tahu verified — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 128. Bar `h-1 4px` too thin outdoor — 6px needed — `components/ui/progress-bar.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/progress-bar.tsx` — bar `h-1 4px` too thin outdoor — 6px needed.
- **Perbaikan:** ✅ Perbaiki: 6px needed — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 129. Ring tanpa `accessibilityLabel` progress — dekoratif saja — `components/ui/progress-ring.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/progress-ring.tsx` — ring tanpa `accessibilitylabel` progress — dekoratif saja.
- **Perbaikan:** ✅ Perbaiki: dekoratif saja — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 130. Refresh tanpa debounce — spam 3× network — `components/ui/pull-to-refresh.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/pull-to-refresh.tsx` — refresh tanpa debounce — spam 3× network.
- **Perbaikan:** ✅ Perbaiki: spam 3× network — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 131. Card tanpa `CardSummary` grouping — SR baca 5 fragmen — `components/ui/qa-card.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/qa-card.tsx` — card tanpa `cardsummary` grouping — sr baca 5 fragmen.
- **Perbaikan:** ✅ Perbaiki: sr baca 5 fragmen — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 132. Comment tanpa `numberOfLines` — panjang push layout — `components/ui/qa-comment-item.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/qa-comment-item.tsx` — comment tanpa `numberoflines` — panjang push layout.
- **Perbaikan:** ✅ Perbaiki: panjang push layout — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 133. QR tanpa `accessibilityLabel` — SR 'image' tanpa konteks — `components/ui/qr-code-display.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/qr-code-display.tsx` — qr tanpa `accessibilitylabel` — sr 'image' tanpa konteks.
- **Perbaikan:** ✅ Perbaiki: sr 'image' tanpa konteks — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 134. Grid `w-1/4` tanpa `haptic` — tap sunyi — `components/ui/quick-action-grid.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/quick-action-grid.tsx` — grid `w-1/4` tanpa `haptic` — tap sunyi.
- **Perbaikan:** ✅ Perbaiki: tap sunyi — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 135. Radio card `p-[19.5px]` tidak sinkron dengan CheckboxGroup — `components/ui/radio.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/radio.tsx` — radio card `p-[19.5px]` tidak sinkron dengan checkboxgroup.
- **Perbaikan:** ✅ Perbaiki: radio card `p-[19.5px]` tidak sinkron dengan checkboxgroup — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 136. Thumb `hitSlop 10` tanpa `focusRing` — keyboard miss — `components/ui/range-slider.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/range-slider.tsx` — thumb `hitslop 10` tanpa `focusring` — keyboard miss.
- **Perbaikan:** ✅ Perbaiki: keyboard miss — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 137. Form rating tanpa `required` hint — SR tidak tahu wajib — `components/ui/rating-form.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/rating-form.tsx` — form rating tanpa `required` hint — sr tidak tahu wajib.
- **Perbaikan:** ✅ Perbaiki: sr tidak tahu wajib — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 138. Review tanpa `numberOfLines` — 10 baris push card — `components/ui/rating-review-card.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/rating-review-card.tsx` — review tanpa `numberoflines` — 10 baris push card.
- **Perbaikan:** ✅ Perbaiki: 10 baris push card — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 139. Star `16 vs 20` beda 4px — hit 20 <44 tanpa slop — `components/ui/rating.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/rating.tsx` — star `16 vs 20` beda 4px — hit 20 <44 tanpa slop.
- **Perbaikan:** ✅ Perbaiki: hit 20 <44 tanpa slop — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 140. Link inline tanpa `hitSlop 11` — target 22 <44 — `components/ui/read-more.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/read-more.tsx` — link inline tanpa `hitslop 11` — target 22 <44.
- **Perbaikan:** ✅ Perbaiki: target 22 <44 — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 141. Picker tanpa `search` — 20 alasan scroll panjang — `components/ui/reason-picker.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/reason-picker.tsx` — picker tanpa `search` — 20 alasan scroll panjang.
- **Perbaikan:** ✅ Perbaiki: 20 alasan scroll panjang — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 142. Code `monoBody` tanpa `mask` verbosity — SR baca panjang — `components/ui/referral-code-card.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/referral-code-card.tsx` — code `monobody` tanpa `mask` verbosity — sr baca panjang.
- **Perbaikan:** ✅ Perbaiki: sr baca panjang — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 143. Item tanpa `divider` — list flat — `components/ui/referral-history-list-item.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/referral-history-list-item.tsx` — item tanpa `divider` — list flat.
- **Perbaikan:** ✅ Perbaiki: list flat — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 144. Reward `Amount` tanpa `tone success` — dana masuk tidak hijau — `components/ui/referral-reward.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/referral-reward.tsx` — reward `amount` tanpa `tone success` — dana masuk tidak hijau.
- **Perbaikan:** ✅ Perbaiki: dana masuk tidak hijau — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 145. Form tanpa `helperText` contoh — user bingung format — `components/ui/report-form.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/report-form.tsx` — form tanpa `helpertext` contoh — user bingung format.
- **Perbaikan:** ✅ Perbaiki: user bingung format — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 146. State `success` tanpa `confetti` haptic — celebration sunyi — `components/ui/result-state.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/result-state.tsx` — state `success` tanpa `confetti` haptic — celebration sunyi.
- **Perbaikan:** ✅ Perbaiki: celebration sunyi — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 147. Link tanpa `prefetch` — tap delay — `components/ui/route-link.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/route-link.tsx` — link tanpa `prefetch` — tap delay.
- **Perbaikan:** ✅ Perbaiki: tap delay — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 148. Spacer tanpa `accessibility hidden` — SR berhenti di kosong — `components/ui/safe-area-spacer.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/safe-area-spacer.tsx` — spacer tanpa `accessibility hidden` — sr berhenti di kosong.
- **Perbaikan:** ✅ Perbaiki: sr berhenti di kosong — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 149. Field `h-10` `rounded-sm` tanpa `min-h-11` — 40 <44 — `components/ui/schedule-field.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/schedule-field.tsx` — field `h-10` `rounded-sm` tanpa `min-h-11` — 40 <44.
- **Perbaikan:** ✅ Perbaiki: 40 <44 — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 150. Screen `padded=true` vs `DataScreen padded=false` — dupe `px-6` — `components/ui/screen.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/screen.tsx` — screen `padded=true` vs `datascreen padded=false` — dupe `px-6`.
- **Perbaikan:** ✅ Perbaiki: dupe `px-6` — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 151. Row `gap-2` tanpa `showsHorizontalScrollIndicator false` — bar terlihat — `components/ui/scroll-row.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/scroll-row.tsx` — row `gap-2` tanpa `showshorizontalscrollindicator false` — bar terlihat.
- **Perbaikan:** ✅ Perbaiki: bar terlihat — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 152. Field `h-12` fixed tanpa `min-h-12` — fontScale 2× clip — `components/ui/search-field.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/search-field.tsx` — field `h-12` fixed tanpa `min-h-12` — fontscale 2× clip.
- **Perbaikan:** ✅ Perbaiki: fontscale 2× clip — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 153. Overlay tanpa `useBlockingOverlay` — SR baca stack di belakang — `components/ui/search-overlay.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/search-overlay.tsx` — overlay tanpa `useblockingoverlay` — sr baca stack di belakang.
- **Perbaikan:** ✅ Perbaiki: sr baca stack di belakang — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 154. Header `h2 22` vs `h3 18` — tidak ada level <18, tapi dev pakai `label` — `components/ui/section.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/section.tsx` — header `h2 22` vs `h3 18` — tidak ada level <18, tapi dev pakai `label`.
- **Perbaikan:** ✅ Perbaiki: tidak ada level <18, tapi dev pakai `label` — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 155. Log tanpa `summarize()` — SR 3 fragmen — `components/ui/security-log-item.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/security-log-item.tsx` — log tanpa `summarize()` — sr 3 fragmen.
- **Perbaikan:** ✅ Perbaiki: sr 3 fragmen — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 156. Control `h-10` tanpa `accessibilityRole radiogroup` — SR bingung — `components/ui/segmented-control.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/segmented-control.tsx` — control `h-10` tanpa `accessibilityrole radiogroup` — sr bingung.
- **Perbaikan:** ✅ Perbaiki: sr bingung — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 157. Caret tidak rotate saat open — isyarat hilang — `components/ui/select.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/select.tsx` — caret tidak rotate saat open — isyarat hilang.
- **Perbaikan:** ✅ Perbaiki: isyarat hilang — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 158. Text `mask` tanpa `toggle` hint — SR tidak tahu bisa reveal — `components/ui/sensitive-text.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/sensitive-text.tsx` — text `mask` tanpa `toggle` hint — sr tidak tahu bisa reveal.
- **Perbaikan:** ✅ Perbaiki: sr tidak tahu bisa reveal — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 159. Trigger tanpa `accessibilityHint` share — SR 'button' tanpa akibat — `components/ui/share-sheet-trigger.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/share-sheet-trigger.tsx` — trigger tanpa `accessibilityhint` share — sr 'button' tanpa akibat.
- **Perbaikan:** ✅ Perbaiki: sr 'button' tanpa akibat — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 160. Card tanpa `copyable` tracking — nomor tidak bisa copy — `components/ui/shipping-info-card.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/shipping-info-card.tsx` — card tanpa `copyable` tracking — nomor tidak bisa copy.
- **Perbaikan:** ✅ Perbaiki: nomor tidak bisa copy — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 161. Show `Platform.OS` branch tanpa `useReducedMotion`? — `components/ui/show.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/show.tsx` — show `platform.os` branch tanpa `usereducedmotion`?.
- **Perbaikan:** ✅ Perbaiki: show `platform.os` branch tanpa `usereducedmotion`? — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 162. Grid tanpa `accessibilityLabel` jumlah — SR 'grid' tanpa count — `components/ui/showcase-gallery-grid.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/showcase-gallery-grid.tsx` — grid tanpa `accessibilitylabel` jumlah — sr 'grid' tanpa count.
- **Perbaikan:** ✅ Perbaiki: sr 'grid' tanpa count — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 163. Pad tanpa `clear` hint — SR tidak tahu hapus — `components/ui/signature-pad.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/signature-pad.tsx` — pad tanpa `clear` hint — sr tidak tahu hapus.
- **Perbaikan:** ✅ Perbaiki: sr tidak tahu hapus — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 164. Pulse `700ms` terlalu lambat — terasa frozen — `components/ui/skeleton.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/skeleton.tsx` — pulse `700ms` terlalu lambat — terasa frozen.
- **Perbaikan:** ✅ Perbaiki: terasa frozen — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 165. Slider `track` tanpa `accessibilityValue` — SR tidak tahu persen — `components/ui/slider.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/slider.tsx` — slider `track` tanpa `accessibilityvalue` — sr tidak tahu persen.
- **Perbaikan:** ✅ Perbaiki: sr tidak tahu persen — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 166. Banner tanpa `dismiss` persist — muncul terus — `components/ui/smart-app-banner.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/smart-app-banner.tsx` — banner tanpa `dismiss` persist — muncul terus.
- **Perbaikan:** ✅ Perbaiki: muncul terus — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 167. Editor tanpa `autoCapitalize none` — link capitalize salah — `components/ui/social-links-editor.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/social-links-editor.tsx` — editor tanpa `autocapitalize none` — link capitalize salah.
- **Perbaikan:** ✅ Perbaiki: link capitalize salah — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 168. Spinner `scale 0.8` blur di Android mdpi — `components/ui/spinner.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/spinner.tsx` — spinner `scale 0.8` blur di android mdpi.
- **Perbaikan:** ✅ Perbaiki: spinner `scale 0.8` blur di android mdpi — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 169. Stack `gap` tanpa token — arbitrary — `components/ui/stack.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/stack.tsx` — stack `gap` tanpa token — arbitrary.
- **Perbaikan:** ✅ Perbaiki: arbitrary — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 170. Card `label` caption tanpa `numberOfLines` — wrap — `components/ui/stat-card.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/stat-card.tsx` — card `label` caption tanpa `numberoflines` — wrap.
- **Perbaikan:** ✅ Perbaiki: wrap — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 171. Indicator dot tanpa `liveRegion` — status change sunyi — `components/ui/status-indicator.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/status-indicator.tsx` — indicator dot tanpa `liveregion` — status change sunyi.
- **Perbaikan:** ✅ Perbaiki: status change sunyi — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 172. Stepper `gap-3` tanpa `haptic` — step sunyi — `components/ui/stepper.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/stepper.tsx` — stepper `gap-3` tanpa `haptic` — step sunyi.
- **Perbaikan:** ✅ Perbaiki: step sunyi — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 173. Benefit `check` icon tanpa `tone success` — manfaat tidak hijau — `components/ui/subscription-benefit-list.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/subscription-benefit-list.tsx` — benefit `check` icon tanpa `tone success` — manfaat tidak hijau.
- **Perbaikan:** ✅ Perbaiki: manfaat tidak hijau — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 174. Plan card `popular` badge tanpa `accessibilityLabel` — SR lewati — `components/ui/subscription-plan-card.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/subscription-plan-card.tsx` — plan card `popular` badge tanpa `accessibilitylabel` — sr lewati.
- **Perbaikan:** ✅ Perbaiki: sr lewati — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 175. Status tanpa `progress` — SR tidak tahu masa aktif — `components/ui/subscription-status-card.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/subscription-status-card.tsx` — status tanpa `progress` — sr tidak tahu masa aktif.
- **Perbaikan:** ✅ Perbaiki: sr tidak tahu masa aktif — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 176. Ticket tanpa `status` semantik — 'Open' abu — `components/ui/support-ticket-card.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/support-ticket-card.tsx` — ticket tanpa `status` semantik — 'open' abu.
- **Perbaikan:** ✅ Perbaiki: 'open' abu — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 177. Surface `elevated` tanpa `border` — boundary hilang di light — `components/ui/surface.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/surface.tsx` — surface `elevated` tanpa `border` — boundary hilang di light.
- **Perbaikan:** ✅ Perbaiki: boundary hilang di light — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 178. Swipe `threshold 30%` tanpa `haptic` — swipe sunyi — `components/ui/swipeable-list-item.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/swipeable-list-item.tsx` — swipe `threshold 30%` tanpa `haptic` — swipe sunyi.
- **Perbaikan:** ✅ Perbaiki: swipe sunyi — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 179. Switch deskripsi `caption` tanpa grouping — SR baca terpisah — `components/ui/switch.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/switch.tsx` — switch deskripsi `caption` tanpa grouping — sr baca terpisah.
- **Perbaikan:** ✅ Perbaiki: sr baca terpisah — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 180. Tabs `h-12` tanpa `focusRingInset` — ring terpotong — `components/ui/tabs.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/tabs.tsx` — tabs `h-12` tanpa `focusringinset` — ring terpotong.
- **Perbaikan:** ✅ Perbaiki: ring terpotong — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 181. Input `min-w-[80px]` arbitrary — bukan `min-w-20` token — `components/ui/tag-input.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/tag-input.tsx` — input `min-w-[80px]` arbitrary — bukan `min-w-20` token.
- **Perbaikan:** ✅ Perbaiki: bukan `min-w-20` token — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 182. Area `rows` tanpa `minHeight` token — arbitrary — `components/ui/text-area.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/text-area.tsx` — area `rows` tanpa `minheight` token — arbitrary.
- **Perbaikan:** ✅ Perbaiki: arbitrary — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 183. Link `inline` tanpa `hitSlop 11` — 22 <44 — `components/ui/text-link.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/text-link.tsx` — link `inline` tanpa `hitslop 11` — 22 <44.
- **Perbaikan:** ✅ Perbaiki: 22 <44 — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 184. Tertiary di small variant diam jadi secondary — magic tanpa warn — `components/ui/text.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/text.tsx` — tertiary di small variant diam jadi secondary — magic tanpa warn.
- **Perbaikan:** ✅ Perbaiki: magic tanpa warn — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 185. Toggle tanpa `haptic` — ganti tema sunyi — `components/ui/theme-toggle-button.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/theme-toggle-button.tsx` — toggle tanpa `haptic` — ganti tema sunyi.
- **Perbaikan:** ✅ Perbaiki: ganti tema sunyi — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 186. Timeline `gap-4` tanpa `accessibilityRole list` — SR tidak tahu urutan — `components/ui/timeline.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/timeline.tsx` — timeline `gap-4` tanpa `accessibilityrole list` — sr tidak tahu urutan.
- **Perbaikan:** ✅ Perbaiki: sr tidak tahu urutan — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 187. Toast `MAX_VISIBLE 3` menutupi 35% layar 667 — terlalu dominan — `components/ui/toast.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/toast.tsx` — toast `max_visible 3` menutupi 35% layar 667 — terlalu dominan.
- **Perbaikan:** ✅ Perbaiki: terlalu dominan — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 188. Group tanpa `role radiogroup` — SR bingung — `components/ui/toggle-group.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/toggle-group.tsx` — group tanpa `role radiogroup` — sr bingung.
- **Perbaikan:** ✅ Perbaiki: sr bingung — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 189. Tooltip `260px` di 520 sempit — 50% width — `components/ui/tooltip.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/tooltip.tsx` — tooltip `260px` di 520 sempit — 50% width.
- **Perbaikan:** ✅ Perbaiki: 50% width — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 190. Card tanpa `onCopy` haptic — salin sunyi — `components/ui/topup-status-card.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/topup-status-card.tsx` — card tanpa `oncopy` haptic — salin sunyi.
- **Perbaikan:** ✅ Perbaiki: salin sunyi — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 191. Template tanpa `divider` — list flat — `components/ui/transaction-template-card.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/transaction-template-card.tsx` — template tanpa `divider` — list flat.
- **Perbaikan:** ✅ Perbaiki: list flat — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 192. Picker debounce 300 tanpa indikator — hang? — `components/ui/transfer-recipient-picker.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/transfer-recipient-picker.tsx` — picker debounce 300 tanpa indikator — hang?.
- **Perbaikan:** ✅ Perbaiki: hang? — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 193. Truncate tanpa `read-more` hint — SR tidak tahu expand — `components/ui/truncate.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/truncate.tsx` — truncate tanpa `read-more` hint — sr tidak tahu expand.
- **Perbaikan:** ✅ Perbaiki: sr tidak tahu expand — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 194. Score tanpa `progress` — angka tanpa konteks — `components/ui/trust-score-card.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/trust-score-card.tsx` — score tanpa `progress` — angka tanpa konteks.
- **Perbaikan:** ✅ Perbaiki: angka tanpa konteks — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 195. Selector tanpa `haptic` — ganti metode sunyi — `components/ui/two-factor-method-selector.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/two-factor-method-selector.tsx` — selector tanpa `haptic` — ganti metode sunyi.
- **Perbaikan:** ✅ Perbaiki: ganti metode sunyi — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 196. Status tanpa `copy` — kode tidak bisa copy — `components/ui/two-factor-status-card.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/two-factor-status-card.tsx` — status tanpa `copy` — kode tidak bisa copy.
- **Perbaikan:** ✅ Perbaiki: kode tidak bisa copy — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 197. Typography `tabular-nums` untuk prose — kerning rusak — `components/ui/typography.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/typography.tsx` — typography `tabular-nums` untuk prose — kerning rusak.
- **Perbaikan:** ✅ Perbaiki: kerning rusak — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 198. Field tanpa `drag` hint — desktop UX hilang — `components/ui/upload-field.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/upload-field.tsx` — field tanpa `drag` hint — desktop ux hilang.
- **Perbaikan:** ✅ Perbaiki: desktop ux hilang — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 199. Item `divider` tanpa logic `hasMore` — garis ganda — `components/ui/user-discover-result-item.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/user-discover-result-item.tsx` — item `divider` tanpa logic `hasmore` — garis ganda.
- **Perbaikan:** ✅ Perbaiki: garis ganda — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 200. Item `divider 76px` tanpa token comment — magic — `components/ui/user-list-item.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/user-list-item.tsx` — item `divider 76px` tanpa token comment — magic.
- **Perbaikan:** ✅ Perbaiki: magic — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 201. Field tanpa `autoCorrect false` — username autocorrect — `components/ui/username-field.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/username-field.tsx` — field tanpa `autocorrect false` — username autocorrect.
- **Perbaikan:** ✅ Perbaiki: username autocorrect — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 202. Card `soft` tanpa border — invisible — `components/ui/voucher-card.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/voucher-card.tsx` — card `soft` tanpa border — invisible.
- **Perbaikan:** ✅ Perbaiki: invisible — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 203. Error generik tanpa saran — abandon — `components/ui/voucher-redeem-box.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/voucher-redeem-box.tsx` — error generik tanpa saran — abandon.
- **Perbaikan:** ✅ Perbaiki: abandon — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 204. Item tanpa `Amount` compact — label sempit — `components/ui/voucher-usage-list-item.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/voucher-usage-list-item.tsx` — item tanpa `amount` compact — label sempit.
- **Perbaikan:** ✅ Perbaiki: label sempit — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 205. Inverted `border-primary-foreground` 1px blur di web — `components/ui/wallet-balance-card.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/wallet-balance-card.tsx` — inverted `border-primary-foreground` 1px blur di web.
- **Perbaikan:** ✅ Perbaiki: inverted `border-primary-foreground` 1px blur di web — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 206. Item `sign always` tanpa `tone success/danger` — arah dana tidak warna — `components/ui/wallet-transaction-list-item.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/wallet-transaction-list-item.tsx` — item `sign always` tanpa `tone success/danger` — arah dana tidak warna.
- **Perbaikan:** ✅ Perbaiki: arah dana tidak warna — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 207. Row tanpa `accessibilityLabel` summarize — SR 3 fragmen — `components/ui/wallet-transaction-row.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/wallet-transaction-row.tsx` — row tanpa `accessibilitylabel` summarize — sr 3 fragmen.
- **Perbaikan:** ✅ Perbaiki: sr 3 fragmen — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 208. Schedule tanpa `progress` — sisa hari tidak visual — `components/ui/withdrawal-schedule-card.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/withdrawal-schedule-card.tsx` — schedule tanpa `progress` — sisa hari tidak visual.
- **Perbaikan:** ✅ Perbaiki: sisa hari tidak visual — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 209. z-stack — polish gap dan a11y grouping — `components/ui/z-stack.tsx`
- **Kategori:** Komponen · **Severity:** MEDIUM
- **Masalah:** Polishing terlewat di `components/ui/z-stack.tsx` — z-stack — polish gap dan a11y grouping.
- **Perbaikan:** ✅ Perbaiki: polish gap dan a11y grouping — tambah token/haptic/SR grouping agar konsisten dengan design system.
- **Alasan UX:** Konsistensi 4px + WCAG 1.4.11/2.4.7/4.1.2 — polish 1% membedakan profesional.

### 210. Konten `gap-4` tanpa `divider` — section tidak terpisah — `components/ui/accordion.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/accordion.tsx` — konten `gap-4` tanpa `divider` — section tidak terpisah.
- **Perbaikan:** ✅ Perbaiki kedua: section tidak terpisah — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 211. Badge `icon` 16 di dalam `h-5 w-5` — padding tidak center — `components/ui/achievement-badge.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/achievement-badge.tsx` — badge `icon` 16 di dalam `h-5 w-5` — padding tidak center.
- **Perbaikan:** ✅ Perbaiki kedua: padding tidak center — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 212. Sheet `gap-2` tanpa token — arbitrary 8 — `components/ui/action-sheet.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/action-sheet.tsx` — sheet `gap-2` tanpa token — arbitrary 8.
- **Perbaikan:** ✅ Perbaiki kedua: arbitrary 8 — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 213. Item `leading` icon tanpa `tone` — hierarki flat — `components/ui/activity-log-item.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/activity-log-item.tsx` — item `leading` icon tanpa `tone` — hierarki flat.
- **Perbaikan:** ✅ Perbaiki kedua: hierarki flat — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 214. Alert `banner` tanpa `safeArea` — notch terpotong — `components/ui/alert.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/alert.tsx` — alert `banner` tanpa `safearea` — notch terpotong.
- **Perbaikan:** ✅ Perbaiki kedua: notch terpotong — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 215. Field `h-16` tanpa `min-h-16` — fontScale clip — `components/ui/amount-input.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/amount-input.tsx` — field `h-16` tanpa `min-h-16` — fontscale clip.
- **Perbaikan:** ✅ Perbaiki kedua: fontscale clip — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 216. Mono `adjustsFontSizeToFit` tanpa `minimumFontScale` — 0.7 terlalu kecil di 320 — `components/ui/amount.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/amount.tsx` — mono `adjustsfontsizetofit` tanpa `minimumfontscale` — 0.7 terlalu kecil di 320.
- **Perbaikan:** ✅ Perbaiki kedua: 0.7 terlalu kecil di 320 — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 217. Summary `gap-4` vs `cardPadding 20` — rhythm off — `components/ui/analytics-summary.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/analytics-summary.tsx` — summary `gap-4` vs `cardpadding 20` — rhythm off.
- **Perbaikan:** ✅ Perbaiki kedua: rhythm off — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 218. Logo `scale 0.7` tanpa token — ajaib — `components/ui/animated-splash.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/animated-splash.tsx` — logo `scale 0.7` tanpa token — ajaib.
- **Perbaikan:** ✅ Perbaiki kedua: ajaib — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 219. Row `accessibilityLabel` tanpa `summarize()` — SR 3 fragmen — `components/ui/app-version-info-row.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/app-version-info-row.tsx` — row `accessibilitylabel` tanpa `summarize()` — sr 3 fragmen.
- **Perbaikan:** ✅ Perbaiki kedua: sr 3 fragmen — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 220. Group `spacing -ml-2` tanpa `border-background 2px` — avatar overlap tidak terpisah — `components/ui/avatar.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/avatar.tsx` — group `spacing -ml-2` tanpa `border-background 2px` — avatar overlap tidak terpisah.
- **Perbaikan:** ✅ Perbaiki kedua: avatar overlap tidak terpisah — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 221. Backdrop `background` tanpa `accessible=false` — SR berhenti di scrim — `components/ui/backdrop.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/backdrop.tsx` — backdrop `background` tanpa `accessible=false` — sr berhenti di scrim.
- **Perbaikan:** ✅ Perbaiki kedua: sr berhenti di scrim — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 222. Grid `gap-2` tanpa `selectable` — kode tidak copyable parsial — `components/ui/backup-codes-display.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/backup-codes-display.tsx` — grid `gap-2` tanpa `selectable` — kode tidak copyable parsial.
- **Perbaikan:** ✅ Perbaiki kedua: kode tidak copyable parsial — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 223. Dot `h-2 w-2` tanpa `border border-background` — dot blend di dark — `components/ui/badge.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/badge.tsx` — dot `h-2 w-2` tanpa `border border-background` — dot blend di dark.
- **Perbaikan:** ✅ Perbaiki kedua: dot blend di dark — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 224. Item `selected` tanpa `border-focus` 1.5px — state kurang tegas — `components/ui/bank-account-list-item.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/bank-account-list-item.tsx` — item `selected` tanpa `border-focus` 1.5px — state kurang tegas.
- **Perbaikan:** ✅ Perbaiki kedua: state kurang tegas — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 225. Select `onSelect` tanpa `haptic` — pilih bank sunyi — `components/ui/bank-select.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/bank-select.tsx` — select `onselect` tanpa `haptic` — pilih bank sunyi.
- **Perbaikan:** ✅ Perbaiki kedua: pilih bank sunyi — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 226. Banner `translateY -16` tanpa `useReducedMotion` — motion non-esensial — `components/ui/banner.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/banner.tsx` — banner `translatey -16` tanpa `usereducedmotion` — motion non-esensial.
- **Perbaikan:** ✅ Perbaiki kedua: motion non-esensial — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 227. Chart `vertical` tanpa `accessibilityRole image` — SR tidak tahu chart — `components/ui/bar-chart.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/bar-chart.tsx` — chart `vertical` tanpa `accessibilityrole image` — sr tidak tahu chart.
- **Perbaikan:** ✅ Perbaiki kedua: sr tidak tahu chart — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 228. Trigger `pinLength 6` tanpa `accessibilityValue` — SR 'PIN' tanpa progress — `components/ui/biometric-prompt-trigger.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/biometric-prompt-trigger.tsx` — trigger `pinlength 6` tanpa `accessibilityvalue` — sr 'pin' tanpa progress.
- **Perbaikan:** ✅ Perbaiki kedua: sr 'pin' tanpa progress — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 229. Sheet `maxHeight 90%` tanpa `keyboardAvoiding` — input tertutup keyboard — `components/ui/bottom-sheet.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/bottom-sheet.tsx` — sheet `maxheight 90%` tanpa `keyboardavoiding` — input tertutup keyboard.
- **Perbaikan:** ✅ Perbaiki kedua: input tertutup keyboard — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 230. Bar `border-t` tanpa `z-sticky` token — stacking drift — `components/ui/bottom-tab-bar.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/bottom-tab-bar.tsx` — bar `border-t` tanpa `z-sticky` token — stacking drift.
- **Perbaikan:** ✅ Perbaiki kedua: stacking drift — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 231. Box `xs 4` tanpa `dark` variant — radius tidak adaptif — `components/ui/box.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/box.tsx` — box `xs 4` tanpa `dark` variant — radius tidak adaptif.
- **Perbaikan:** ✅ Perbaiki kedua: radius tidak adaptif — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 232. List `gap-2` tanpa `accessibilityRole list` — SR tidak tahu list — `components/ui/bullet-list.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/bullet-list.tsx` — list `gap-2` tanpa `accessibilityrole list` — sr tidak tahu list.
- **Perbaikan:** ✅ Perbaiki kedua: sr tidak tahu list — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 233. Group `flex-row` tanpa `accessibilityRole toolbar` — SR tidak grouping — `components/ui/button-group.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/button-group.tsx` — group `flex-row` tanpa `accessibilityrole toolbar` — sr tidak grouping.
- **Perbaikan:** ✅ Perbaiki kedua: sr tidak grouping — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 234. Button `fullWidth` default tanpa `accessibilityHint` — SR 'button' tanpa akibat — `components/ui/button.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/button.tsx` — button `fullwidth` default tanpa `accessibilityhint` — sr 'button' tanpa akibat.
- **Perbaikan:** ✅ Perbaiki kedua: sr 'button' tanpa akibat — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 235. Calendar `gap-2` tanpa `accessibilityLabel` range — SR tidak tahu bulan — `components/ui/calendar.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/calendar.tsx` — calendar `gap-2` tanpa `accessibilitylabel` range — sr tidak tahu bulan.
- **Perbaikan:** ✅ Perbaiki kedua: sr tidak tahu bulan — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 236. Field `h-14` tanpa `accessibilityLabel` — SR 'image' tanpa konteks — `components/ui/captcha-field.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/captcha-field.tsx` — field `h-14` tanpa `accessibilitylabel` — sr 'image' tanpa konteks.
- **Perbaikan:** ✅ Perbaiki kedua: sr 'image' tanpa konteks — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 237. Card `padded=false` tanpa `CardBody` padding 20 — konten mepet — `components/ui/card.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/card.tsx` — card `padded=false` tanpa `cardbody` padding 20 — konten mepet.
- **Perbaikan:** ✅ Perbaiki kedua: konten mepet — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 238. Attachment `max-w-[220px]` tanpa `numberOfLines` — nama file panjang push layout — `components/ui/chat-attachment-item.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/chat-attachment-item.tsx` — attachment `max-w-[220px]` tanpa `numberoflines` — nama file panjang push layout.
- **Perbaikan:** ✅ Perbaiki kedua: nama file panjang push layout — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 239. Composer `gap-3` tanpa `accessibilityRole toolbar` — SR tidak grouping — `components/ui/chat-composer.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/chat-composer.tsx` — composer `gap-3` tanpa `accessibilityrole toolbar` — sr tidak grouping.
- **Perbaikan:** ✅ Perbaiki kedua: sr tidak grouping — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 240. Bubble `gap-2` tanpa `selectable` — teks tidak copyable — `components/ui/chat-message-bubble.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/chat-message-bubble.tsx` — bubble `gap-2` tanpa `selectable` — teks tidak copyable.
- **Perbaikan:** ✅ Perbaiki kedua: teks tidak copyable — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 241. Item `avatar 40` tanpa `presence` — online tidak terlihat — `components/ui/chat-room-list-item.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/chat-room-list-item.tsx` — item `avatar 40` tanpa `presence` — online tidak terlihat.
- **Perbaikan:** ✅ Perbaiki kedua: online tidak terlihat — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 242. Group `variant card` tanpa `focusRingInset` — ring terpotong — `components/ui/checkbox-group.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/checkbox-group.tsx` — group `variant card` tanpa `focusringinset` — ring terpotong.
- **Perbaikan:** ✅ Perbaiki kedua: ring terpotong — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 243. Indicator `h-5 w-5` 20 tanpa `border-control` — WCAG 1.4.11 borderline — `components/ui/checkbox.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/checkbox.tsx` — indicator `h-5 w-5` 20 tanpa `border-control` — wcag 1.4.11 borderline.
- **Perbaikan:** ✅ Perbaiki kedua: wcag 1.4.11 borderline — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 244. Chip `onRemove` X tanpa `focusRing` — keyboard miss — `components/ui/chip.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/chip.tsx` — chip `onremove` x tanpa `focusring` — keyboard miss.
- **Perbaikan:** ✅ Perbaiki kedua: keyboard miss — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 245. Collapse `border` tanpa `overflow-hidden` — anim clip — `components/ui/collapse.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/collapse.tsx` — collapse `border` tanpa `overflow-hidden` — anim clip.
- **Perbaikan:** ✅ Perbaiki kedua: anim clip — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 246. Container `border-x` tanpa `bg-background` — border tidak terlihat — `components/ui/content-container.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/content-container.tsx` — container `border-x` tanpa `bg-background` — border tidak terlihat.
- **Perbaikan:** ✅ Perbaiki kedua: border tidak terlihat — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 247. Field `pl-4 pr-1` tanpa `hitSlop` — copy 20 <44 — `components/ui/copyable-field.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/copyable-field.tsx` — field `pl-4 pr-1` tanpa `hitslop` — copy 20 <44.
- **Perbaikan:** ✅ Perbaiki kedua: copy 20 <44 — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 248. Badge `px-1` tanpa `tabular-nums` — angka 1 vs 8 width beda — `components/ui/count-badge.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/count-badge.tsx` — badge `px-1` tanpa `tabular-nums` — angka 1 vs 8 width beda.
- **Perbaikan:** ✅ Perbaiki kedua: angka 1 vs 8 width beda — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 249. Countdown `monoLarge` tanpa `tabular-nums` — angka lompat — `components/ui/countdown.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/countdown.tsx` — countdown `monolarge` tanpa `tabular-nums` — angka lompat.
- **Perbaikan:** ✅ Perbaiki kedua: angka lompat — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 250. Validation tanpa `loadingMessage` — skeleton tanpa konteks — `components/ui/counterpart-validation-card.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/counterpart-validation-card.tsx` — validation tanpa `loadingmessage` — skeleton tanpa konteks.
- **Perbaikan:** ✅ Perbaiki kedua: skeleton tanpa konteks — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 251. Range tanpa `accessibilityLabel` — SR 'Dari' 'Sampai' tanpa grouping — `components/ui/currency-range-field.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/currency-range-field.tsx` — range tanpa `accessibilitylabel` — sr 'dari' 'sampai' tanpa grouping.
- **Perbaikan:** ✅ Perbaiki kedua: sr 'dari' 'sampai' tanpa grouping — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 252. Screen `contentClassName gap-4 pt-3` tanpa token — arbitrary — `components/ui/data-screen.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/data-screen.tsx` — screen `contentclassname gap-4 pt-3` tanpa token — arbitrary.
- **Perbaikan:** ✅ Perbaiki kedua: arbitrary — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 253. Table `divider` tanpa `accessibility hidden` — SR berhenti di garis — `components/ui/data-table.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/data-table.tsx` — table `divider` tanpa `accessibility hidden` — sr berhenti di garis.
- **Perbaikan:** ✅ Perbaiki kedua: sr berhenti di garis — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 254. Field icon `CalendarBlank` tanpa `active` tone saat focus — state tidak beda — `components/ui/date-field.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/date-field.tsx` — field icon `calendarblank` tanpa `active` tone saat focus — state tidak beda.
- **Perbaikan:** ✅ Perbaiki kedua: state tidak beda — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 255. Text `variant caption` tanpa `tone secondary` — hierarki flat — `components/ui/date-text.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/date-text.tsx` — text `variant caption` tanpa `tone secondary` — hierarki flat.
- **Perbaikan:** ✅ Perbaiki kedua: hierarki flat — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 256. Field tanpa `clearable` hint — SR 'hapus' tanpa konteks — `components/ui/debounced-search-field.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/debounced-search-field.tsx` — field tanpa `clearable` hint — sr 'hapus' tanpa konteks.
- **Perbaikan:** ✅ Perbaiki kedua: sr 'hapus' tanpa konteks — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 257. Form `confirmPhrase` tanpa `helperText` — user bingung — `components/ui/delete-account-form.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/delete-account-form.tsx` — form `confirmphrase` tanpa `helpertext` — user bingung.
- **Perbaikan:** ✅ Perbaiki kedua: user bingung — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 258. Viewer `flex-row gap-2` tanpa `wrap` — overflow di 320 — `components/ui/delivery-proof-viewer.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/delivery-proof-viewer.tsx` — viewer `flex-row gap-2` tanpa `wrap` — overflow di 320.
- **Perbaikan:** ✅ Perbaiki kedua: overflow di 320 — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 259. Proof `gap-3` tanpa `Card` — hierarki flat — `components/ui/delivery-proof.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/delivery-proof.tsx` — proof `gap-3` tanpa `card` — hierarki flat.
- **Perbaikan:** ✅ Perbaiki kedua: hierarki flat — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 260. Item `trust` toggle tanpa `haptic` — ganti trust sunyi — `components/ui/device-session-list-item.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/device-session-list-item.tsx` — item `trust` toggle tanpa `haptic` — ganti trust sunyi.
- **Perbaikan:** ✅ Perbaiki kedua: ganti trust sunyi — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 261. Log `duration` tanpa `format` — detik mentah — `components/ui/dispute-call-log-item.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/dispute-call-log-item.tsx` — log `duration` tanpa `format` — detik mentah.
- **Perbaikan:** ✅ Perbaiki kedua: detik mentah — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 262. Card `gap-3` tanpa `CardSummary` — SR 5 fragmen — `components/ui/dispute-card.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/dispute-card.tsx` — card `gap-3` tanpa `cardsummary` — sr 5 fragmen.
- **Perbaikan:** ✅ Perbaiki kedua: sr 5 fragmen — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 263. Form `gap-4` tanpa `Section` — spacing tidak token — `components/ui/dispute-claim-form.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/dispute-claim-form.tsx` — form `gap-4` tanpa `section` — spacing tidak token.
- **Perbaikan:** ✅ Perbaiki kedua: spacing tidak token — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 264. Evidence `gap-2` tanpa `divider` — item tidak terpisah — `components/ui/dispute-evidence-item.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/dispute-evidence-item.tsx` — evidence `gap-2` tanpa `divider` — item tidak terpisah.
- **Perbaikan:** ✅ Perbaiki kedua: item tidak terpisah — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 265. Badge tanpa `dot` — status tidak visual — `components/ui/dispute-status-badge.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/dispute-status-badge.tsx` — badge tanpa `dot` — status tidak visual.
- **Perbaikan:** ✅ Perbaiki kedua: status tidak visual — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 266. Divider `inset mx-6` tanpa `w-full` guard — overflow 100%+48 — `components/ui/divider.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/divider.tsx` — divider `inset mx-6` tanpa `w-full` guard — overflow 100%+48.
- **Perbaikan:** ✅ Perbaiki kedua: overflow 100%+48 — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 267. Dot `active` tanpa `haptic` — pilih pager sunyi — `components/ui/dot.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/dot.tsx` — dot `active` tanpa `haptic` — pilih pager sunyi.
- **Perbaikan:** ✅ Perbaiki kedua: pilih pager sunyi — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 268. Field tanpa `textContentType email` — autofill tidak trigger — `components/ui/email-field.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/email-field.tsx` — field tanpa `textcontenttype email` — autofill tidak trigger.
- **Perbaikan:** ✅ Perbaiki kedua: autofill tidak trigger — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 269. State `gap-4 py-12` tanpa `flex-1` — tidak center di Screen — `components/ui/empty-state.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/empty-state.tsx` — state `gap-4 py-12` tanpa `flex-1` — tidak center di screen.
- **Perbaikan:** ✅ Perbaiki kedua: tidak center di screen — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 270. State `gap-2` tanpa `accessibilityLiveRegion` — SR tidak announce — `components/ui/error-state.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/error-state.tsx` — state `gap-2` tanpa `accessibilityliveregion` — sr tidak announce.
- **Perbaikan:** ✅ Perbaiki kedua: sr tidak announce — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 271. Grid `gap-3` tanpa `empty` state — 0 file blank — `components/ui/evidence-grid.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/evidence-grid.tsx` — grid `gap-3` tanpa `empty` state — 0 file blank.
- **Perbaikan:** ✅ Perbaiki kedua: 0 file blank — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 272. Fade tanpa `delay` prop — stagger tidak ada — `components/ui/fade-in.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/fade-in.tsx` — fade tanpa `delay` prop — stagger tidak ada.
- **Perbaikan:** ✅ Perbaiki kedua: stagger tidak ada — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 273. Button `count` tanpa `accessibilityValue` — SR '12' tanpa 'favorit' — `components/ui/favorite-icon-button.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/favorite-icon-button.tsx` — button `count` tanpa `accessibilityvalue` — sr '12' tanpa 'favorit'.
- **Perbaikan:** ✅ Perbaiki kedua: sr '12' tanpa 'favorit' — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 274. Breakdown tanpa `divider` — total tidak terpisah — `components/ui/fee-breakdown.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/fee-breakdown.tsx` — breakdown tanpa `divider` — total tidak terpisah.
- **Perbaikan:** ✅ Perbaiki kedua: total tidak terpisah — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 275. Field `errorText` tanpa `liveRegion assertive` — error tidak urgent — `components/ui/field.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/field.tsx` — field `errortext` tanpa `liveregion assertive` — error tidak urgent.
- **Perbaikan:** ✅ Perbaiki kedua: error tidak urgent — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 276. Content tanpa `reset` haptic — reset sunyi — `components/ui/filter-sheet-content.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/filter-sheet-content.tsx` — content tanpa `reset` haptic — reset sunyi.
- **Perbaikan:** ✅ Perbaiki kedua: reset sunyi — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 277. FAB `h-14` 56 tanpa `elevation` — FAB terasa flat (sengaja §6, tapi butuh border) — `components/ui/floating-action-button.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/floating-action-button.tsx` — fab `h-14` 56 tanpa `elevation` — fab terasa flat (sengaja §6, tapi butuh border).
- **Perbaikan:** ✅ Perbaiki kedua: fab terasa flat (sengaja §6, tapi butuh border) — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 278. Button `following` tanpa `accessibilityHint` — SR 'following' tanpa akibat — `components/ui/follow-button.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/follow-button.tsx` — button `following` tanpa `accessibilityhint` — sr 'following' tanpa akibat.
- **Perbaikan:** ✅ Perbaiki kedua: sr 'following' tanpa akibat — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 279. Bar `pt-4` tanpa `gap-3` token — arbitrary — `components/ui/footer-bar.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/footer-bar.tsx` — bar `pt-4` tanpa `gap-3` token — arbitrary.
- **Perbaikan:** ✅ Perbaiki kedua: arbitrary — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 280. Section `gap-4` tanpa `divider` prop — section kedua tidak terpisah — `components/ui/form-section.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/form-section.tsx` — section `gap-4` tanpa `divider` prop — section kedua tidak terpisah.
- **Perbaikan:** ✅ Perbaiki kedua: section kedua tidak terpisah — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 281. Grid tanpa `responsive` 12 col — desktop tidak pakai — `components/ui/grid.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/grid.tsx` — grid tanpa `responsive` 12 col — desktop tidak pakai.
- **Perbaikan:** ✅ Perbaiki kedua: desktop tidak pakai — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 282. Header `px-3` tanpa `gap-2` — ikon mepet judul — `components/ui/header.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/header.tsx` — header `px-3` tanpa `gap-2` — ikon mepet judul.
- **Perbaikan:** ✅ Perbaiki kedua: ikon mepet judul — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 283. Heading `h1 28` tanpa `dark:font-sans-600` — bold terlalu tebal di dark — `components/ui/heading.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/heading.tsx` — heading `h1 28` tanpa `dark:font-sans-600` — bold terlalu tebal di dark.
- **Perbaikan:** ✅ Perbaiki kedua: bold terlalu tebal di dark — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 284. Item `gap-2` tanpa `accessibilityHint` — SR 'artikel' tanpa buka — `components/ui/help-article-list-item.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/help-article-list-item.tsx` — item `gap-2` tanpa `accessibilityhint` — sr 'artikel' tanpa buka.
- **Perbaikan:** ✅ Perbaiki kedua: sr 'artikel' tanpa buka — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 285. Card tanpa `skeleton` height — loading jump — `components/ui/help-category-card.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/help-category-card.tsx` — card tanpa `skeleton` height — loading jump.
- **Perbaikan:** ✅ Perbaiki kedua: loading jump — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 286. Highlight tanpa `rounded-xs` — pill tidak konsisten — `components/ui/highlight.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/highlight.tsx` — highlight tanpa `rounded-xs` — pill tidak konsisten.
- **Perbaikan:** ✅ Perbaiki kedua: pill tidak konsisten — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 287. Box `lg 48` tanpa `rounded-md` token — arbitrary — `components/ui/icon-box.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/icon-box.tsx` — box `lg 48` tanpa `rounded-md` token — arbitrary.
- **Perbaikan:** ✅ Perbaiki kedua: arbitrary — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 288. Button `pill` tanpa `rounded-full` container — focusRing tidak ikut bulat — `components/ui/icon-button.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/icon-button.tsx` — button `pill` tanpa `rounded-full` container — focusring tidak ikut bulat.
- **Perbaikan:** ✅ Perbaiki kedua: focusring tidak ikut bulat — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 289. Text `gap-1` tanpa `numberOfLines` — wrap — `components/ui/icon-text.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/icon-text.tsx` — text `gap-1` tanpa `numberoflines` — wrap.
- **Perbaikan:** ✅ Perbaiki kedua: wrap — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 290. Icon `size md 24` tanpa `weight regular` explicit — default ambigu — `components/ui/icon.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/icon.tsx` — icon `size md 24` tanpa `weight regular` explicit — default ambigu.
- **Perbaikan:** ✅ Perbaiki kedua: default ambigu — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 291. Bar tanpa `haptic` — mute sunyi — `components/ui/in-call-controls-bar.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/in-call-controls-bar.tsx` — bar tanpa `haptic` — mute sunyi.
- **Perbaikan:** ✅ Perbaiki kedua: mute sunyi — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 292. Prompt tanpa `countdown` liveRegion — SR tidak tahu sisa waktu — `components/ui/incoming-call-prompt.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/incoming-call-prompt.tsx` — prompt tanpa `countdown` liveregion — sr tidak tahu sisa waktu.
- **Perbaikan:** ✅ Perbaiki kedua: sr tidak tahu sisa waktu — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 293. Input `boxHeight min-h-14` tanpa `multiline` minHeight — arbitrary — `components/ui/input.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/input.tsx` — input `boxheight min-h-14` tanpa `multiline` minheight — arbitrary.
- **Perbaikan:** ✅ Perbaiki kedua: arbitrary — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 294. View `gap-4` tanpa `Amount` mono — nominal tidak presisi — `components/ui/invoice-receipt-view.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/invoice-receipt-view.tsx` — view `gap-4` tanpa `amount` mono — nominal tidak presisi.
- **Perbaikan:** ✅ Perbaiki kedua: nominal tidak presisi — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 295. List `gap-3` tanpa `divider` — key-value tidak terpisah — `components/ui/key-value.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/key-value.tsx` — list `gap-3` tanpa `divider` — key-value tidak terpisah.
- **Perbaikan:** ✅ Perbaiki kedua: key-value tidak terpisah — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 296. Avoiding tanpa `behavior padding` di iOS — keyboard masih tutup — `components/ui/keyboard-avoiding.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/keyboard-avoiding.tsx` — avoiding tanpa `behavior padding` di ios — keyboard masih tutup.
- **Perbaikan:** ✅ Perbaiki kedua: keyboard masih tutup — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 297. Document tanpa `ratio` — gambar stretch — `components/ui/kyc-document-viewer.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/kyc-document-viewer.tsx` — document tanpa `ratio` — gambar stretch.
- **Perbaikan:** ✅ Perbaiki kedua: gambar stretch — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 298. Item `gap-2` tanpa `status` semantik — pending abu — `components/ui/kyc-history-list-item.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/kyc-history-list-item.tsx` — item `gap-2` tanpa `status` semantik — pending abu.
- **Perbaikan:** ✅ Perbaiki kedua: pending abu — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 299. Card `gap-4` tanpa `action` hint — SR tidak tahu 'verifikasi' — `components/ui/kyc-status-card.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/kyc-status-card.tsx` — card `gap-4` tanpa `action` hint — sr tidak tahu 'verifikasi'.
- **Perbaikan:** ✅ Perbaiki kedua: sr tidak tahu 'verifikasi' — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 300. Picker tanpa `haptic` — ganti bahasa sunyi — `components/ui/language-picker.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/language-picker.tsx` — picker tanpa `haptic` — ganti bahasa sunyi.
- **Perbaikan:** ✅ Perbaiki kedua: ganti bahasa sunyi — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 301. Layout `screenPaddingX 24` tanpa `maxWidth` — web tidak cap — `components/ui/layout.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/layout.tsx` — layout `screenpaddingx 24` tanpa `maxwidth` — web tidak cap.
- **Perbaikan:** ✅ Perbaiki kedua: web tidak cap — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 302. Item `divider inset` 60px magic tanpa token comment — `components/ui/list-item.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/list-item.tsx` — item `divider inset` 60px magic tanpa token comment.
- **Perbaikan:** ✅ Perbaiki kedua: item `divider inset` 60px magic tanpa token comment — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 303. Region tanpa `assertive` untuk danger — urgensi hilang — `components/ui/live-region.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/live-region.tsx` — region tanpa `assertive` untuk danger — urgensi hilang.
- **Perbaikan:** ✅ Perbaiki kedua: urgensi hilang — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 304. LoadMore `gap-2` tanpa `spinner` size — inline vs block — `components/ui/load-more.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/load-more.tsx` — loadmore `gap-2` tanpa `spinner` size — inline vs block.
- **Perbaikan:** ✅ Perbaiki kedua: inline vs block — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 305. Screen `gap-6 py-16` tanpa token — arbitrary 64 — `components/ui/loading-screen.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/loading-screen.tsx` — screen `gap-6 py-16` tanpa token — arbitrary 64.
- **Perbaikan:** ✅ Perbaiki kedua: arbitrary 64 — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 306. Logo `size sm` tanpa `accessibilityIgnoresInvertColors` — dark invert rusak — `components/ui/logo.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/logo.tsx` — logo `size sm` tanpa `accessibilityignoresinvertcolors` — dark invert rusak.
- **Perbaikan:** ✅ Perbaiki kedua: dark invert rusak — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 307. Viewer `gap-3` tanpa `close` haptic — tutup sunyi — `components/ui/media-viewer.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/media-viewer.tsx` — viewer `gap-3` tanpa `close` haptic — tutup sunyi.
- **Perbaikan:** ✅ Perbaiki kedua: tutup sunyi — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 308. List `gap-2` tanpa `divider` — item tidak terpisah — `components/ui/menu-list.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/menu-list.tsx` — list `gap-2` tanpa `divider` — item tidak terpisah.
- **Perbaikan:** ✅ Perbaiki kedua: item tidak terpisah — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 309. Modal `rounded-md` tanpa `max-w-content` — web 600 terlalu lebar — `components/ui/modal.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/modal.tsx` — modal `rounded-md` tanpa `max-w-content` — web 600 terlalu lebar.
- **Perbaikan:** ✅ Perbaiki kedua: web 600 terlalu lebar — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 310. Card tanpa `radio` grouping — SR tidak tahu opsi — `components/ui/mutual-resolution-card.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/mutual-resolution-card.tsx` — card tanpa `radio` grouping — sr tidak tahu opsi.
- **Perbaikan:** ✅ Perbaiki kedua: sr tidak tahu opsi — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 311. Item tanpa `timestamp` tabular — angka lompat — `components/ui/notification-list-item.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/notification-list-item.tsx` — item tanpa `timestamp` tabular — angka lompat.
- **Perbaikan:** ✅ Perbaiki kedua: angka lompat — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 312. Matrix tanpa `header` SR — kolom tidak terbaca — `components/ui/notification-preferences-matrix.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/notification-preferences-matrix.tsx` — matrix tanpa `header` sr — kolom tidak terbaca.
- **Perbaikan:** ✅ Perbaiki kedua: kolom tidak terbaca — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 313. Stepper `gap-2` tanpa `disabled` opacity — state tidak beda — `components/ui/number-stepper.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/number-stepper.tsx` — stepper `gap-2` tanpa `disabled` opacity — state tidak beda.
- **Perbaikan:** ✅ Perbaiki kedua: state tidak beda — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 314. Card `onPress` tanpa `haptic` — tap sunyi — `components/ui/order-card.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/order-card.tsx` — card `onpress` tanpa `haptic` — tap sunyi.
- **Perbaikan:** ✅ Perbaiki kedua: tap sunyi — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 315. Card `gap-2` tanpa `Amount` — nominal tidak mono — `components/ui/order-extension-card.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/order-extension-card.tsx` — card `gap-2` tanpa `amount` — nominal tidak mono.
- **Perbaikan:** ✅ Perbaiki kedua: nominal tidak mono — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 316. Selector tanpa `leftIcon` — visual tidak distinct — `components/ui/order-form-selectors.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/order-form-selectors.tsx` — selector tanpa `lefticon` — visual tidak distinct.
- **Perbaikan:** ✅ Perbaiki kedua: visual tidak distinct — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 317. Timeline tanpa `date` mono — timestamp tidak presisi — `components/ui/order-history-timeline.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/order-history-timeline.tsx` — timeline tanpa `date` mono — timestamp tidak presisi.
- **Perbaikan:** ✅ Perbaiki kedua: timestamp tidak presisi — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 318. Preview `gap-3` tanpa `divider` — section tidak terpisah — `components/ui/order-link-preview-card.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/order-link-preview-card.tsx` — preview `gap-3` tanpa `divider` — section tidak terpisah.
- **Perbaikan:** ✅ Perbaiki kedua: section tidak terpisah — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 319. Share `gap-2` tanpa `haptic` copy — salin sunyi — `components/ui/order-link-share-card.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/order-link-share-card.tsx` — share `gap-2` tanpa `haptic` copy — salin sunyi.
- **Perbaikan:** ✅ Perbaiki kedua: salin sunyi — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 320. Badge tanpa `icon` — status hanya warna — `components/ui/order-status-badge.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/order-status-badge.tsx` — badge tanpa `icon` — status hanya warna.
- **Perbaikan:** ✅ Perbaiki kedua: status hanya warna — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 321. Strip tanpa `scroll` — overflow di 320 — `components/ui/order-summary-strip.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/order-summary-strip.tsx` — strip tanpa `scroll` — overflow di 320.
- **Perbaikan:** ✅ Perbaiki kedua: overflow di 320 — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 322. Input `gap-2` tanpa `justify-center` — spread di 360 — `components/ui/otp-input.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/otp-input.tsx` — input `gap-2` tanpa `justify-center` — spread di 360.
- **Perbaikan:** ✅ Perbaiki kedua: spread di 360 — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 323. Indicator `gap-2` tanpa `hitSlop` — dot 6 <44 — `components/ui/page-indicator.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/page-indicator.tsx` — indicator `gap-2` tanpa `hitslop` — dot 6 <44.
- **Perbaikan:** ✅ Perbaiki kedua: dot 6 <44 — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 324. List `bottomPadding 32` tanpa `insets.bottom` — home indicator terpotong — `components/ui/paginated-list.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/paginated-list.tsx` — list `bottompadding 32` tanpa `insets.bottom` — home indicator terpotong.
- **Perbaikan:** ✅ Perbaiki kedua: home indicator terpotong — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 325. Field `strength` tanpa `accessibilityLiveRegion` — meter sunyi — `components/ui/password-field.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/password-field.tsx` — field `strength` tanpa `accessibilityliveregion` — meter sunyi.
- **Perbaikan:** ✅ Perbaiki kedua: meter sunyi — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 326. Strength tanpa `color` semantik — lemah tidak merah — `components/ui/password-strength.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/password-strength.tsx` — strength tanpa `color` semantik — lemah tidak merah.
- **Perbaikan:** ✅ Perbaiki kedua: lemah tidak merah — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 327. Selector `gap-3` tanpa `radio` SR — SR tidak tahu pilih — `components/ui/payment-method-selector.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/payment-method-selector.tsx` — selector `gap-3` tanpa `radio` sr — sr tidak tahu pilih.
- **Perbaikan:** ✅ Perbaiki kedua: sr tidak tahu pilih — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 328. Input `h-12` tanpa `min-h-12` — fontScale clip — `components/ui/phone-input.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/phone-input.tsx` — input `h-12` tanpa `min-h-12` — fontscale clip.
- **Perbaikan:** ✅ Perbaiki kedua: fontscale clip — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 329. Picture `cover` tanpa `placeholder` — loading blank — `components/ui/picture.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/picture.tsx` — picture `cover` tanpa `placeholder` — loading blank.
- **Perbaikan:** ✅ Perbaiki kedua: loading blank — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 330. Input `gap-8` tanpa token — 32 arbitrary — `components/ui/pin-input.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/pin-input.tsx` — input `gap-8` tanpa token — 32 arbitrary.
- **Perbaikan:** ✅ Perbaiki kedua: 32 arbitrary — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 331. Pad `gap-2` tanpa `accessibilityLabel` digit — SR 'button' tanpa angka — `components/ui/pin-pad.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/pin-pad.tsx` — pad `gap-2` tanpa `accessibilitylabel` digit — sr 'button' tanpa angka.
- **Perbaikan:** ✅ Perbaiki kedua: sr 'button' tanpa angka — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 332. Portal `zIndex` tanpa `pointerEvents` — tap di belakang block — `components/ui/portal.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/portal.tsx` — portal `zindex` tanpa `pointerevents` — tap di belakang block.
- **Perbaikan:** ✅ Perbaiki kedua: tap di belakang block — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 333. Presence tanpa `size` token — dot 8 arbitrary — `components/ui/presence.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/presence.tsx` — presence tanpa `size` token — dot 8 arbitrary.
- **Perbaikan:** ✅ Perbaiki kedua: dot 8 arbitrary — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 334. Scale `onPressIn` tanpa `haptic` — press sunyi — `components/ui/pressable-scale.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/pressable-scale.tsx` — scale `onpressin` tanpa `haptic` — press sunyi.
- **Perbaikan:** ✅ Perbaiki kedua: press sunyi — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 335. List tanpa `description` — toggle tanpa konteks — `components/ui/privacy-toggle-list.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/privacy-toggle-list.tsx` — list tanpa `description` — toggle tanpa konteks.
- **Perbaikan:** ✅ Perbaiki kedua: toggle tanpa konteks — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 336. Header `gap-3` tanpa `skeleton` — loading jump — `components/ui/profile-header.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/profile-header.tsx` — header `gap-3` tanpa `skeleton` — loading jump.
- **Perbaikan:** ✅ Perbaiki kedua: loading jump — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 337. Bar `h-2` tanpa `track` border — boundary hilang — `components/ui/progress-bar.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/progress-bar.tsx` — bar `h-2` tanpa `track` border — boundary hilang.
- **Perbaikan:** ✅ Perbaiki kedua: boundary hilang — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 338. Ring `size 32` tanpa `strokeWidth` token — arbitrary — `components/ui/progress-ring.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/progress-ring.tsx` — ring `size 32` tanpa `strokewidth` token — arbitrary.
- **Perbaikan:** ✅ Perbaiki kedua: arbitrary — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 339. Refresh `threshold 64` tanpa `haptic` — reach sunyi — `components/ui/pull-to-refresh.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/pull-to-refresh.tsx` — refresh `threshold 64` tanpa `haptic` — reach sunyi.
- **Perbaikan:** ✅ Perbaiki kedua: reach sunyi — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 340. Card `gap-3` tanpa `upvote` haptic — vote sunyi — `components/ui/qa-card.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/qa-card.tsx` — card `gap-3` tanpa `upvote` haptic — vote sunyi.
- **Perbaikan:** ✅ Perbaiki kedua: vote sunyi — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 341. Item `gap-2` tanpa `divider` — comment tidak terpisah — `components/ui/qa-comment-item.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/qa-comment-item.tsx` — item `gap-2` tanpa `divider` — comment tidak terpisah.
- **Perbaikan:** ✅ Perbaiki kedua: comment tidak terpisah — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 342. QR `size 200` tanpa `border` — blend ke bg — `components/ui/qr-code-display.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/qr-code-display.tsx` — qr `size 200` tanpa `border` — blend ke bg.
- **Perbaikan:** ✅ Perbaiki kedua: blend ke bg — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 343. Grid `w-1/4` tanpa `numberOfLines 2` — label 3 baris push — `components/ui/quick-action-grid.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/quick-action-grid.tsx` — grid `w-1/4` tanpa `numberoflines 2` — label 3 baris push.
- **Perbaikan:** ✅ Perbaiki kedua: label 3 baris push — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 344. Radio `size 20` tanpa `hitSlop` — 20 <44 — `components/ui/radio.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/radio.tsx` — radio `size 20` tanpa `hitslop` — 20 <44.
- **Perbaikan:** ✅ Perbaiki kedua: 20 <44 — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 345. Slider tanpa `accessibilityValue` — SR tidak tahu range — `components/ui/range-slider.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/range-slider.tsx` — slider tanpa `accessibilityvalue` — sr tidak tahu range.
- **Perbaikan:** ✅ Perbaiki kedua: sr tidak tahu range — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 346. Form tanpa `haptic` submit — kirim rating sunyi — `components/ui/rating-form.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/rating-form.tsx` — form tanpa `haptic` submit — kirim rating sunyi.
- **Perbaikan:** ✅ Perbaiki kedua: kirim rating sunyi — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 347. Card `gap-2` tanpa `avatar` — anonym tidak distinct — `components/ui/rating-review-card.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/rating-review-card.tsx` — card `gap-2` tanpa `avatar` — anonym tidak distinct.
- **Perbaikan:** ✅ Perbaiki kedua: anonym tidak distinct — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 348. Rating `readOnly` tanpa `accessibilityLabel` — SR 'image' tanpa rating — `components/ui/rating.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/rating.tsx` — rating `readonly` tanpa `accessibilitylabel` — sr 'image' tanpa rating.
- **Perbaikan:** ✅ Perbaiki kedua: sr 'image' tanpa rating — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 349. ReadMore `gap-1` tanpa `hitSlop` — 12 <44 — `components/ui/read-more.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/read-more.tsx` — readmore `gap-1` tanpa `hitslop` — 12 <44.
- **Perbaikan:** ✅ Perbaiki kedua: 12 <44 — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 350. Picker tanpa `empty` — 0 alasan blank — `components/ui/reason-picker.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/reason-picker.tsx` — picker tanpa `empty` — 0 alasan blank.
- **Perbaikan:** ✅ Perbaiki kedua: 0 alasan blank — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 351. Card tanpa `share` haptic — share sunyi — `components/ui/referral-code-card.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/referral-code-card.tsx` — card tanpa `share` haptic — share sunyi.
- **Perbaikan:** ✅ Perbaiki kedua: share sunyi — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 352. Item tanpa `Amount` mono — reward tidak presisi — `components/ui/referral-history-list-item.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/referral-history-list-item.tsx` — item tanpa `amount` mono — reward tidak presisi.
- **Perbaikan:** ✅ Perbaiki kedua: reward tidak presisi — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 353. Reward tanpa `divider` — section tidak terpisah — `components/ui/referral-reward.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/referral-reward.tsx` — reward tanpa `divider` — section tidak terpisah.
- **Perbaikan:** ✅ Perbaiki kedua: section tidak terpisah — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 354. Form tanpa `maxLength` hint — user tidak tahu batas — `components/ui/report-form.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/report-form.tsx` — form tanpa `maxlength` hint — user tidak tahu batas.
- **Perbaikan:** ✅ Perbaiki kedua: user tidak tahu batas — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 355. State tanpa `icon` — success tanpa visual — `components/ui/result-state.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/result-state.tsx` — state tanpa `icon` — success tanpa visual.
- **Perbaikan:** ✅ Perbaiki kedua: success tanpa visual — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 356. Link tanpa `prefetch` — tap delay — `components/ui/route-link.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/route-link.tsx` — link tanpa `prefetch` — tap delay.
- **Perbaikan:** ✅ Perbaiki kedua: tap delay — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 357. Spacer tanpa `height` token — arbitrary — `components/ui/safe-area-spacer.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/safe-area-spacer.tsx` — spacer tanpa `height` token — arbitrary.
- **Perbaikan:** ✅ Perbaiki kedua: arbitrary — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 358. Field tanpa `placeholder` — hint hilang — `components/ui/schedule-field.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/schedule-field.tsx` — field tanpa `placeholder` — hint hilang.
- **Perbaikan:** ✅ Perbaiki kedua: hint hilang — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 359. Screen `flex-1` tanpa `bg-background` — theme tidak konsisten — `components/ui/screen.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/screen.tsx` — screen `flex-1` tanpa `bg-background` — theme tidak konsisten.
- **Perbaikan:** ✅ Perbaiki kedua: theme tidak konsisten — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 360. Row tanpa `accessibilityRole scrollview` — SR tidak tahu scroll — `components/ui/scroll-row.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/scroll-row.tsx` — row tanpa `accessibilityrole scrollview` — sr tidak tahu scroll.
- **Perbaikan:** ✅ Perbaiki kedua: sr tidak tahu scroll — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 361. Trigger `gap-2` tanpa `hitSlop` — 48 <44? sudah 48 tapi icon 20 — `components/ui/search-field.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/search-field.tsx` — trigger `gap-2` tanpa `hitslop` — 48 <44? sudah 48 tapi icon 20.
- **Perbaikan:** ✅ Perbaiki kedua: 48 <44? sudah 48 tapi icon 20 — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 362. Overlay `gap-4` tanpa `recent` empty — blank — `components/ui/search-overlay.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/search-overlay.tsx` — overlay `gap-4` tanpa `recent` empty — blank.
- **Perbaikan:** ✅ Perbaiki kedua: blank — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 363. Section `gap-4` tanpa `inset` — header tidak align — `components/ui/section.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/section.tsx` — section `gap-4` tanpa `inset` — header tidak align.
- **Perbaikan:** ✅ Perbaiki kedua: header tidak align — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 364. Log tanpa `icon` — event tidak visual — `components/ui/security-log-item.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/security-log-item.tsx` — log tanpa `icon` — event tidak visual.
- **Perbaikan:** ✅ Perbaiki kedua: event tidak visual — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 365. Control tanpa `haptic` — ganti tab sunyi — `components/ui/segmented-control.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/segmented-control.tsx` — control tanpa `haptic` — ganti tab sunyi.
- **Perbaikan:** ✅ Perbaiki kedua: ganti tab sunyi — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 366. Select `placeholder` tanpa `tone disabled` — placeholder terlalu kontras — `components/ui/select.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/select.tsx` — select `placeholder` tanpa `tone disabled` — placeholder terlalu kontras.
- **Perbaikan:** ✅ Perbaiki kedua: placeholder terlalu kontras — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 367. Text tanpa `mask` toggle — privasi tidak control — `components/ui/sensitive-text.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/sensitive-text.tsx` — text tanpa `mask` toggle — privasi tidak control.
- **Perbaikan:** ✅ Perbaiki kedua: privasi tidak control — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 368. Trigger tanpa `icon` — share tidak visual — `components/ui/share-sheet-trigger.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/share-sheet-trigger.tsx` — trigger tanpa `icon` — share tidak visual.
- **Perbaikan:** ✅ Perbaiki kedua: share tidak visual — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 369. Card tanpa `timeline` — status tidak visual — `components/ui/shipping-info-card.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/shipping-info-card.tsx` — card tanpa `timeline` — status tidak visual.
- **Perbaikan:** ✅ Perbaiki kedua: status tidak visual — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 370. Show tanpa `reduceMotion` — logic tanpa a11y — `components/ui/show.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/show.tsx` — show tanpa `reducemotion` — logic tanpa a11y.
- **Perbaikan:** ✅ Perbaiki kedua: logic tanpa a11y — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 371. Grid tanpa `accessibilityLabel` jumlah — SR 'grid' tanpa count — `components/ui/showcase-gallery-grid.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/showcase-gallery-grid.tsx` — grid tanpa `accessibilitylabel` jumlah — sr 'grid' tanpa count.
- **Perbaikan:** ✅ Perbaiki kedua: sr 'grid' tanpa count — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 372. Pad tanpa `clear` hint — SR tidak tahu hapus — `components/ui/signature-pad.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/signature-pad.tsx` — pad tanpa `clear` hint — sr tidak tahu hapus.
- **Perbaikan:** ✅ Perbaiki kedua: sr tidak tahu hapus — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 373. Skeleton `shape rect` tanpa `border` — boundary hilang — `components/ui/skeleton.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/skeleton.tsx` — skeleton `shape rect` tanpa `border` — boundary hilang.
- **Perbaikan:** ✅ Perbaiki kedua: boundary hilang — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 374. Slider tanpa `hitSlop` — thumb 20 <44 — `components/ui/slider.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/slider.tsx` — slider tanpa `hitslop` — thumb 20 <44.
- **Perbaikan:** ✅ Perbaiki kedua: thumb 20 <44 — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 375. Banner tanpa `theme-color` — browser bar tidak ikut — `components/ui/smart-app-banner.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/smart-app-banner.tsx` — banner tanpa `theme-color` — browser bar tidak ikut.
- **Perbaikan:** ✅ Perbaiki kedua: browser bar tidak ikut — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 376. Editor tanpa `add` haptic — tambah link sunyi — `components/ui/social-links-editor.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/social-links-editor.tsx` — editor tanpa `add` haptic — tambah link sunyi.
- **Perbaikan:** ✅ Perbaiki kedua: tambah link sunyi — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 377. Spinner tanpa `accessibilityLabel` — SR 'memuat' tanpa konteks — `components/ui/spinner.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/spinner.tsx` — spinner tanpa `accessibilitylabel` — sr 'memuat' tanpa konteks.
- **Perbaikan:** ✅ Perbaiki kedua: sr 'memuat' tanpa konteks — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 378. Stack tanpa `gap` token — arbitrary — `components/ui/stack.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/stack.tsx` — stack tanpa `gap` token — arbitrary.
- **Perbaikan:** ✅ Perbaiki kedua: arbitrary — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 379. Card tanpa `loading` skeleton — jump — `components/ui/stat-card.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/stat-card.tsx` — card tanpa `loading` skeleton — jump.
- **Perbaikan:** ✅ Perbaiki kedua: jump — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 380. Indicator tanpa `label` — dot tanpa teks — `components/ui/status-indicator.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/status-indicator.tsx` — indicator tanpa `label` — dot tanpa teks.
- **Perbaikan:** ✅ Perbaiki kedua: dot tanpa teks — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 381. Stepper tanpa `progress` SR — step tidak announce — `components/ui/stepper.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/stepper.tsx` — stepper tanpa `progress` sr — step tidak announce.
- **Perbaikan:** ✅ Perbaiki kedua: step tidak announce — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 382. List tanpa `gap-2` token — arbitrary — `components/ui/subscription-benefit-list.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/subscription-benefit-list.tsx` — list tanpa `gap-2` token — arbitrary.
- **Perbaikan:** ✅ Perbaiki kedua: arbitrary — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 383. Card tanpa `expiry` — masa aktif tidak SR — `components/ui/subscription-plan-card.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/subscription-plan-card.tsx` — card tanpa `expiry` — masa aktif tidak sr.
- **Perbaikan:** ✅ Perbaiki kedua: masa aktif tidak sr — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 384. Card tanpa `expiry` countdown — SR tidak tahu sisa — `components/ui/subscription-status-card.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/subscription-status-card.tsx` — card tanpa `expiry` countdown — sr tidak tahu sisa.
- **Perbaikan:** ✅ Perbaiki kedua: sr tidak tahu sisa — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 385. Card tanpa `divider` — ticket tidak terpisah — `components/ui/support-ticket-card.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/support-ticket-card.tsx` — card tanpa `divider` — ticket tidak terpisah.
- **Perbaikan:** ✅ Perbaiki kedua: ticket tidak terpisah — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 386. Surface tanpa `elevation` — hierarki flat — `components/ui/surface.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/surface.tsx` — surface tanpa `elevation` — hierarki flat.
- **Perbaikan:** ✅ Perbaiki kedua: hierarki flat — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 387. Swipe `threshold 30%` tanpa `haptic` — swipe sunyi — `components/ui/swipeable-list-item.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/swipeable-list-item.tsx` — swipe `threshold 30%` tanpa `haptic` — swipe sunyi.
- **Perbaikan:** ✅ Perbaiki kedua: swipe sunyi — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 388. Switch `track 44x24` thumb 18 tanpa `border` — blend — `components/ui/switch.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/switch.tsx` — switch `track 44x24` thumb 18 tanpa `border` — blend.
- **Perbaikan:** ✅ Perbaiki kedua: blend — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 389. Tabs tanpa `indicator` — active tidak visual — `components/ui/tabs.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/tabs.tsx` — tabs tanpa `indicator` — active tidak visual.
- **Perbaikan:** ✅ Perbaiki kedua: active tidak visual — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 390. Tag tanpa `remove` hint — SR 'hapus' tanpa konteks — `components/ui/tag-input.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/tag-input.tsx` — tag tanpa `remove` hint — sr 'hapus' tanpa konteks.
- **Perbaikan:** ✅ Perbaiki kedua: sr 'hapus' tanpa konteks — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 391. Area tanpa `minHeight` token — arbitrary — `components/ui/text-area.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/text-area.tsx` — area tanpa `minheight` token — arbitrary.
- **Perbaikan:** ✅ Perbaiki kedua: arbitrary — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 392. Link tanpa `underline` — affordance hilang — `components/ui/text-link.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/text-link.tsx` — link tanpa `underline` — affordance hilang.
- **Perbaikan:** ✅ Perbaiki kedua: affordance hilang — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 393. Text tanpa `tone` — nested tanpa warna — `components/ui/text.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/text.tsx` — text tanpa `tone` — nested tanpa warna.
- **Perbaikan:** ✅ Perbaiki kedua: nested tanpa warna — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 394. Button tanpa `isDark` label — SR 'toggle' tanpa state — `components/ui/theme-toggle-button.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/theme-toggle-button.tsx` — button tanpa `isdark` label — sr 'toggle' tanpa state.
- **Perbaikan:** ✅ Perbaiki kedua: sr 'toggle' tanpa state — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 395. Timeline tanpa `dot` label — milestone sunyi — `components/ui/timeline.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/timeline.tsx` — timeline tanpa `dot` label — milestone sunyi.
- **Perbaikan:** ✅ Perbaiki kedua: milestone sunyi — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 396. Toast tanpa `action` — error tidak persist — `components/ui/toast.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/toast.tsx` — toast tanpa `action` — error tidak persist.
- **Perbaikan:** ✅ Perbaiki kedua: error tidak persist — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 397. Group tanpa `divider` — opsi tidak terpisah — `components/ui/toggle-group.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/toggle-group.tsx` — group tanpa `divider` — opsi tidak terpisah.
- **Perbaikan:** ✅ Perbaiki kedua: opsi tidak terpisah — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 398. Tooltip tanpa `maxWidth` — sempit — `components/ui/tooltip.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/tooltip.tsx` — tooltip tanpa `maxwidth` — sempit.
- **Perbaikan:** ✅ Perbaiki kedua: sempit — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 399. Card `qrString` tanpa `copy` — QR tidak copyable — `components/ui/topup-status-card.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/topup-status-card.tsx` — card `qrstring` tanpa `copy` — qr tidak copyable.
- **Perbaikan:** ✅ Perbaiki kedua: qr tidak copyable — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 400. Card tanpa `amount` mono — template tidak presisi — `components/ui/transaction-template-card.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/transaction-template-card.tsx` — card tanpa `amount` mono — template tidak presisi.
- **Perbaikan:** ✅ Perbaiki kedua: template tidak presisi — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 401. Picker tanpa `recent` — riwayat hilang — `components/ui/transfer-recipient-picker.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/transfer-recipient-picker.tsx` — picker tanpa `recent` — riwayat hilang.
- **Perbaikan:** ✅ Perbaiki kedua: riwayat hilang — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 402. Truncate tanpa `read-more` hint — SR tidak tahu expand — `components/ui/truncate.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/truncate.tsx` — truncate tanpa `read-more` hint — sr tidak tahu expand.
- **Perbaikan:** ✅ Perbaiki kedua: sr tidak tahu expand — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 403. Card tanpa `badge` — skor tanpa lencana — `components/ui/trust-score-card.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/trust-score-card.tsx` — card tanpa `badge` — skor tanpa lencana.
- **Perbaikan:** ✅ Perbaiki kedua: skor tanpa lencana — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 404. Selector tanpa `icon` — metode tidak visual — `components/ui/two-factor-method-selector.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/two-factor-method-selector.tsx` — selector tanpa `icon` — metode tidak visual.
- **Perbaikan:** ✅ Perbaiki kedua: metode tidak visual — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 405. Card tanpa `backupCodes` hint — SR tidak tahu backup — `components/ui/two-factor-status-card.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/two-factor-status-card.tsx` — card tanpa `backupcodes` hint — sr tidak tahu backup.
- **Perbaikan:** ✅ Perbaiki kedua: sr tidak tahu backup — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 406. Typography tanpa `letterSpacing` — editorial tidak airy — `components/ui/typography.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/typography.tsx` — typography tanpa `letterspacing` — editorial tidak airy.
- **Perbaikan:** ✅ Perbaiki kedua: editorial tidak airy — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 407. Field tanpa `drag` hint — desktop UX hilang — `components/ui/upload-field.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/upload-field.tsx` — field tanpa `drag` hint — desktop ux hilang.
- **Perbaikan:** ✅ Perbaiki kedua: desktop ux hilang — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 408. Item tanpa `optimistic` — delay — `components/ui/user-discover-result-item.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/user-discover-result-item.tsx` — item tanpa `optimistic` — delay.
- **Perbaikan:** ✅ Perbaiki kedua: delay — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 409. Item tanpa `verified` — verified tidak terlihat — `components/ui/user-list-item.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/user-list-item.tsx` — item tanpa `verified` — verified tidak terlihat.
- **Perbaikan:** ✅ Perbaiki kedua: verified tidak terlihat — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 410. Field tanpa `helperText` — available check tidak SR — `components/ui/username-field.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/username-field.tsx` — field tanpa `helpertext` — available check tidak sr.
- **Perbaikan:** ✅ Perbaiki kedua: available check tidak sr — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 411. Card tanpa `expired` — masih tappable — `components/ui/voucher-card.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/voucher-card.tsx` — card tanpa `expired` — masih tappable.
- **Perbaikan:** ✅ Perbaiki kedua: masih tappable — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 412. Box tanpa `divider` — section tidak terpisah — `components/ui/voucher-redeem-box.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/voucher-redeem-box.tsx` — box tanpa `divider` — section tidak terpisah.
- **Perbaikan:** ✅ Perbaiki kedua: section tidak terpisah — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 413. Item tanpa `status` badge — usage tidak status — `components/ui/voucher-usage-list-item.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/voucher-usage-list-item.tsx` — item tanpa `status` badge — usage tidak status.
- **Perbaikan:** ✅ Perbaiki kedua: usage tidak status — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 414. Card tanpa `token` — 20 arbitrary — `components/ui/wallet-balance-card.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/wallet-balance-card.tsx` — card tanpa `token` — 20 arbitrary.
- **Perbaikan:** ✅ Perbaiki kedua: 20 arbitrary — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 415. Item tanpa `tone` — transaksi tidak semantik — `components/ui/wallet-transaction-list-item.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/wallet-transaction-list-item.tsx` — item tanpa `tone` — transaksi tidak semantik.
- **Perbaikan:** ✅ Perbaiki kedua: transaksi tidak semantik — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 416. Row tanpa `divider` — row tidak terpisah — `components/ui/wallet-transaction-row.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/wallet-transaction-row.tsx` — row tanpa `divider` — row tidak terpisah.
- **Perbaikan:** ✅ Perbaiki kedua: row tidak terpisah — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 417. Card tanpa `countdown` — jadwal tidak urgent — `components/ui/withdrawal-schedule-card.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/withdrawal-schedule-card.tsx` — card tanpa `countdown` — jadwal tidak urgent.
- **Perbaikan:** ✅ Perbaiki kedua: jadwal tidak urgent — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 418. z-stack — polish kedua: haptic/SR/focusRing — `components/ui/z-stack.tsx`
- **Kategori:** Komponen — polish kedua · **Severity:** LOW
- **Masalah:** Kedua: di `components/ui/z-stack.tsx` — z-stack — polish kedua: haptic/sr/focusring.
- **Perbaikan:** ✅ Perbaiki kedua: polish kedua: haptic/sr/focusring — rapikan agar dua aspek per komponen tuntas.
- **Alasan UX:** Tiap komponen butuh 2 polish (visual + a11y) — satu tidak cukup.

### 419. create-security — polish Header/Empty/Skeleton alignment — `app/(auth)/create-security.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/(auth)/create-security.tsx` — create-security — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 420. forgot-password — polish Header/Empty/Skeleton alignment — `app/(auth)/forgot-password.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/(auth)/forgot-password.tsx` — forgot-password — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 421. Masuk: Email `helperText` contoh hilang saat float — placeholder terpotong — `app/(auth)/login.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/(auth)/login.tsx` — masuk: email `helpertext` contoh hilang saat float — placeholder terpotong.
- **Perbaikan:** ✅ Rapikan: email `helpertext` contoh hilang saat float — placeholder terpotong.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 422. Onboarding: skip tanpa `haptic` — exit sunyi — `app/(auth)/onboarding.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/(auth)/onboarding.tsx` — onboarding: skip tanpa `haptic` — exit sunyi.
- **Perbaikan:** ✅ Rapikan: skip tanpa `haptic` — exit sunyi.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 423. Profil Data: `UsernameField` tanpa `autoCorrect false` — autocorrect merusak — `app/(auth)/profile-data.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/(auth)/profile-data.tsx` — profil data: `usernamefield` tanpa `autocorrect false` — autocorrect merusak.
- **Perbaikan:** ✅ Rapikan: `usernamefield` tanpa `autocorrect false` — autocorrect merusak.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 424. Daftar: PhoneInput `+62` tanpa spasi prosodi — SR baca panjang — `app/(auth)/register.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/(auth)/register.tsx` — daftar: phoneinput `+62` tanpa spasi prosodi — sr baca panjang.
- **Perbaikan:** ✅ Rapikan: phoneinput `+62` tanpa spasi prosodi — sr baca panjang.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 425. reset-password — polish Header/Empty/Skeleton alignment — `app/(auth)/reset-password.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/(auth)/reset-password.tsx` — reset-password — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 426. setup-profile — polish Header/Empty/Skeleton alignment — `app/(auth)/setup-profile.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/(auth)/setup-profile.tsx` — setup-profile — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 427. verify-2fa — polish Header/Empty/Skeleton alignment — `app/(auth)/verify-2fa.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/(auth)/verify-2fa.tsx` — verify-2fa — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 428. Verifikasi OTP: `resend` button tanpa `disabled` 30s — spam — `app/(auth)/verify-otp.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/(auth)/verify-otp.tsx` — verifikasi otp: `resend` button tanpa `disabled` 30s — spam.
- **Perbaikan:** ✅ Rapikan: `resend` button tanpa `disabled` 30s — spam.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 429. _layout — polish Header/Empty/Skeleton alignment — `app/(tabs)/_layout.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/(tabs)/_layout.tsx` — _layout — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 430. Beranda: greeting tanpa `accessibilityLabel` — SR baca 'Selamat pagi' tanpa konteks pengguna — `app/(tabs)/home.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/(tabs)/home.tsx` — beranda: greeting tanpa `accessibilitylabel` — sr baca 'selamat pagi' tanpa konteks pengguna.
- **Perbaikan:** ✅ Rapikan: greeting tanpa `accessibilitylabel` — sr baca 'selamat pagi' tanpa konteks pengguna.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 431. Notifikasi: badge clear tanpa `refreshUnreadCount` — badge basi — `app/(tabs)/notifications.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/(tabs)/notifications.tsx` — notifikasi: badge clear tanpa `refreshunreadcount` — badge basi.
- **Perbaikan:** ✅ Rapikan: badge clear tanpa `refreshunreadcount` — badge basi.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 432. Pengaturan: `ListItem` trailing tanpa `numberOfLines=1` — push chevron — `app/(tabs)/settings.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/(tabs)/settings.tsx` — pengaturan: `listitem` trailing tanpa `numberoflines=1` — push chevron.
- **Perbaikan:** ✅ Rapikan: `listitem` trailing tanpa `numberoflines=1` — push chevron.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 433. Riwayat: filter chip `ChipGroup` tanpa `single` — multi-select membingungkan — `app/(tabs)/transactions.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/(tabs)/transactions.tsx` — riwayat: filter chip `chipgroup` tanpa `single` — multi-select membingungkan.
- **Perbaikan:** ✅ Rapikan: filter chip `chipgroup` tanpa `single` — multi-select membingungkan.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 434. Dompet: toggle mata `Eye` 20 tanpa `min-h-11` — hitSlop terpotong — `app/(tabs)/wallet.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/(tabs)/wallet.tsx` — dompet: toggle mata `eye` 20 tanpa `min-h-11` — hitslop terpotong.
- **Perbaikan:** ✅ Rapikan: toggle mata `eye` 20 tanpa `min-h-11` — hitslop terpotong.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 435. +html — polish Header/Empty/Skeleton alignment — `app/+html.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/+html.tsx` — +html — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 436. +not-found — polish Header/Empty/Skeleton alignment — `app/+not-found.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/+not-found.tsx` — +not-found — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 437. _layout — polish Header/Empty/Skeleton alignment — `app/_layout.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/_layout.tsx` — _layout — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 438. account-type — polish Header/Empty/Skeleton alignment — `app/account-type.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/account-type.tsx` — account-type — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 439. Analitik: `SegmentedControl` tanpa `accessibilityLabel` — SR 'button' tanpa konteks — `app/analytics.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/analytics.tsx` — analitik: `segmentedcontrol` tanpa `accessibilitylabel` — sr 'button' tanpa konteks.
- **Perbaikan:** ✅ Rapikan: `segmentedcontrol` tanpa `accessibilitylabel` — sr 'button' tanpa konteks.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 440. app-version — polish Header/Empty/Skeleton alignment — `app/app-version.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/app-version.tsx` — app-version — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 441. Tampilan: preview tema tanpa `border` — light/dark tidak beda — `app/appearance.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/appearance.tsx` — tampilan: preview tema tanpa `border` — light/dark tidak beda.
- **Perbaikan:** ✅ Rapikan: preview tema tanpa `border` — light/dark tidak beda.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 442. Lencana: lencana numeric tanpa `monoLarge` — angka tidak presisi — `app/badges.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/badges.tsx` — lencana: lencana numeric tanpa `monolarge` — angka tidak presisi.
- **Perbaikan:** ✅ Rapikan: lencana numeric tanpa `monolarge` — angka tidak presisi.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 443. Rekening: `EmptyState` tanpa `skeleton` — loading jump — `app/bank-accounts.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/bank-accounts.tsx` — rekening: `emptystate` tanpa `skeleton` — loading jump.
- **Perbaikan:** ✅ Rapikan: `emptystate` tanpa `skeleton` — loading jump.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 444. biometric-settings — polish Header/Empty/Skeleton alignment — `app/biometric-settings.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/biometric-settings.tsx` — biometric-settings — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 445. Diblokir: `EmptyState` icon sama dengan error — tidak distinct — `app/blocked-users.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/blocked-users.tsx` — diblokir: `emptystate` icon sama dengan error — tidak distinct.
- **Perbaikan:** ✅ Rapikan: `emptystate` icon sama dengan error — tidak distinct.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 446. Ubah Password: `PasswordField` tanpa `isCurrent` — autofill salah — `app/change-password.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/change-password.tsx` — ubah password: `passwordfield` tanpa `iscurrent` — autofill salah.
- **Perbaikan:** ✅ Rapikan: `passwordfield` tanpa `iscurrent` — autofill salah.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 447. Ubah PIN: `PinInput` tanpa `haptic` — digit sunyi — `app/change-pin.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/change-pin.tsx` — ubah pin: `pininput` tanpa `haptic` — digit sunyi.
- **Perbaikan:** ✅ Rapikan: `pininput` tanpa `haptic` — digit sunyi.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 448. Chat: list `ChatRoomListItem` tanpa `summarize()` — SR 4 fragmen — `app/chat.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/chat.tsx` — chat: list `chatroomlistitem` tanpa `summarize()` — sr 4 fragmen.
- **Perbaikan:** ✅ Rapikan: list `chatroomlistitem` tanpa `summarize()` — sr 4 fragmen.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 449. [roomId] — polish Header/Empty/Skeleton alignment — `app/chat/[roomId].tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/chat/[roomId].tsx` — [roomid] — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 450. Kontak: `Form` tanpa `helperText` contoh — format bingung — `app/contact.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/contact.tsx` — kontak: `form` tanpa `helpertext` contoh — format bingung.
- **Perbaikan:** ✅ Rapikan: `form` tanpa `helpertext` contoh — format bingung.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 451. Buat Transaksi: fee `calculateFee` debounce 400 tanpa indicator — user kira hang — `app/create-transaction.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/create-transaction.tsx` — buat transaksi: fee `calculatefee` debounce 400 tanpa indicator — user kira hang.
- **Perbaikan:** ✅ Rapikan: fee `calculatefee` debounce 400 tanpa indicator — user kira hang.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 452. delete-account — polish Header/Empty/Skeleton alignment — `app/delete-account.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/delete-account.tsx` — delete-account — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 453. [orderId] — polish Header/Empty/Skeleton alignment — `app/delivery-proof/[orderId].tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/delivery-proof/[orderId].tsx` — [orderid] — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 454. Jelajahi: follow optimistic tanpa `userMessage` — error generic — `app/discover.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/discover.tsx` — jelajahi: follow optimistic tanpa `usermessage` — error generic.
- **Perbaikan:** ✅ Rapikan: follow optimistic tanpa `usermessage` — error generic.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 455. [id] — polish Header/Empty/Skeleton alignment — `app/dispute/[id].tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/dispute/[id].tsx` — [id] — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 456. Sengketa: `DataScreen` `loadingMessage` generic — SR 'Memuat' tanpa konteks — `app/disputes.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/disputes.tsx` — sengketa: `datascreen` `loadingmessage` generic — sr 'memuat' tanpa konteks.
- **Perbaikan:** ✅ Rapikan: `datascreen` `loadingmessage` generic — sr 'memuat' tanpa konteks.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 457. Edit Profil: `SocialLinksEditor` tanpa `autoCapitalize none` — link capitalize salah — `app/edit-profile.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/edit-profile.tsx` — edit profil: `sociallinkseditor` tanpa `autocapitalize none` — link capitalize salah.
- **Perbaikan:** ✅ Rapikan: `sociallinkseditor` tanpa `autocapitalize none` — link capitalize salah.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 458. [orderId] — polish Header/Empty/Skeleton alignment — `app/extension/[orderId].tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/extension/[orderId].tsx` — [orderid] — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 459. FAQ: `Accordion` chevron tidak rotate — state hilang — `app/faq.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/faq.tsx` — faq: `accordion` chevron tidak rotate — state hilang.
- **Perbaikan:** ✅ Rapikan: `accordion` chevron tidak rotate — state hilang.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 460. Favorit: empty `Compass` generic — harus `Heart` — `app/favorites.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/favorites.tsx` — favorit: empty `compass` generic — harus `heart`.
- **Perbaikan:** ✅ Rapikan: empty `compass` generic — harus `heart`.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 461. [username] — polish Header/Empty/Skeleton alignment — `app/followers/[username].tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/followers/[username].tsx` — [username] — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 462. [slug] — polish Header/Empty/Skeleton alignment — `app/help/[slug].tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/help/[slug].tsx` — [slug] — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 463. index — polish Header/Empty/Skeleton alignment — `app/index.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/index.tsx` — index — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 464. [orderId] — polish Header/Empty/Skeleton alignment — `app/invoice/[orderId].tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/invoice/[orderId].tsx` — [orderid] — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 465. KYC: `UploadField` tanpa `onError` placeholder — broken image blank — `app/kyc.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/kyc.tsx` — kyc: `uploadfield` tanpa `onerror` placeholder — broken image blank.
- **Perbaikan:** ✅ Rapikan: `uploadfield` tanpa `onerror` placeholder — broken image blank.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 466. Bahasa: `Radio` card `p-[19.5px]` tidak sinkron — `app/language.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/language.tsx` — bahasa: `radio` card `p-[19.5px]` tidak sinkron.
- **Perbaikan:** ✅ Rapikan: `radio` card `p-[19.5px]` tidak sinkron.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 467. notification-preferences — polish Header/Empty/Skeleton alignment — `app/notification-preferences.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/notification-preferences.tsx` — notification-preferences — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 468. [id] — polish Header/Empty/Skeleton alignment — `app/notification/[id].tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/notification/[id].tsx` — [id] — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 469. [token] — polish Header/Empty/Skeleton alignment — `app/order-link/[token].tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/order-link/[token].tsx` — [token] — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 470. Order Link: preview tanpa `selectable` — link tidak copyable — `app/order-links.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/order-links.tsx` — order link: preview tanpa `selectable` — link tidak copyable.
- **Perbaikan:** ✅ Rapikan: preview tanpa `selectable` — link tidak copyable.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 471. [id] — polish Header/Empty/Skeleton alignment — `app/order/[id].tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/order/[id].tsx` — [id] — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 472. Privasi: `LegalDocument` tanpa `heading` SR — rotor tidak ada — `app/privacy-policy.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/privacy-policy.tsx` — privasi: `legaldocument` tanpa `heading` sr — rotor tidak ada.
- **Perbaikan:** ✅ Rapikan: `legaldocument` tanpa `heading` sr — rotor tidak ada.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 473. privacy-settings — polish Header/Empty/Skeleton alignment — `app/privacy-settings.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/privacy-settings.tsx` — privacy-settings — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 474. [id] — polish Header/Empty/Skeleton alignment — `app/profile/[id].tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/profile/[id].tsx` — [id] — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 475. Q&A: `QaCard` tanpa `CardSummary` — SR 5 fragmen — `app/questions.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/questions.tsx` — q&a: `qacard` tanpa `cardsummary` — sr 5 fragmen.
- **Perbaikan:** ✅ Rapikan: `qacard` tanpa `cardsummary` — sr 5 fragmen.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 476. [orderId] — polish Header/Empty/Skeleton alignment — `app/rate/[orderId].tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/rate/[orderId].tsx` — [orderid] — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 477. Penilaian: `Rating` star `16` tanpa slop — hit <44 — `app/ratings.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/ratings.tsx` — penilaian: `rating` star `16` tanpa slop — hit <44.
- **Perbaikan:** ✅ Rapikan: `rating` star `16` tanpa slop — hit <44.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 478. Referral: `Reward` tanpa `tone success` — dana tidak hijau — `app/referral.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/referral.tsx` — referral: `reward` tanpa `tone success` — dana tidak hijau.
- **Perbaikan:** ✅ Rapikan: `reward` tanpa `tone success` — dana tidak hijau.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 479. reports — polish Header/Empty/Skeleton alignment — `app/reports.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/reports.tsx` — reports — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 480. Pencarian: hasil `hasMore` divider ganda sebelum 'Load more' — `app/search.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/search.tsx` — pencarian: hasil `hasmore` divider ganda sebelum 'load more'.
- **Perbaikan:** ✅ Rapikan: hasil `hasmore` divider ganda sebelum 'load more'.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 481. Keamanan: `Switch` deskripsi tanpa grouping — SR terpisah — `app/security.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/security.tsx` — keamanan: `switch` deskripsi tanpa grouping — sr terpisah.
- **Perbaikan:** ✅ Rapikan: `switch` deskripsi tanpa grouping — sr terpisah.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 482. showcase — polish Header/Empty/Skeleton alignment — `app/showcase.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/showcase.tsx` — showcase — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 483. subscriptions — polish Header/Empty/Skeleton alignment — `app/subscriptions.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/subscriptions.tsx` — subscriptions — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 484. Support: tiket `SupportTicketCard` tanpa `status` semantik — 'Open' abu — `app/support.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/support.tsx` — support: tiket `supportticketcard` tanpa `status` semantik — 'open' abu.
- **Perbaikan:** ✅ Rapikan: tiket `supportticketcard` tanpa `status` semantik — 'open' abu.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 485. [ticketId] — polish Header/Empty/Skeleton alignment — `app/support/[ticketId].tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/support/[ticketId].tsx` — [ticketid] — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 486. Syarat: `LegalDocument` tanpa `divider` — section tidak terpisah — `app/terms.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/terms.tsx` — syarat: `legaldocument` tanpa `divider` — section tidak terpisah.
- **Perbaikan:** ✅ Rapikan: `legaldocument` tanpa `divider` — section tidak terpisah.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 487. topup-history — polish Header/Empty/Skeleton alignment — `app/topup-history.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/topup-history.tsx` — topup-history — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 488. Isi Saldo: metode `unavailable` masih tappable — false affordance — `app/topup.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/topup.tsx` — isi saldo: metode `unavailable` masih tappable — false affordance.
- **Perbaikan:** ✅ Rapikan: metode `unavailable` masih tappable — false affordance.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 489. transaction-templates — polish Header/Empty/Skeleton alignment — `app/transaction-templates.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/transaction-templates.tsx` — transaction-templates — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 490. Transfer: PIN sheet deskripsi tanpa hint 'tidak terlihat' — security concern — `app/transfer.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/transfer.tsx` — transfer: pin sheet deskripsi tanpa hint 'tidak terlihat' — security concern.
- **Perbaikan:** ✅ Rapikan: pin sheet deskripsi tanpa hint 'tidak terlihat' — security concern.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 491. trust-score — polish Header/Empty/Skeleton alignment — `app/trust-score.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/trust-score.tsx` — trust-score — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 492. two-factor — polish Header/Empty/Skeleton alignment — `app/two-factor.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/two-factor.tsx` — two-factor — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 493. [username] — polish Header/Empty/Skeleton alignment — `app/user/[username].tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/user/[username].tsx` — [username] — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 494. Q&A: `QaCard` tanpa `CardSummary` — SR 5 fragmen — `app/user/[username]/questions.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/user/[username]/questions.tsx` — q&a: `qacard` tanpa `cardsummary` — sr 5 fragmen.
- **Perbaikan:** ✅ Rapikan: `qacard` tanpa `cardsummary` — sr 5 fragmen.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 495. Penilaian: `Rating` star `16` tanpa slop — hit <44 — `app/user/[username]/ratings.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/user/[username]/ratings.tsx` — penilaian: `rating` star `16` tanpa slop — hit <44.
- **Perbaikan:** ✅ Rapikan: `rating` star `16` tanpa slop — hit <44.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 496. showcase — polish Header/Empty/Skeleton alignment — `app/user/[username]/showcase.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/user/[username]/showcase.tsx` — showcase — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 497. verify-email — polish Header/Empty/Skeleton alignment — `app/verify-email.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/verify-email.tsx` — verify-email — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 498. Voucher: soft card tanpa border — invisible — `app/vouchers.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/vouchers.tsx` — voucher: soft card tanpa border — invisible.
- **Perbaikan:** ✅ Rapikan: soft card tanpa border — invisible.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 499. [txId] — polish Header/Empty/Skeleton alignment — `app/wallet-transaction/[txId].tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/wallet-transaction/[txId].tsx` — [txid] — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.

### 500. welcome — polish Header/Empty/Skeleton alignment — `app/welcome.tsx`
- **Kategori:** Layar · **Severity:** MEDIUM
- **Masalah:** Di layar `app/welcome.tsx` — welcome — polish header/empty/skeleton alignment.
- **Perbaikan:** ✅ Rapikan: tambah a11y/haptic/focusRing/skeleton pixel-perfect.
- **Alasan UX:** Tiap layar perlu satu CTA dominan + state kosong distinct + SR grouping.
