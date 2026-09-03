# Kahade API — Index Endpoint User-Facing (220 endpoint)

Sumber lengkap (request/response schema penuh): kahade-api-mobile.json

## users (55)
- `DELETE` `/v1/users/comments/{commentId}` — Delete a comment
- `DELETE` `/v1/users/me/avatar` — 
- `DELETE` `/v1/users/me/devices/{deviceId}` — Remove/forget a device
- `DELETE` `/v1/users/me/header` — Delete header image
- `DELETE` `/v1/users/me/showcase/{id}` — Delete a showcase item
- `DELETE` `/v1/users/questions/{questionId}` — Delete a question
- `DELETE` `/v1/users/{userId}/block` — Unblock a user
- `DELETE` `/v1/users/{username}/favorite` — Remove user from favorites
- `DELETE` `/v1/users/{username}/follow` — Unfollow a user
- `GET   ` `/v1/users/availability` — 
- `GET   ` `/v1/users/discover` — Search & discover users with filters
- `GET   ` `/v1/users/favorites` — List favorite users
- `GET   ` `/v1/users/me` — 
- `GET   ` `/v1/users/me/activity-log` — View own activity log
- `GET   ` `/v1/users/me/analytics` — Get user analytics dashboard data
- `GET   ` `/v1/users/me/blocked` — List blocked users
- `GET   ` `/v1/users/me/dashboard` — Get dashboard statistics
- `GET   ` `/v1/users/me/devices` — List logged-in devices
- `GET   ` `/v1/users/me/links` — Get my social links
- `GET   ` `/v1/users/me/questions` — Get my received or asked questions
- `GET   ` `/v1/users/me/security-log` — View security-related activity log
- `GET   ` `/v1/users/me/showcase` — Get my showcase items (including inactive)
- `GET   ` `/v1/users/me/stats` — 
- `GET   ` `/v1/users/me/trust-score` — Get user trust score and badge
- `GET   ` `/v1/users/questions/{questionId}/comments` — Get comments for a Q&A thread
- `GET   ` `/v1/users/search` — 
- `GET   ` `/v1/users/{username}` — 
- `GET   ` `/v1/users/{username}/favorite` — Check if a user is in favorites
- `GET   ` `/v1/users/{username}/followers` — List followers of a user
- `GET   ` `/v1/users/{username}/following` — List users followed by a user
- `GET   ` `/v1/users/{username}/og` — Get OG metadata for user profile
- `GET   ` `/v1/users/{username}/questions` — Get public Q&A for a profile
- `GET   ` `/v1/users/{username}/ratings` — 
- `GET   ` `/v1/users/{username}/showcase` — Get public showcase items for a user
- `PATCH ` `/v1/users/me/devices/{deviceId}/trust` — Mark a device as trusted (skip 2FA)
- `PATCH ` `/v1/users/me/devices/{deviceId}/untrust` — Remove trust from a device
- `POST  ` `/v1/users/me/avatar/confirm` — 
- `POST  ` `/v1/users/me/avatar/direct` — Upload avatar directly through the server (bypasses CORS)
- `POST  ` `/v1/users/me/delete-request` — 
- `POST  ` `/v1/users/me/header/confirm` — Confirm header image upload
- `POST  ` `/v1/users/me/header/direct` — Upload header image directly through the server (bypasses CORS)
- `POST  ` `/v1/users/me/showcase` — Add a showcase item
- `POST  ` `/v1/users/me/showcase/upload` — Upload showcase item image directly
- `POST  ` `/v1/users/questions/{questionId}/comments` — Add a comment to a Q&A thread
- `POST  ` `/v1/users/{userId}/block` — Block a user
- `POST  ` `/v1/users/{userId}/report` — Report a user
- `POST  ` `/v1/users/{username}/favorite` — Add user to favorites
- `POST  ` `/v1/users/{username}/follow` — Follow a user
- `POST  ` `/v1/users/{username}/questions` — Ask a question on user profile
- `PUT   ` `/v1/users/me` — 
- `PUT   ` `/v1/users/me/avatar` — 
- `PUT   ` `/v1/users/me/header` — Get presigned URL for header image upload
- `PUT   ` `/v1/users/me/links` — Update social links (replaces all)
- `PUT   ` `/v1/users/me/showcase/{id}` — Update a showcase item
- `PUT   ` `/v1/users/questions/{questionId}/answer` — Answer a profile question

