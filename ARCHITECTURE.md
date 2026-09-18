# Planned architecture

Status: Expo Router/TypeScript mobile boot screen and a Node/TypeScript backend health endpoint are scaffolded. Product features, provider integrations, schemas, and deployments are not implemented.

| Component            | Responsibility                                                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile`        | Expo/React Native client: accessible interactions, explicit microphone/location permission, capture controls, secure session storage.                      |
| `services/agent`     | Backend on InstaCloud: authenticate requests, authorize and validate agent tools, minimize context, orchestrate provider calls, redact operational events. |
| Higgs Realtime       | Speech-to-speech conversation, interruption handling, and tool requests. Model requests do not bypass server authorization.                                |
| InsForge             | Identity, per-user database/storage access, saved memories, and Field Log persistence.                                                                     |
| Google Maps / Places | Map presentation and place context using constrained credentials and minimal location disclosure.                                                          |

## Intended data flow

The mobile client authenticates through InsForge. The backend verifies the user's identity before creating a voice session or running a tool. Audio transport will use Higgs' supported secure session mechanism; direct client transport is acceptable only with short-lived scoped credentials. Exact SDK support must be verified before implementation.

Permitted foreground location supplies minimal context for Places requests. Tool calls pass through allowlisted backend handlers with schema validation and per-user authorization. User-confirmed discoveries are persisted to InsForge. Mobile data access, if used directly, must have enforced per-user access rules; privileged credentials never enter the app bundle.

## Deployment and persistence boundaries

InstaCloud is the primary backend runtime and deployment platform. InsForge is the intended system of record; do not provision duplicate InstaCloud database/storage services by default. InsForge hosting/connection details remain undecided. Expo's native build/distribution workflow is separate from backend hosting and will be selected later.

Create only the empty `alfie` InstaCloud project during setup. Add compute and connect providers after approval. Keep `.insta/project.json` as shareable project linkage; exclude agent sessions, local audits, and credentials from Git.

## Implementation decisions still to verify

- Higgs native/Expo compatibility, audio transport, ephemeral credentials, and interruption lifecycle.
- InsForge token verification, authorization rules, migration mechanism, and deletion behavior.
- Google API restrictions, attribution, licensing/caching requirements, and location minimization.
- Expo SDK 57 and its template-compatible React Native version are installed; npm workspaces use one root lockfile. Backend targets Node 24. Native provider requirements and CI remain to verify.
- Rate limits, timeouts, idempotent saves, reconnect/offline behavior, and retention controls.
