# Inventaris halaman (dihasilkan `npm run gen:inventory`; jangan edit manual)

81 route halaman, 18 di antaranya dinamis.

| Route | Berkas | Dinamis |
| --- | --- | --- |
| `/` | `app/index.tsx` |  |
| `/account-type` | `app/account-type.tsx` |  |
| `/analytics` | `app/analytics.tsx` |  |
| `/app-version` | `app/app-version.tsx` |  |
| `/appearance` | `app/appearance.tsx` |  |
| `/badges` | `app/badges.tsx` |  |
| `/bank-accounts` | `app/bank-accounts.tsx` |  |
| `/biometric-settings` | `app/biometric-settings.tsx` |  |
| `/blocked-users` | `app/blocked-users.tsx` |  |
| `/change-password` | `app/change-password.tsx` |  |
| `/change-pin` | `app/change-pin.tsx` |  |
| `/chat` | `app/chat.tsx` |  |
| `/chat/[roomId]` | `app/chat/[roomId].tsx` | ya |
| `/contact` | `app/contact.tsx` |  |
| `/create-security` | `app/(auth)/create-security.tsx` |  |
| `/create-transaction` | `app/create-transaction.tsx` |  |
| `/delete-account` | `app/delete-account.tsx` |  |
| `/delivery-proof/[orderId]` | `app/delivery-proof/[orderId].tsx` | ya |
| `/discover` | `app/discover.tsx` |  |
| `/dispute/[id]` | `app/dispute/[id].tsx` | ya |
| `/disputes` | `app/disputes.tsx` |  |
| `/edit-profile` | `app/edit-profile.tsx` |  |
| `/extension/[orderId]` | `app/extension/[orderId].tsx` | ya |
| `/faq` | `app/faq.tsx` |  |
| `/favorites` | `app/favorites.tsx` |  |
| `/followers/[username]` | `app/followers/[username].tsx` | ya |
| `/forgot-password` | `app/(auth)/forgot-password.tsx` |  |
| `/help/[slug]` | `app/help/[slug].tsx` | ya |
| `/home` | `app/(tabs)/home.tsx` |  |
| `/invoice/[orderId]` | `app/invoice/[orderId].tsx` | ya |
| `/kyc` | `app/kyc.tsx` |  |
| `/language` | `app/language.tsx` |  |
| `/login` | `app/(auth)/login.tsx` |  |
| `/notification-preferences` | `app/notification-preferences.tsx` |  |
| `/notification/[id]` | `app/notification/[id].tsx` | ya |
| `/notifications` | `app/(tabs)/notifications.tsx` |  |
| `/onboarding` | `app/(auth)/onboarding.tsx` |  |
| `/order-link/[token]` | `app/order-link/[token].tsx` | ya |
| `/order-links` | `app/order-links.tsx` |  |
| `/order/[id]` | `app/order/[id].tsx` | ya |
| `/privacy-policy` | `app/privacy-policy.tsx` |  |
| `/privacy-settings` | `app/privacy-settings.tsx` |  |
| `/profile-data` | `app/(auth)/profile-data.tsx` |  |
| `/profile/[id]` | `app/profile/[id].tsx` | ya |
| `/questions` | `app/questions.tsx` |  |
| `/rate/[orderId]` | `app/rate/[orderId].tsx` | ya |
| `/ratings` | `app/ratings.tsx` |  |
| `/referral` | `app/referral.tsx` |  |
| `/register` | `app/(auth)/register.tsx` |  |
| `/reports` | `app/reports.tsx` |  |
| `/reset-password` | `app/(auth)/reset-password.tsx` |  |
| `/search` | `app/search.tsx` |  |
| `/security` | `app/security.tsx` |  |
| `/settings` | `app/(tabs)/settings.tsx` |  |
| `/setup-profile` | `app/(auth)/setup-profile.tsx` |  |
| `/showcase` | `app/showcase.tsx` |  |
| `/subscriptions` | `app/subscriptions.tsx` |  |
| `/support` | `app/support.tsx` |  |
| `/support/[ticketId]` | `app/support/[ticketId].tsx` | ya |
| `/terms` | `app/terms.tsx` |  |
| `/topup` | `app/topup.tsx` |  |
| `/topup-history` | `app/topup-history.tsx` |  |
| `/transaction-templates` | `app/transaction-templates.tsx` |  |
| `/transactions` | `app/(tabs)/transactions.tsx` |  |
| `/transfer` | `app/transfer.tsx` |  |
| `/trust-score` | `app/trust-score.tsx` |  |
| `/two-factor` | `app/two-factor.tsx` |  |
| `/user/[username]` | `app/user/[username].tsx` | ya |
| `/user/[username]/questions` | `app/user/[username]/questions.tsx` | ya |
| `/user/[username]/ratings` | `app/user/[username]/ratings.tsx` | ya |
| `/user/[username]/showcase` | `app/user/[username]/showcase.tsx` | ya |
| `/verify-2fa` | `app/(auth)/verify-2fa.tsx` |  |
| `/verify-email` | `app/verify-email.tsx` |  |
| `/verify-otp` | `app/(auth)/verify-otp.tsx` |  |
| `/vouchers` | `app/vouchers.tsx` |  |
| `/wallet` | `app/(tabs)/wallet.tsx` |  |
| `/wallet-transaction/[txId]` | `app/wallet-transaction/[txId].tsx` | ya |
| `/welcome` | `app/welcome.tsx` |  |
| `/withdraw` | `app/withdraw.tsx` |  |
| `/withdraw-history` | `app/withdraw-history.tsx` |  |
| `/withdrawal-schedules` | `app/withdrawal-schedules.tsx` |  |
