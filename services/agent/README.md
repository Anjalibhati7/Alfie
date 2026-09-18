# Alfie agent service

Node 24 + strict TypeScript scaffold for future InstaCloud hosting. The only implemented endpoint is `GET /health`, returning service liveness (not provider readiness). All other paths/methods return 404. No credentials or external services are used.

From the repository root:

```sh
npm run agent
npm run build:agent
npm run start --workspace @alfie/agent
```

Development and production both use `PORT` (default 8080) and listen on `0.0.0.0`. Do not run both on the same port. SIGINT/SIGTERM close the server with a bounded shutdown.

Documentation-only boundaries under `src/`: realtime voice, tools, session state, safety, memory, and location. Higgs is not implemented. InsForge remains the future identity and persistence system. Version future schema/authorization migrations in `migrations/` after verifying the provider workflow. Runtime deployment configuration and cloud services await approval.
