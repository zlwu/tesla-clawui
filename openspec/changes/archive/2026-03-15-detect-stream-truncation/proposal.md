## Why

当前 Tesla 主链路已经支持 SSE streaming，但真实车机场景里偶发“助手说到一半就停住、页面也没有报错”的现象。基于现有实现，这类现象很可能来自服务端到 OpenClaw Gateway 的上游流被静默截断，或 Gateway 提前结束，而本服务仍把半截文本当成成功完成；这个问题会直接损害车机端可用性和用户信任，因此需要先把完成判定、错误语义和诊断能力收口。

## What Changes

- 收紧流式回复的成功判定：只有在上游流明确完成时，服务端才允许发送终止性的 `done` 事件并持久化助手消息。
- 把“收到部分 delta 后静默结束”的情况统一识别为可重试错误，而不是半截成功。
- 为上游 LLM 流补充结构化诊断日志，包括完成标记、delta 计数、累计字符数和收尾原因，便于区分弱网、Gateway 异常和模型主动停止。
- 保持现有 Tesla 文本 SSE 主链路、前端重试语义和 requestId 幂等模型，不引入 WebSocket、轮询或新的产品形态。
- 为静默截断、显式上游错误、正常完成三类路径补充服务端与前端测试，避免回归。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `text-chat-streaming`: 明确流式回复只有在上游完成信号齐备时才算成功；静默截断必须转换为稳定的 `error` 事件与可重试错误语义。
- `session-and-message-lifecycle`: 明确未完整完成的流式回复不得以成功助手消息形式落库，也不得把半截回复缓存为该 `requestId` 的最终结果。

## Impact

- Affected code: `server/src/providers/llm/openai-stream.ts`, `server/src/providers/llm/openclaw-provider.ts`, `server/src/services/llm-service.ts`, `server/src/services/text-service.ts`, `server/src/routes/text.ts`, `web/src/api.ts`, and related tests.
- Affected specs: `openspec/specs/text-chat-streaming/spec.md` and `openspec/specs/session-and-message-lifecycle/spec.md`.
- Affected systems: OpenClaw Gateway upstream streaming path, SSE error handling, request result persistence, and backend observability.