## orders (31)
- `GET   ` `/v1/orders` — 
- `GET   ` `/v1/orders/average-durations` — Get average duration per status transition from completed orders
- `GET   ` `/v1/orders/links/my` — Get my order links
- `GET   ` `/v1/orders/links/{token}` — Get order link details by token
- `GET   ` `/v1/orders/summary` — 
- `GET   ` `/v1/orders/{orderId}` — 
- `GET   ` `/v1/orders/{orderId}/delivery-proof` — Get delivery proofs for an order
- `GET   ` `/v1/orders/{orderId}/extensions` — 
- `GET   ` `/v1/orders/{orderId}/history` — 
- `GET   ` `/v1/orders/{orderId}/invoice` — Get invoice data for an order
- `GET   ` `/v1/orders/{orderId}/payment-status` — 
- `GET   ` `/v1/orders/{orderId}/receipt` — Get printable receipt HTML for completed order
- `POST  ` `/v1/orders` — 
- `POST  ` `/v1/orders/calculate-fee` — 
- `POST  ` `/v1/orders/links` — Create an order link (Order via Link)
- `POST  ` `/v1/orders/links/{token}/accept` — Accept an order link
- `POST  ` `/v1/orders/links/{token}/cancel` — Cancel an order link
- `POST  ` `/v1/orders/validate-counterpart` — 
- `POST  ` `/v1/orders/{orderId}/cancel` — 
- `POST  ` `/v1/orders/{orderId}/complete` — 
- `POST  ` `/v1/orders/{orderId}/confirm` — 
- `POST  ` `/v1/orders/{orderId}/delivery-proof` — Submit delivery proof
- `POST  ` `/v1/orders/{orderId}/delivery-proof/confirm` — Confirm delivery (buyer)
- `POST  ` `/v1/orders/{orderId}/delivery-proof/reject` — Reject delivery proof (buyer)
- `POST  ` `/v1/orders/{orderId}/dispute` — 
- `POST  ` `/v1/orders/{orderId}/extensions` — 
- `POST  ` `/v1/orders/{orderId}/pay` — 
- `POST  ` `/v1/orders/{orderId}/pay-qris` — 
- `POST  ` `/v1/orders/{orderId}/process` — 
- `PUT   ` `/v1/orders/{orderId}/extensions/{extensionId}` — 
- `PUT   ` `/v1/orders/{orderId}/shipping` — 

## auth (26)
- `GET   ` `/v1/auth/2fa/status` — 
- `GET   ` `/v1/auth/csrf-token` — 
- `GET   ` `/v1/auth/otp-methods` — 
- `GET   ` `/v1/auth/verify-email` — 
- `POST  ` `/v1/auth/2fa/backup-codes/regenerate` — 
- `POST  ` `/v1/auth/2fa/disable` — 
- `POST  ` `/v1/auth/2fa/enable` — 
- `POST  ` `/v1/auth/2fa/request-disable-otp` — 
- `POST  ` `/v1/auth/2fa/setup` — 
- `POST  ` `/v1/auth/2fa/verify-login` — 
- `POST  ` `/v1/auth/captcha/generate` — 
- `POST  ` `/v1/auth/change-password` — 
- `POST  ` `/v1/auth/correct-email` — 
- `POST  ` `/v1/auth/forgot-password` — 
- `POST  ` `/v1/auth/login` — 
- `POST  ` `/v1/auth/logout` — 
- `POST  ` `/v1/auth/phone-register` — 
- `POST  ` `/v1/auth/refresh` — 
- `POST  ` `/v1/auth/register` — 
- `POST  ` `/v1/auth/request-otp` — 
- `POST  ` `/v1/auth/resend-verification` — 
- `POST  ` `/v1/auth/reset-password` — 
- `POST  ` `/v1/auth/set-username` — 
- `POST  ` `/v1/auth/verify-email` — 
- `POST  ` `/v1/auth/verify-otp` — 
- `POST  ` `/v1/auth/verify-password` — 

