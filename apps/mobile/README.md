# Alfie mobile

Expo SDK 57 + React Native + strict TypeScript + Expo Router. Routes: home (`/`), live-session shell (`/session`), and session-end/Field Log (`/field-log`). Discover and Reimagine are the only modes. All voice states are manually simulated; no network, microphone, or location requests run.

From the repository root, run `npm ci`, then `npm run mobile`. Press `i` or `a` for a configured iOS simulator or Android emulator, or `w` for web. SDK-compatible Expo Go or native development builds are required for device testing; future voice integrations may require a development build.

- `src/app`: Router routes and root layout.
- `src/components`: shared presentation primitives.
- `src/design`: palette, semantic colors, spacing, typography, radius, and border tokens.
- `src/hooks`: platform preference hooks.
- `src/services`: future typed network boundaries.
- `src/accessibility`: shared accessibility utilities.

Run `npm run lint` and `npm run typecheck` at the repository root. See root `AGENTS.md` and `docs/design.md` before UI work. Provider integrations are not included. Notes are held only in React state until reload/restart; saving, editing, and deleting are local preview interactions. A session pauses when the native app backgrounds. The timer excludes paused time. Preview controls expose listening, thinking, and speaking without pretending to capture audio.
