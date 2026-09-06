# Kahade UI refresh — draft implementation

## Direction

A restrained monochrome product with a small blue interaction accent: generous spacing, clear sans-serif hierarchy, quiet surfaces, and obvious actions. The reference brief names Mobbin, AppLlama and Grok; this implementation uses those general qualities rather than copying assets or a particular screen.

## What changed

- Shared tokens: 8pt primary layout rhythm (16/24/32/48/64), 14pt minimum text, 16pt body, sans-serif display, 8pt controls and 12pt surfaces. Existing 4/12/20pt utility steps remain available for compatibility and micro-layouts.
- Light/dark tokens, AA contrast checks, a blue focus/selection accent and stable bundled fonts. Brand assets and native build dependencies are unchanged.
- Buttons: 48/56pt targets, deliberate primary/secondary hierarchy, stable loading width, keyboard focus and reduced-motion-safe press feedback.
- Inputs: persistent labels, a consistent control height, stable focus border padding, actual 44pt accessory buttons, and existing password/clear/error behaviors.
- Cards, sections and statistics: more whitespace and wrapping labels. The shared primitives propagate these changes throughout existing consumers.
- Navigation: labeled active tabs with an accent surface, adaptive narrow labels, preserved tab events and a quieter header.
- Home: available balance and create-transaction action precede secondary activity and shortcuts. All shortcut destinations and independent API error/retry paths remain.
- Login: a clearer heading, persistent labels, nearby password recovery, inline errors before the submit action, no automatic keyboard opening. Login/2FA/session logic remains unchanged.
- Wallet: both available and held amounts can be hidden. Uncontrolled visibility is memory-only; existing controlled visibility props remain supported.

## Boundaries

No API contract, payment calculation, authorization guard, production data, dependency, native configuration or release channel was changed. No merge, deployment or OTA release was requested or performed.

This is a shared-system and key-screen redesign, not a claim that every route has been individually redesigned or visually approved. Increasing the type scale and surface padding affects many screens; every workflow still needs the checks below before merging.

## Validation

Locally completed: TS/TSX syntax transformation, 52 foreground/background contrast checks, CSS-variable parity, typography floor, and primary spacing assertions. A static token-driven design review is separate from a running Expo build and cannot validate native rendering.

Added tests: `tests/design-system.test.ts` and `tests/e2e/design-refresh.spec.ts` (wallet visibility, tab navigation, 320/390/1280px overview layouts in both themes). The existing full-route regression suite remains intact.

The local environment cannot download/install Expo dependencies. Therefore the full TypeScript build, ESLint, existing unit suite, Playwright app tests and iOS/Android runtime tests are **not marked passed locally**. Run the repository CI and complete the device checks before merging.

### Merge checklist

- [ ] `npm ci` and `npm run check` pass on the entire repository.
- [ ] `npm run test:e2e` passes against the production web export with mocked APIs.
- [ ] Visually inspect every route, plus empty/error/loading, open sheets, dialogs and search states in both themes.
- [ ] Check 320px, 390px and desktop web, plus iOS/Android safe areas and 200% text scaling.
- [ ] Check keyboard avoidance, focus visibility, screen-reader order and reduced motion on real devices.
- [ ] Exercise login/2FA/recovery and transaction/wallet flows in a non-production test environment.