## wallet (19)
- `GET   ` `/v1/wallet` — 
- `GET   ` `/v1/wallet/export` — Export wallet transactions as CSV or XLSX
- `GET   ` `/v1/wallet/export/csv` — Export wallet transactions as CSV
- `GET   ` `/v1/wallet/export/pdf` — Export wallet transactions as printable HTML report
- `GET   ` `/v1/wallet/payment-methods` — List available payment methods with fees
- `GET   ` `/v1/wallet/topup-history` — Get topup transaction history
- `GET   ` `/v1/wallet/topup-status/{paymentTxId}` — Poll the status of a previously initiated top-up
- `GET   ` `/v1/wallet/transactions` — 
- `GET   ` `/v1/wallet/transactions/{txId}` — 
- `GET   ` `/v1/wallet/transfer/lookup` — Lookup a user for transfer by username or userId
- `GET   ` `/v1/wallet/withdraw-history` — Get withdrawal transaction history
- `POST  ` `/v1/wallet/set-pin` — Set or change wallet PIN
- `POST  ` `/v1/wallet/topup` — 
- `POST  ` `/v1/wallet/transfer` — Transfer funds to another KYC-verified user
- `POST  ` `/v1/wallet/verify-pin` — Verify wallet PIN
- `POST  ` `/v1/wallet/withdraw` — 
- `POST  ` `/v1/wallet/withdraw/cancel` — Cancel a pending withdrawal (PENDING_OTP only)
- `POST  ` `/v1/wallet/withdraw/confirm-otp` — 
- `POST  ` `/v1/wallet/withdraw/resend-otp` — Resend OTP for pending withdrawal (60s cooldown)

## disputes (17)
- `DELETE` `/v1/disputes/{disputeId}/evidence/{evidenceId}` — Delete own dispute evidence
- `DELETE` `/v1/disputes/{disputeId}/mutual-resolution/{proposalId}` — Withdraw own pending proposal
- `GET   ` `/v1/disputes/my` — List my disputes
- `GET   ` `/v1/disputes/{disputeId}` — Get dispute detail
- `GET   ` `/v1/disputes/{disputeId}/calls` — Get call history for a dispute
- `GET   ` `/v1/disputes/{disputeId}/evidence` — List dispute evidence with pagination
- `GET   ` `/v1/disputes/{disputeId}/messages` — Get dispute messages
- `GET   ` `/v1/disputes/{disputeId}/mutual-resolution` — Get mutual resolution proposals
- `POST  ` `/v1/disputes/{disputeId}/call/accept` — Accept a video call request
- `POST  ` `/v1/disputes/{disputeId}/call/end` — End an active video call
- `POST  ` `/v1/disputes/{disputeId}/call/reject` — Reject a video call request
- `POST  ` `/v1/disputes/{disputeId}/call/request` — Request a video call in a dispute
- `POST  ` `/v1/disputes/{disputeId}/claim` — Submit or update claim text
- `POST  ` `/v1/disputes/{disputeId}/evidence` — Submit dispute evidence (batch, per-file validation)
- `POST  ` `/v1/disputes/{disputeId}/messages` — Send a dispute message
- `POST  ` `/v1/disputes/{disputeId}/mutual-resolution` — Propose a mutual resolution
- `POST  ` `/v1/disputes/{disputeId}/mutual-resolution/{proposalId}/respond` — Accept or reject a mutual resolution proposal

