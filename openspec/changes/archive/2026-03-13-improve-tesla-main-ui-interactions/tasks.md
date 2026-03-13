## 1. Interaction State

- [x] 1.1 Extend the frontend app state to represent bottom-follow vs history-browsing mode, composer-local status hints, send-wait vs streaming phases, keyboard blur restoration conditions, and the active keyboard-avoidance source.
- [x] 1.2 Update `web/src/app.ts` scroll, focus, resize, and send handlers so leaving the bottom disables auto-follow, blur no longer forces a bottom jump when browsing history, sending shows an explicit pre-stream waiting state, streaming keeps textarea editable while send remains gated, and keyboard avoidance prefers real viewport changes before fallback insets.
- [x] 1.3 Consolidate keyboard-safe layout calculation into one path that composes layout viewport, `visualViewport`, safe area, and focus fallback without double compensation.

## 2. Rendering And Styling

- [x] 2.1 Update `web/src/render.ts` to add a stable “back to bottom” control and a composer-adjacent status region without rebuilding the existing textarea, message list, or composer shell nodes.
- [x] 2.2 Update `web/index.html` and `web/styles/main.css` so the root shell follows keyboard-safe viewport sizing, header chrome is slimmer, the new follow control does not cover recent messages, and composer states remain visually stable across empty, streaming, and error modes.
- [x] 2.3 Validate that composer remains in normal document flow during keyboard transitions and never falls back to an overlay model on Tesla or iOS browsers.
- [x] 2.4 Define the pre-stream waiting indicator as a lightweight ASCII dot animation that stops immediately on first delta or error.

## 3. Tests And Docs

- [x] 3.1 Add or update frontend tests for follow-mode transitions, send-wait to streaming state transitions, ASCII waiting-indicator stop conditions, streaming-time draft editing, viewport-driven keyboard avoidance, and keyboard blur context preservation.
- [x] 3.2 Add a manual validation checklist for Tesla, iOS Safari, and iOS Chrome covering focus, typing, send, keyboard expand/collapse, and history browsing while the keyboard is visible.
- [x] 3.3 Update `README.md` to document the refined Tesla main-screen interaction model, the keyboard-safe layout strategy, and the manual validation expectations for Tesla plus iOS Safari/Chrome.
- [x] 3.4 Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
