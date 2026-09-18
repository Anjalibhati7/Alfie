# Alfie

A privacy-first, location-aware AI voice companion for noticing more, following curiosity, and saving meaningful discoveries.

Two modes only: **Discover** (the world leads — observational, sparse prompting, follows your curiosity deeply) and **Reimagine** (you lead — playful, proactive, but never repetitive). Both obey one rule:

> Prompt when stimulation is needed. Follow when curiosity appears. Stay quiet when engaged. Remember what matters.

## What works today

- **Live speech-to-speech voice** through Boson **Higgs Realtime**, proxied by the agent service so the API key never reaches the device.
- **Runs on real mobile.** Native iOS/Android is the primary target and captures audio with `react-native-audio-api`; the web build is a fallback and uses `getUserMedia`. Metro selects one at build time.
- **Visible `Listening` / `Thinking` / `Speaking` state** driven by real provider events, plus barge-in: speaking over Alfie stops playback immediately.
- **Mode-specific behaviour** enforced server-side. `Discover` and `Reimagine` have different instructions, and the client cannot override them.
- **Location providers**: a simulated demo route for indoor demos, and an approximate real-device provider. The current place and the places visited are shown in the session.
- **Save a thought / Field Log**: thoughts, session mode, date, duration, derived discussion themes, and route points are stored on the device and shown in the Field Log, where they can be edited and deleted.

## Repository

```text
apps/mobile/                React Native + Expo + Router mobile app
services/agent/             Node/TypeScript agent service (Higgs Realtime proxy)
services/agent/migrations/  Versioned InsForge schema changes (still unused)
docs/                       Decisions and implementation/release guidance
AGENTS.md                   Repository-wide product, privacy, UX, and coding rules
PRODUCT.md                  Product intent and initial boundaries
PRIVACY.md                  Privacy requirements and data-handling plan
ARCHITECTURE.md             System responsibilities and trust boundaries
```

## Demo: run it in three steps

Use Node 24 (`.nvmrc`). One root `package-lock.json` covers both workspaces.

```sh
npm ci

# 1. Start the agent with the Boson key. The key stays in this shell only.
BOSON_API_KEY=bai-xxxxxxxx npm run agent

# 2. Build and run the app on a device or simulator (the primary target).
#    react-native-audio-api is a native module, so this needs a development
#    build — it does not work in Expo Go.
npx expo run:ios        # or: npx expo run:android
#    Afterwards, `npm run mobile` + `i` / `a` reuses that dev build.

#    Web fallback, no native toolchain needed:
npm run mobile          # then press w

# Optional, before any of the above: prove the key and endpoint work with no
# microphone or speaker involved.
BOSON_API_KEY=bai-xxxxxxxx npm run probe --workspace @alfie/agent
```

On a physical device the app must reach the agent on your machine, so set:

```sh
EXPO_PUBLIC_AGENT_URL=http://<your-lan-ip>:8080 npm run mobile
```

Then:

1. Pick **Discover** or **Reimagine** on the home screen and allow the microphone.
2. Wait for the state to read **Listening**, then talk. Alfie replies out loud; the on-screen state follows the real conversation.
3. Interrupt by talking over Alfie, or press **Interrupt and speak**.
4. Watch **Where you are** change as the demo route walks. Switch between **Demo route** and **This device** at any time.
5. Press **Save a thought or discovery** to keep something, then **End session**. The Field Log shows the completed session with its duration, themes, and route.

For an indoor hackathon demo, leave location on **Demo route**: it walks seven nearby points, one every eight seconds, and labels itself as simulated everywhere it appears.

`npm run build:agent` builds the service; `npm run start --workspace @alfie/agent` runs the built output.

## Deployment

**Nothing has been deployed.** The InstaCloud CLI _is_ reachable from this environment and is correctly linked to the existing `alfie` project, but its agent session has expired, and refreshing it requires human authorization. No other project was created.

Verified from here:

```sh
npx -y insta@latest --agent status --json     # OK — linked to 4e5c15b5-…, branch higgs-realtime
npx -y insta@latest build services/agent      # OK — "verdict: deployable", 4/4 checks
npx -y insta@latest --agent deploy …          # FAILS — "agent session missing, expired, or for another project/environment"
```

### Deploy from your Mac

Run these from the repository root, on the machine where the InstaCloud agent session is valid. `services/agent` is deploy-ready: `insta build` reports `verdict: deployable`, port `8080` from `EXPOSE`, and a 0.1 MB build context.

