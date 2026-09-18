# Visual foundation

Editorial, structured, precise. The reference is [Bespoke Labs](https://bespokelabs.ai): typography, thin rules, grids, whitespace, and linework inspire the approach, without copying branding or layout.

| Token       | Hex       | Intended role                                                     |
| ----------- | --------- | ----------------------------------------------------------------- |
| Ink Black   | `#0D1821` | Primary text and structure                                        |
| Yale Blue   | `#344966` | Secondary text, rules, focus                                      |
| Powder Blue | `#B4CDED` | Subtle supporting surfaces                                        |
| Porcelain   | `#F0F4EF` | Dominant background                                               |
| Terracotta  | `#A24C3F` | Accent only: primary actions, active states, important highlights |

Porcelain and Ink dominate. No green, mustard, glowing orbs, AI gradients, glassmorphism, or wellness styling. Active sessions are significantly quieter than home/log screens. Use sparse icons, strong editorial type, and intentional whitespace.

Tokens live in `apps/mobile/src/design/tokens.ts`. The boot screen uses a system serif heading (Georgia on iOS/web, native serif on Android) and system body text; custom fonts await screen design. Spacing follows 4/8/12/16/24/32/48 units, radii 0/4/8, and borders 1/2. Text scales with platform settings, content scrolls, and no animation runs by default.

Use Ink or Yale on Porcelain, Ink on Powder, and Porcelain on Terracotta. Powder is not a text color on Porcelain. Validate contrast for each actual combination, including opacity and disabled states. Do not communicate state by color alone. Primary controls use at least 44×44 logical units (the shared utility uses 48×48). Verify screen readers, enlarged text, keyboard focus where relevant, and reduced motion on devices before claiming accessibility compliance.
