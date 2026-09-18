# Alfie mobile

Expo SDK 57 + React Native + strict TypeScript + Expo Router. Only a minimal boot route exists; it makes no network, microphone, or location requests.

From the repository root, run `npm ci`, then `npm run mobile`. Press `i` or `a` for a configured iOS simulator or Android emulator, or `w` for web. SDK-compatible Expo Go or native development builds are required for device testing; future voice integrations may require a development build.

- `src/app`: Router routes and root layout.
- `src/components`: shared presentation primitives.
- `src/design`: palette, semantic colors, spacing, typography, radius, and border tokens.
- `src/hooks`: platform preference hooks.
- `src/services`: future typed network boundaries.
- `src/accessibility`: shared accessibility utilities.

Run `npm run lint` and `npm run typecheck` at the repository root. See root `AGENTS.md` and `docs/design.md` before UI work. No product screens or provider integrations are included.
