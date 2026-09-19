# Permission & capability matrix

This matrix is the release contract for native permissions. A capability must
have a real frontend entry point before its native plugin/permission is added.
Permission prompts remain lazy and must happen immediately before the action.

| Capability | Current frontend entry point | Native configuration | Decision |
| --- | --- | --- | --- |
| Camera/photos | `lib/image-picker.ts` for KYC, avatar, evidence, and uploads | `expo-image-picker` | Keep. Ask only from the picker action. |
| Biometric | `lib/biometrics.ts`, `app/biometric-settings.tsx` | `expo-local-authentication` | Keep. Never treat hardware availability as authentication success. |
| Push notifications | `lib/push-notifications.ts`, `lib/web-push.web.ts` | `expo-notifications` | Keep. Ask after user intent/onboarding, not at boot. |
| File export/share | `lib/export-file.ts`, `lib/share.ts` | `expo-file-system`, `expo-sharing` | Keep. Export only user-requested files. |
| Microphone/audio | No active screen imports `expo-audio`, WebRTC, or an audio recorder | Removed from `app.json` and dependencies | Do not ship microphone permission until voice/video transport and consent UI exist. |
| Contacts | No active screen imports `expo-contacts` | Removed | Do not request contacts; add an explicit invite flow first. |
| Location | No active screen imports `expo-location` | Removed, including iOS location copy | Do not request location until COD/location verification is implemented and disclosed. |
| Media library | No active screen imports `expo-media-library` | Removed; picker remains for selecting media | Do not request broad library access for an upload-only action. |
| WebRTC camera/microphone | Dispute call UI is metadata/action-only; transport is not implemented | Removed WebRTC plugin/dependency | Keep call actions visibly unavailable until the transport is real. |
| Tracking/ATT | No tracking SDK or ATT flow is present | Removed `NSUserTrackingUsageDescription` | Do not show a tracking consent prompt without a disclosed tracking purpose. |
| Background location | No use | Disabled/removed | Keep disabled. |

## Release checks

- `app.json` must not reintroduce a plugin without a corresponding source entry
  and user-facing consent/recovery path.
- A denied permission must leave the user with a useful fallback, not a
  dead-end or a prompt loop.
- Permission copy must name the immediate purpose and avoid broad claims.
- Physical-device tests must cover allow, deny, restricted, and revoked states.
- Push/APNs/FCM credentials are separate release blockers; this document does
  not claim production push delivery.
