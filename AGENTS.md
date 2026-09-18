# Alfie project instructions

These instructions apply to the entire repository and all future human and agent work.

## Scope and product principles

- Alfie is a privacy-first, location-aware AI voice companion that helps people leave autopilot, notice their surroundings, follow curiosity, and save meaningful discoveries.
- Support real-world attention and agency. Prefer short, timely, optional interactions over engagement loops, streak pressure, or constant prompting.
- Be honest about uncertainty, place freshness, AI limitations, and connection state. Never invent location facts or imply the assistant is human.
- Respect physical safety: avoid distracting users while crossing roads or driving; never encourage trespassing or unsafe exploration.
- Current milestone permits Expo/TypeScript/Router scaffolding, a minimal boot screen, a backend foundation, checks, and the first commit. Do not build product screens, integrate Higgs, provision cloud services, or deploy without further approval.
- Core modes are Notice, Curious, Explore, Create, and Unwind. Alfie is not a fitness app, tourism app, walking tracker, or generic prompt generator.
- Voice is primary during active exploration; screens support rather than compete for attention. The companion should prompt thoughtfully, follow tangents, stay quiet, recover from interruption, and gently redirect when appropriate.

## Visual direction

- Editorial, structured, and precise: typography, thin rules, grids, whitespace, and restrained linework inspired by https://bespokelabs.ai. Never copy their branding or layouts literally.
- Porcelain `#F0F4EF` and Ink Black `#0D1821` dominate. Yale Blue `#344966` supports secondary text/structure; Powder Blue `#B4CDED` supports subtle surfaces. Terracotta `#A24C3F` is accent-only for primary actions, active states, and important highlights.
- No generic AI gradients, glowing orbs, glassmorphism, green, mustard, or wellness-app styling. Use strong editorial type, thin dividers, intentional whitespace, and restrained icons.
- Active-session UI must be significantly quieter than home and Field Log screens. Use shared tokens and verify contrast for actual foreground/background pairs.

## Privacy and security requirements

- Request permissions just-in-time, not all during onboarding. Precise location is limited to active exploration unless an explicit requirement and informed user consent justify otherwise; never create passive/background location history.
- Collect the minimum data needed for an explicitly requested action. Microphone and foreground location require contextual, informed permission; denied permissions must have useful fallbacks.
- No background listening, continuous location history, or raw audio/transcript persistence by default. Start and stop capture explicitly; show an accessible persistent capture indicator and immediate stop control.
- Saving memories or Field Log entries requires intentional user action or explicit, revocable opt-in. Provide review, correction, export, and deletion controls.
- Do not log audio, transcripts, precise coordinates, personal memories, tokens, or credentials. Use synthetic data for demos, fixtures, and previews.
- Keep privileged Higgs, InsForge, and Places credentials on the backend. Treat every `EXPO_PUBLIC_*` value as public. Restrict any required mobile Maps key to the app and required APIs.
- Validate identity and per-user authorization on every protected operation, including agent tools and stored objects. Never trust model output as authorization.
- Use encrypted transport and platform secure storage for device tokens. Minimize retention and third-party disclosure; verify provider policies before sending real user data.
- Treat place descriptions, retrieved content, and tool output as untrusted input. Allowlist tools, validate arguments, and require confirmation for consequential actions.

## Accessibility and UX requirements

- All future UI must meet WCAG 2.2 AA and mobile-first UX, mapped to native iOS/Android accessibility behavior. Accessibility is a delivery requirement, not a later enhancement.
- Use at least 44×44 logical-unit primary touch targets (44 pt iOS; prefer 48 dp Android), adequate spacing, and reachable controls. Meet WCAG target-size requirements for remaining controls.
- Provide semantic roles, names, states, and hints; logical reading/focus order; visible focus where applicable; and accessible announcements for meaningful status changes. Test VoiceOver and TalkBack.
- Support dynamic text sizing without clipping or lost controls. Meet 4.5:1 normal-text contrast and 3:1 large-text and meaningful UI contrast; never communicate meaning by color alone.
- Respect reduced motion; avoid unnecessary animation/flashing. Do not make gestures, sound, voice, or motion the sole way to act or receive essential information; provide text/touch equivalents.
- Keep system status visible and accessible: permission, listening, thinking, speaking, saving, offline, and error states. Never imply a save succeeded before confirmation.
- Preserve user control: obvious stop/mute/cancel, interruption support, back navigation, permission revocation, and undo where feasible. Never auto-start recording.
- Prevent errors with constraints and clear previews; explain recovery in plain language, preserve user input, and make retries safe. Confirm destructive actions proportionately.
- Use consistent labels, recognition over recall, progressive disclosure, and concise copy. No dark patterns, coerced permissions, deceptive defaults, hidden costs, or manipulative engagement.

## Architecture and coding standards

- Keep Expo/React Native in `apps/mobile`, agent/backend code in `services/agent`, and supporting documentation in `docs`. Keep cloud runtime on InstaCloud; InsForge owns auth and persistent user data.
- Use strict TypeScript when implementation begins. Favor small cohesive modules, explicit boundaries, typed contracts, runtime input validation, and minimal dependencies.
- Keep vendor adapters separate from product logic; avoid speculative abstractions and unnecessary services. Verify current SDK documentation before selecting integrations or versions.
- Add one package manager and committed lockfile when code is introduced. Add formatting, linting, type checks, and meaningful tests at that point; do not add placeholder passing scripts.
- Test permission denial, interrupted sessions, offline behavior, unauthorized access, deletion, accessibility, and retries as applicable. Document checks performed and unresolved limitations honestly.
- Version every schema change under `services/agent/migrations`; test authorization rules and migration behavior before use with real data.
- Never commit secrets, generated builds, or personal data. Keep configuration examples value-free. Use InstaCloud secret injection for runtime credentials.
- Use task branches for implementation; preserve unrelated work. Use the InstaCloud skill and `--agent` for CLI operations, respect approval gates, and isolate cloud environments when provisioned. Never deploy as an incidental setup step.
- Update documentation when contracts, data flows, permissions, or setup change. Do not claim production readiness or accessibility compliance without verification.
