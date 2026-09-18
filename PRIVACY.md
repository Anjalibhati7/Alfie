# Privacy design requirements

This is an engineering plan, not a published privacy notice or a claim about implemented controls.

| Data                        | Intended handling                                                                                                                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Microphone audio            | Capture only during an explicitly started session; stream only as necessary for Higgs conversation; no Alfie raw-audio retention by default.                                                                   |
| Conversation text           | Ephemeral by default; do not persist full transcripts or include them in logs.                                                                                                                                 |
| Location                    | Request access just-in-time; precise location only during active exploration unless explicitly required and consented to; use coarse location when adequate; never create passive/background location history. |
| Memories and Field Log      | Store intentionally saved data in InsForge under per-user authorization; allow review, correction, export, and deletion.                                                                                       |
| Identity and session tokens | Use InsForge auth; store device credentials in platform secure storage; validate backend identity and scope.                                                                                                   |
| Operational telemetry       | Collect only necessary, redacted technical events; exclude content, precise location, and credentials.                                                                                                         |

## Consent and control

Explain what is collected, why, and which provider receives it before enabling the relevant capability. Request permissions just-in-time rather than bundling them into onboarding. Separate microphone, location, saving, and optional telemetry choices. Provide permission-denied alternatives and immediate stop/mute controls. Revocation must stop further collection; deletion must cover related records and objects.

## Trust boundaries

Higgs receives session audio and only the context necessary for conversation. Google receives the minimum location/search context needed for place queries. InsForge holds identity and explicitly persisted user content. InstaCloud runs backend orchestration. Send no complete memory history to a provider when a minimal excerpt suffices.

Privileged keys remain server-side. Apply least privilege, per-user data isolation, encrypted transport, secure token handling, and redacted logs. Never use real personal data in preview environments.

## Required before real-user testing

Verify provider retention, training use, deletion, regions, and contractual controls rather than assuming they match Alfie's defaults. Define concrete retention periods, account/data deletion behavior (including backups and provider limits), export format, and incident response ownership. Document subprocessors and publish an accurate user-facing notice. Validate permission revocation, cross-user isolation, and deletion end to end.
