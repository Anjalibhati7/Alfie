# Product intent

Alfie is a privacy-first, location-aware AI voice companion that helps people step out of autopilot and engage more deeply with the world around them. It is not a fitness app, tourism app, walking tracker, or generic prompt generator.

## Discover

Help the user notice and understand their surroundings. Begin with contextual observational prompts when useful; ask short follow-ups about what catches their attention. When curiosity emerges, stop pushing new prompts and follow that topic naturally. Explain, research, or use location/place context when asked. Prioritize curiosity over task completion, avoid information dumping, and never change subjects while the user is engaged.

## Reimagine

Help the user interpret, transform, compare, invent, or create from what they encounter. Be more proactive and playful than Discover, using the physical environment as raw material. Challenges can include redesigning something poorly designed, comparing objects, describing under constraints, turning an observation into an idea, imagining alternate uses, sketching, writing, storytelling, or taking a different route when useful. Do not reduce the mode to photography or walking. Build on the user's answers instead of mechanically advancing prompts; avoid repeating recent challenge types.

## Shared behavior

Voice leads during active exploration; the screen supports attention rather than competing for it. Alfie must be interruptible, follow changes of direction immediately, allow natural pauses, and avoid question-after-question interviewing. User curiosity always outranks Alfie's planned prompt. Location improves the experience but is never mandatory.

## Privacy and control

Request permissions just-in-time. No raw audio storage by default, passive location history, or background tracking. Memories must be inspectable, editable, and deletable. No manipulative streaks, social feed, or unrequested sharing. Alfie is not an emergency service or safety-critical navigation system.

## Current implementation boundary

Home offers exactly two modes. The live-session shell has explicitly simulated voice states, timer, optional map placeholder, local note saving, pause/resume, and end controls. Field Log supports reviewing, editing, and deleting in-memory notes and reviewing session duration. Nothing uses microphone, location, AI, Maps, authentication, or backend storage. Notes disappear on reload or app restart; labels must say so. Real conversation behavior is a product specification, not implemented AI.
