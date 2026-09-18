# Alfie

A privacy-first, location-aware AI voice companion for noticing more, following curiosity, and saving meaningful discoveries.

## Repository

```text
apps/mobile/                React Native + Expo + Router mobile app
services/agent/             Node/TypeScript agent service scaffold
services/agent/migrations/  Versioned InsForge schema and authorization changes
docs/                      Decisions and implementation/release guidance
AGENTS.md                  Repository-wide product, privacy, UX, and coding rules
PRODUCT.md                 Product intent and initial boundaries
PRIVACY.md                 Privacy requirements and data-handling plan
ARCHITECTURE.md            Planned system responsibilities and trust boundaries
```

## Status

Mobile preview: home, live-session shell, and session-end/Field Log screens implement Discover and Reimagine with local mock states. Backend health endpoint remains available. Realtime/provider integrations and deployment await approval.

Read [AGENTS.md](AGENTS.md), [PRODUCT.md](PRODUCT.md), [PRIVACY.md](PRIVACY.md), and [ARCHITECTURE.md](ARCHITECTURE.md) before making changes. Cloud setup status is recorded in [docs/setup.md](docs/setup.md).

## Planned stack

- React Native + Expo: mobile client.
- InstaCloud: primary cloud runtime and deployment platform for backend services.
- Higgs Realtime: speech-to-speech sessions, interruptions, and tool calling.
- InsForge: authentication, database, storage, memories, and Field Log records.
- Google Maps / Places: maps and nearby-place context.

## Local development

Use Node 24 (`.nvmrc`) and npm 11. One root `package-lock.json` covers both workspaces.

```sh
npm ci
npm run mobile
# In another terminal, if needed:
npm run agent
```

Quality checks: `npm run lint`, `npm run typecheck`, `npm run format:check`, and `npm run build:agent`.

Mobile source is under `apps/mobile/src`; backend source is under `services/agent/src`. See their READMEs for details and [docs/design.md](docs/design.md) for visual tokens and guidance. No real user data or secrets are needed for the mobile preview.