## notifications (13)
- `DELETE` `/v1/notifications/{notifId}` — Delete a notification
- `GET   ` `/v1/notifications` — 
- `GET   ` `/v1/notifications/preferences` — 
- `GET   ` `/v1/notifications/unread-count` — 
- `GET   ` `/v1/notifications/{notifId}` — 
- `POST  ` `/v1/notifications/delete-batch` — Delete multiple notifications by IDs
- `POST  ` `/v1/notifications/delete-read` — Soft-delete all read notifications owned by the current user
- `POST  ` `/v1/notifications/read-all` — 
- `POST  ` `/v1/notifications/read-batch` — Mark multiple notifications as read by IDs
- `POST  ` `/v1/notifications/register-device` — Register push notification token
- `POST  ` `/v1/notifications/unregister-device` — Unregister push notification token
- `POST  ` `/v1/notifications/{notifId}/read` — 
- `PUT   ` `/v1/notifications/preferences` — 

## settings (10)
- `DELETE` `/v1/settings/block/{userId}` — 
- `GET   ` `/v1/settings/blocked-users` — 
- `GET   ` `/v1/settings/language` — Get language preference
- `GET   ` `/v1/settings/privacy` — Get privacy settings
- `GET   ` `/v1/settings/reports` — 
- `POST  ` `/v1/settings/block/{userId}` — 
- `POST  ` `/v1/settings/privacy/export` — Request personal data export
- `POST  ` `/v1/settings/report` — 
- `PUT   ` `/v1/settings/language` — Update language preference
- `PUT   ` `/v1/settings/privacy` — Update privacy settings

## chat (7)
- `DELETE` `/v1/chat/rooms/{roomId}/messages/{messageId}` — Delete own message in a chat room
- `GET   ` `/v1/chat/rooms` — List chat rooms for current user
- `GET   ` `/v1/chat/rooms/{roomId}/attachments` — List room attachments
- `GET   ` `/v1/chat/rooms/{roomId}/messages` — Get messages in a chat room (cursor-based pagination)
- `POST  ` `/v1/chat/rooms/{roomId}/messages` — Send a message in a chat room
- `POST  ` `/v1/chat/rooms/{roomId}/read` — Mark messages as read in a chat room
- `POST  ` `/v1/chat/rooms/{roomId}/upload` — Upload a file attachment to a chat room

## subscriptions (7)
- `GET   ` `/v1/subscriptions/benefits` — 
- `GET   ` `/v1/subscriptions/history` — 
- `GET   ` `/v1/subscriptions/plans` — 
- `GET   ` `/v1/subscriptions/status` — 
- `POST  ` `/v1/subscriptions/cancel` — 
- `POST  ` `/v1/subscriptions/renew` — 
- `POST  ` `/v1/subscriptions/subscribe` — 

## referral (6)
- `GET   ` `/v1/referral/history` — 
- `GET   ` `/v1/referral/my-code` — 
- `GET   ` `/v1/referral/rewards` — 
- `GET   ` `/v1/referral/stats` — 
- `POST  ` `/v1/referral/apply` — 
- `POST  ` `/v1/referral/regenerate` — 

## ratings (6)
- `DELETE` `/v1/ratings/replies/{replyId}` — Delete a reply
- `GET   ` `/v1/ratings/my` — 
- `POST  ` `/v1/ratings` — 
- `POST  ` `/v1/ratings/{ratingId}/reply` — Reply to a rating
- `PUT   ` `/v1/ratings/replies/{replyId}` — Update a reply
- `PUT   ` `/v1/ratings/{ratingId}` — 

## public (6)
- `GET   ` `/v1/public/app-version` — Get minimum and latest app version for force-update
- `GET   ` `/v1/public/banks` — List supported bank codes
- `GET   ` `/v1/public/config` — Get public system configurations
- `GET   ` `/v1/public/exchange-rates` — Get current exchange rates
- `GET   ` `/v1/public/fee-schedule` — Get current fee schedule
- `GET   ` `/v1/public/subscription-plans` — List subscription plans and pricing

