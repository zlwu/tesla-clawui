## 1. Stream Completion Semantics

- [x] 1.1 Update the streaming provider contract in `server/src/providers/llm/provider.ts` and the OpenAI-compatible stream readers so stream parsing returns completion metadata alongside reply text, including whether an explicit completion marker was observed.
- [x] 1.2 Update `server/src/services/llm-service.ts`, `server/src/services/text-service.ts`, and `server/src/routes/text.ts` so only explicitly completed upstream streams may persist messages, save request-log results, and emit SSE `done`, while incomplete or truncated streams are converted into retryable SSE `error` responses.
- [x] 1.3 Ensure failed or truncated streaming attempts do not lock in a partial `requestId` result and that a later retry with the same `requestId` still produces at most one persisted user/assistant message pair.

## 2. Diagnostics And Regression Coverage

- [x] 2.1 Add structured backend diagnostics around upstream stream completion, including provider name, completion marker presence, delta count, character count, termination reason, and final request outcome, without logging full assistant content.
- [x] 2.2 Add or update provider-level tests for normal completion, explicit upstream error, empty stream output, and silent truncation after partial deltas.
- [x] 2.3 Add or update service/API/frontend streaming tests so truncated upstream responses yield SSE `error`, do not persist partial assistant messages, do not save a reusable final request-log result, and still preserve the normal successful `done` path.

## 3. Docs And Validation

- [x] 3.1 Update `README.md` to document that upstream stream completion is now validated server-side and that silent truncation diagnosis depends on backend logs rather than browser console access.
- [x] 3.2 Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
