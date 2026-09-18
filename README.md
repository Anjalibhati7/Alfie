# Alfie

A privacy-first, location-aware AI voice companion for noticing more, following curiosity, and saving meaningful discoveries.

Two modes only: **Discover** (the world leads — observational, sparse prompting, follows your curiosity deeply) and **Reimagine** (you lead — playful, proactive, but never repetitive). Both obey one rule:

> Prompt when stimulation is needed. Follow when curiosity appears. Stay quiet when engaged. Remember what matters.

## What works today

- **Live speech-to-speech voice** through Boson **Higgs Realtime**, proxied by the agent service so the API key never reaches the device.
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

# 2. In a second terminal, start the mobile app and press w for web.
npm run mobile

# Optional, before any of the above: prove the key and endpoint work with no
# microphone or speaker involved.
BOSON_API_KEY=bai-xxxxxxxx npm run probe --workspace @alfie/agent
```

Then, in the browser:

1. Pick **Discover** or **Reimagine** on the home screen and allow the microphone.
2. Wait for the state to read **Listening**, then talk. Alfie replies out loud; the on-screen state follows the real conversation.
3. Interrupt by talking over Alfie, or press **Interrupt and speak**.
4. Watch **Where you are** change as the demo route walks. Switch between **Demo route** and **This device** at any time.
5. Press **Save a thought or discovery** to keep something, then **End session**. The Field Log shows the completed session with its duration, themes, and route.

For an indoor hackathon demo, leave location on **Demo route**: it walks eight nearby points, one every eight seconds, and labels itself as simulated everywhere it appears.

`npm run build:agent` builds the service; `npm run start --workspace @alfie/agent` runs the built output.

## Deployment

The InstaCloud CLI is **not available in this environment**, so nothing was deployed. The service is prepared for the existing `alfie` project (`.insta/project.json`, project `4e5c15b5-3a82-4718-b004-4340a219b719`).

Locally, from the repository root:

```sh
# 1. Set the secret on the InstaCloud project (never commit it).
insta secrets set BOSON_API_KEY=bai-xxxxxxxx --project 4e5c15b5-3a82-4718-b004-4340a219b719

# 2. Deploy the existing agent service.
insta deploy --agent --project 4e5c15b5-3a82-4718-b004-4340a219b719

# 3. Confirm readiness (returns booleans, never the key).
curl https://<your-instacloud-host>/v1/status
```

Verify the deploy command against your installed CLI version — it could not be executed or validated here. Point the app at the deployed service with `EXPO_PUBLIC_AGENT_URL=https://<your-instacloud-host> npm run mobile`, and set `ALLOWED_ORIGINS` to the exact origin the web build is served from.

## Privacy posture

- `BOSON_API_KEY` is read only from the server environment. It is never in mobile code, the bundle, Git, or logs. `.env` files are gitignored; `.env.example` is value-free.
- Mobile holds no provider credentials at all. `EXPO_PUBLIC_*` values are public by definition.
- Raw microphone audio is streamed only. Nothing writes audio to disk, and no audio is logged. Capture starts only when the user starts a session, and stops on pause, end, background, or error.
- The spoken transcript is shown during the session and is not stored or uploaded.
- Location is foreground-only and session-scoped. No background tracking, no coordinate history, never a raw coordinate on screen. Coordinates are rounded to ~4 decimal places before use.
- Field Log entries live on the device only and can be edited or deleted there. The backend never receives them.

## Honest limitations

- **Live voice is verified on the web target only.** Audio uses the Web Audio API. A native development build needs a native capture/playback implementation; without one the app reports voice as unavailable rather than crashing. This is the single biggest gap for a phone demo.
- **Real-device location is approximate and unnamed.** `expo-location` is not installed, so the real provider reads the platform Geolocation API if present and reports a neutral label. It never invents place names.
- **Discussion themes are a word-frequency heuristic**, computed on the device from your own words. They are not an AI summary, and a quiet session produces none.
- **Field Log persistence uses `localStorage`.** Where the runtime does not provide it, entries last for the current run only and the UI says so instead of pretending to save.
- **No authentication.** There is no identity layer yet; the agent service has no per-user authorization and no rate limiting. Do not expose it publicly with a live key.
- **No InsForge, no Maps, no cloud persistence, no Nebius, no search or social features.** Those remain unimplemented by design.
- **Barge-in was implemented against the documented `input_audio_buffer.speech_started` event** and could not be exercised end to end here, because no `BOSON_API_KEY` was available in this environment. Treat the first live run as the real acceptance test.
- A session pauses when the app leaves the foreground, and the timer excludes paused time.

## Other documentation

Read [AGENTS.md](AGENTS.md), [PRODUCT.md](PRODUCT.md), [PRIVACY.md](PRIVACY.md), and [ARCHITECTURE.md](ARCHITECTURE.md) before making changes. Cloud setup status is recorded in [docs/setup.md](docs/setup.md); visual tokens and guidance are in [docs/design.md](docs/design.md).