## DeepLinks (5)
- `GET   ` `/v1/deeplinks/notification/{notificationId}` — 
- `GET   ` `/v1/deeplinks/order-link/{token}` — 
- `GET   ` `/v1/deeplinks/order/{orderId}` — 
- `GET   ` `/v1/deeplinks/profile/{username}` — 
- `GET   ` `/v1/deeplinks/user/{username}` — 

## transaction-templates (5)
- `DELETE` `/v1/transaction-templates/{id}` — 
- `GET   ` `/v1/transaction-templates` — 
- `GET   ` `/v1/transaction-templates/{id}` — 
- `POST  ` `/v1/transaction-templates` — 
- `PUT   ` `/v1/transaction-templates/{id}` — 

## kyc (4)
- `GET   ` `/v1/kyc/history` — List all KYC requests (paginated)
- `GET   ` `/v1/kyc/status` — Get current KYC status
- `POST  ` `/v1/kyc/resubmit` — Resubmit KYC after rejection (gunakan fileKey dari /upload/confirm)
- `POST  ` `/v1/kyc/submit` — Submit KYC request (gunakan fileKey dari /upload/confirm)

## upload (4)
- `POST  ` `/v1/upload/cleanup` — Delete previously uploaded files (rollback partial uploads)
- `POST  ` `/v1/upload/confirm` — Confirm file upload was completed
- `POST  ` `/v1/upload/direct` — Upload file directly through the server (bypasses CORS)
- `POST  ` `/v1/upload/presigned-url` — Generate pre-signed upload URL

## bank-accounts (4)
- `DELETE` `/v1/bank-accounts/{id}` — 
- `GET   ` `/v1/bank-accounts` — 
- `POST  ` `/v1/bank-accounts` — 
- `POST  ` `/v1/bank-accounts/{id}/set-primary` — 

## withdrawals (4)
- `DELETE` `/v1/withdrawals/schedules/{scheduleId}` — Deactivate a scheduled withdrawal
- `GET   ` `/v1/withdrawals/schedules` — Get my scheduled withdrawals
- `POST  ` `/v1/withdrawals/schedules` — Create a scheduled withdrawal
- `PUT   ` `/v1/withdrawals/schedules/{scheduleId}` — Update a scheduled withdrawal

## help-center (4)
- `GET   ` `/v1/help-center/categories` — 
- `GET   ` `/v1/help-center/categories/{slug}` — 
- `GET   ` `/v1/help-center/search` — 
- `POST  ` `/v1/help-center/items/{id}/view` — 

## support (4)
- `GET   ` `/v1/support/tickets` — List my support tickets
- `GET   ` `/v1/support/tickets/{ticketId}` — Get ticket detail
- `POST  ` `/v1/support/tickets` — Create a support ticket
- `POST  ` `/v1/support/tickets/{ticketId}/reply` — Reply to a ticket

## sessions (3)
- `DELETE` `/v1/sessions/others` — 
- `DELETE` `/v1/sessions/{sessionId}` — 
- `GET   ` `/v1/sessions` — 

## vouchers (3)
- `GET   ` `/v1/vouchers/available` — 
- `GET   ` `/v1/vouchers/my-usage` — 
- `POST  ` `/v1/vouchers/validate` — 

## Health (3)
- `GET   ` `/v1/health` — 
- `GET   ` `/v1/health/crons` — 
- `GET   ` `/v1/health/webhooks` — 

## badges (2)
- `GET   ` `/v1/badges` — List all available badges
- `GET   ` `/v1/badges/my` — List current user earned badges (paginated)

## Search (2)
- `GET   ` `/v1/search` — Global search across users, orders, and transactions
- `GET   ` `/v1/search/suggestions` — Get search autocomplete suggestions

## payments (1)
- `POST  ` `/v1/payments/midtrans-webhook` — 

## config (1)
- `GET   ` `/v1/config/exchange-rates` — Get current exchange rates

## app (1)
- `GET   ` `/v1/app/version` — Get minimum and latest app version for force-update
