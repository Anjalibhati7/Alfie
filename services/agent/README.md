# Alfie agent service

Node 24 + strict TypeScript service. It owns the Boson credential and proxies the Higgs Realtime event stream, so the mobile app never holds a provider key.

## Endpoints

| Method | Path         | Purpose                                                                   |
| ------ | ------------ | ------------------------------------------------------------------------- |
| `GET`  | `/health`    | Liveness only. Does not imply the voice provider is reachable.            |
| `GET`  | `/v1/status` | Readiness for live voice. Returns booleans, model, and endpoint — no key. |
| `WS`   | `/realtime`  | Live voice session. Query parameter `mode=Discover` or `mode=Reimagine`.  |

Everything else returns `404`. A `/realtime` upgrade is refused with `503` when `BOSON_API_KEY` is missing, and with `403` when `ALLOWED_ORIGINS` is set and the request origin is not in it.

## Configuration

Copy `.env.example` for local use, or inject the same names as InstaCloud secrets.

| Variable               | Required | Default                          | Purpose                                                |
| ---------------------- | -------- | -------------------------------- | ------------------------------------------------------ |
| `BOSON_API_KEY`        | yes      | —                                | Server-side Boson credential. Never leaves the server. |
| `PORT`                 | no       | `8080`                           | Listen port.                                           |
| `BOSON_REALTIME_URL`   | no       | `wss://api.boson.ai/v1/realtime` | Upstream Higgs endpoint.                               |
| `BOSON_REALTIME_MODEL` | no       | `higgs-realtime`                 | Realtime model id.                                     |
| `ALLOWED_ORIGINS`      | no       | empty (any origin)               | Comma-separated browser origins allowed to connect.    |
| `MAX_SESSION_MS`       | no       | `1800000`                        | Hard cap on one session.                               |

## Running

From the repository root:

```sh
npm run agent                 # tsx watch, development
npm run build:agent           # tsc -> services/agent/dist
npm run start --workspace @alfie/agent
```

## Verifying Higgs without a phone

The probe opens a real upstream session, sends one text turn, and reports what came back. It uses no microphone and no speaker, so it separates "is the credential working?" from "is the audio stack working?".

```sh
BOSON_API_KEY=bai-... npm run probe --workspace @alfie/agent
```

Exit code `0` means the speech-to-speech path returned audio. Every event type observed is printed.

## How the proxy works

1. The client opens `WS /realtime?mode=Discover`.
2. This service opens `wss://api.boson.ai/v1/realtime` with `Authorization: Bearer $BOSON_API_KEY`.
3. Session configuration is rewritten on the way through: `model` and `instructions` are server-authoritative, so mode behaviour and safety rules cannot be overridden by the client. Client audio and turn-detection settings are preserved.
4. A custom `alfie.location` frame from the client is converted into a system note in the conversation, so Alfie can react to changing surroundings without being told to speak.
5. Everything else — audio deltas, transcripts, barge-in signals — is relayed untouched.

The server never writes audio or transcripts to disk or logs. The only operational record is a one-line JSON close event with a reason and counters.

## Notes

- Higgs Realtime is OpenAI-Realtime-protocol compatible over WebSocket. `session.created` is only sent after the first `session.update`; do not wait for it before configuring a session.
- Input transcription uses `higgs-stt-3.1` so user speech appears on screen.
- Deployment is not performed automatically. See the root README for the exact InstaCloud command.