```sh
# 1. Refresh the agent session (expired sessions need this; it is interactive).
npx -y insta@latest --agent setup

# 2. Confirm you are on the right project before deploying.
npx -y insta@latest --agent status --json
#    expect projectId 4e5c15b5-3a82-4718-b004-4340a219b719, branch higgs-realtime

# 3. Deploy. --websocket is REQUIRED: /realtime is a WebSocket route on both
#    the mobile and web paths.
npx -y insta@latest --agent deploy services/agent --port 8080 --websocket

# 4. Verify readiness. Returns booleans and the model name, never the key.
curl -sS https://<your-instacloud-host>/v1/status
#    expect: {"realtime":{"credentialConfigured":true,"ready":true,...}}

# 5. Verify the WebSocket route through the public deployment.
npx -y wscat -c "wss://<your-instacloud-host>/realtime?mode=Discover"
#    expect first frame: {"type":"alfie.ready",...}
#    A close with "Invalid API key" means the project secret is missing or wrong.
```

`BOSON_API_KEY` must already exist as a project secret — do not add it here, and never paste it into a command line or a file. Its value was not read, printed, or copied at any point. Set `ALLOWED_ORIGINS` to the exact origin the web build is served from; native clients send no `Origin` header and stay allowed.

Finally, point the app at the deployment:

```sh
EXPO_PUBLIC_AGENT_URL=https://<your-instacloud-host> npx expo run:ios
```

A schemeless value (`EXPO_PUBLIC_AGENT_URL=host.instacloud.app`) is accepted and assumed to be HTTPS.

## Privacy posture

- `BOSON_API_KEY` is read only from the server environment. It is never in mobile code, the bundle, Git, or logs. `.env` files are gitignored; `.env.example` is value-free.
- Mobile holds no provider credentials at all. `EXPO_PUBLIC_*` values are public by definition.
- **Raw microphone audio is streamed only.** On native the recorder's file output is explicitly disabled; nothing writes audio to disk and no audio is logged. Capture starts only when the user starts a session, and stops on pause, end, background, or error. The Expo config sets `iosBackgroundMode: false` and `androidForegroundService: false`, so no background audio capability is granted.
- The spoken transcript is shown during the session and is not stored or uploaded.
- Location is foreground-only and session-scoped. No background tracking, no coordinate history, never a raw coordinate on screen. Coordinates are rounded to ~4 decimal places before use.
- Field Log entries live on the device only — a JSON file in the app document directory on native, `localStorage` on web — and can be edited or deleted there. The backend never receives them.

## Honest limitations

- **Native is the primary target and is verified at bundle level, not on a device.** Live voice captures through `react-native-audio-api` on iOS/Android and `getUserMedia` on web, selected by Metro at build time; both bundles were inspected to confirm each contains only its own path. No physical device or simulator was available in this environment, so the native microphone, speaker, and permission prompts have **not** been exercised end to end. Treat the first run on hardware as the real acceptance test.
- **Native live voice requires a development build.** `react-native-audio-api` is a native module, so Expo Go cannot capture audio. The app detects this and reports voice as unavailable rather than crashing.
- **Real-device location is approximate and unnamed.** `expo-location` is not installed, so the real provider reads the platform Geolocation API if present and reports a neutral label. On native it degrades to `denied`/`unavailable` unless the app already holds a grant. It never invents place names.
- **Discussion themes are a word-frequency heuristic**, computed on the device from your own words. They are not an AI summary, and a quiet session produces none.
- **No authentication.** There is no identity layer yet; the agent service has no per-user authorization and no rate limiting. Do not expose it publicly with a live key.
- **No InsForge, no Maps, no cloud persistence, no Nebius, no search or social features.** Those remain unimplemented by design.
- **A live Higgs session has never run.** No `BOSON_API_KEY` was available in this environment, so barge-in and the upstream handshake are implemented against the documented `input_audio_buffer.speech_started` / OpenAI-compatible protocol but are unexercised. Run the probe first.
- A session pauses when the app leaves the foreground, and the timer excludes paused time.

## Other documentation

Read [AGENTS.md](AGENTS.md), [PRODUCT.md](PRODUCT.md), [PRIVACY.md](PRIVACY.md), and [ARCHITECTURE.md](ARCHITECTURE.md) before making changes. Cloud setup status is recorded in [docs/setup.md](docs/setup.md); visual tokens and guidance are in [docs/design.md](docs/design.md).
