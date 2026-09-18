# Setup status

- Initial inspection: project directory was empty; no existing application or repository instructions.
- InstaCloud skill available at `/Users/anjalibhati/.agents/skills/insta/SKILL.md`.
- Git initialized with `main` as the initial branch.
- Foundation milestone now includes an Expo SDK 57/Router/TypeScript boot app and a Node 24/TypeScript backend health endpoint.
- InstaCloud production project `alfie` created and linked on branch `main`.
  Project ID: `4e5c15b5-3a82-4718-b004-4340a219b719`.
- `npx -y insta@latest --agent services list --json` returned `[]`: no services provisioned. No application deployed.
- CLI verified through `npx` (version fetched during setup: `0.1.0`). Global installation was unavailable because the npm prefix is system-owned; use `npx -y insta@latest --agent ...` for now.
- Agent setup completed and generated repository credential-audit hooks. Restart the coding tool to load newly registered MCP integration; CLI access already works.
- `.insta/project.json` is shareable project linkage. Agent session, local audit/hook runtime, generated skills, and `.env` files are Git-ignored; verified with `git check-ignore`.

To inspect the empty project:

```sh
npx -y insta@latest --agent status --json
npx -y insta@latest --agent services list --json
```

Agent sessions expire after 24 hours. Refresh with `npx -y insta@latest --agent setup agent` from this linked repository when needed. Do not add services or deploy until implementation is approved.

## Foundation verification

- npm workspaces and one root lockfile cover mobile and agent packages.
- Workspace lint, strict type checks, formatting checks, and backend compilation passed.
- Expo dependency compatibility check passed; web, Android, and iOS bundle exports passed.
- Exported web app rendered the Alfie heading and boot text in the browser accessibility tree.
- Local backend smoke check passed for GET /health (200), unknown routes (404), and unsupported POST /health (404).
- Native device/simulator execution and VoiceOver/TalkBack testing have not been performed. Bundle export does not establish native runtime or accessibility compliance.
- No GitHub or other Git remote is configured. The initial foundation commit is local on `chore/foundation`.

## Known dependency warnings

npm audit reports 13 moderate findings in the Expo dependency tree, originating in `uuid` via Xcode tooling and `decode-uri-component` via Router's query-string dependency. No high or critical findings were reported. Suggested automatic fixes downgrade Expo/Router incompatibly; none were applied. Reassess supported upstream fixes before release.

ESLint 9 is deprecated upstream but retained for the Expo lint configuration's current compatibility range. npm also reports unapproved optional/native install scripts (esbuild, fsevents, unrs-resolver); no broad script approval was added. The documented compilation/lint checks succeeded with this environment's installed platform packages.

An initial optional worklets/reanimated peer mismatch was resolved by declaring Expo-compatible versions in the mobile workspace. No provider integrations, product screens, cloud services, or deployments were added. Further implementation awaits approval.

## Two-mode mobile preview milestone

Product guidance now defines only Discover and Reimagine, with shared interruptibility, pauses, user-led curiosity, and optional location. Home, live-session shell, and Field Log are implemented with explicitly labeled local mock states. Notes are in-memory and editable/deletable; no provider calls or permissions were added.

Verification: workspace lint/type checks and iOS/Android/web exports passed. Browser walkthrough verified both modes, simulated voice changes, interruption, pause/resume, optional map expansion, saving a thought, ending a session, editing an entry, and canceling deletion. A 390×844 viewport review verified the quiet session layout and scrollable home layout. Timer stayed fixed while paused. Native screen-reader/device checks remain outstanding; accessibility compliance is not yet certified.

Shared controls have 48-unit minimum targets, semantic roles/states, visible keyboard focus, and text equivalents. Text scales, layouts wrap/scroll, and no animations run. Status announcements use polite live regions on web/Android and the native announcement API on iOS. Actual assistive-technology behavior still needs device verification. Realtime, Maps, backend data, and deployment await approval.
