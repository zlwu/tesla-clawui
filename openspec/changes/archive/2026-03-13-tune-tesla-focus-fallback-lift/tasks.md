## 1. Tesla Focus Fallback Lift

- [x] 1.1 Update `web/src/ui-state.ts` so `focus-fallback` uses a higher Tesla-safe inset while keeping a short-viewport guard.
- [x] 1.2 Update `web/src/__tests__/ui-state.test.ts` to lock the stronger Tesla fallback values and the short-viewport cap.
- [x] 1.3 Run `npm test -w @tesla-openclaw/web` and `npm run build -w @tesla-openclaw/web`.
