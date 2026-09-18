# Realtime

Implemented. `session.ts` is the Higgs Realtime adapter: it opens
`wss://api.boson.ai/v1/realtime` with the server-side `BOSON_API_KEY`, relays the
OpenAI-compatible event stream in both directions, and rewrites only session
configuration (server-authoritative model and mode instructions) and location
frames.

`prompt.ts` holds the Discover and Reimagine behaviour and the shared
conversational principle. `probe.ts` is a microphone-free smoke test.

No raw audio or transcript is stored, logged, or retained.
