## Why

当前 Tesla OpenClaw Client 通过 OpenClaw 的 OpenAI 兼容 HTTP 接口接入上游模型，但实际联调表明该路径返回的 agent 行为与预期的 `main/tars` 不一致。官方文档与 `webclaw` 都更接近使用 OpenClaw Gateway 原生 chat/session 能力，因此需要把 OpenClaw 接入从兼容接口迁移到原生传输层，以恢复正确的 agent 语义并稳定清除上下文行为。

## What Changes

- 将 `LLM_PROVIDER=openclaw` 的后端 provider 从 OpenAI 兼容 `/v1/chat/completions` 迁移到 OpenClaw Gateway 原生 chat/session API。
- 保持 Tesla 前端现有 REST + SSE 外观不变，由服务端在内部把 Gateway 原生事件桥接成当前 `start` / `delta` / `done` 流式协议。
- 把本地 Tesla session 与上游 OpenClaw session 的映射收敛为显式的后端责任，而不是继续由前端直接生成并传递 `openclawSessionKey`。
- 让“清除上下文”同时重置本地持久化消息与上游 OpenClaw 会话状态，避免出现 agent 人设正确但会话残留错乱的情况。
- 增加一套可复现的 OpenClaw Gateway 验证/调试方案，便于后续定位 Gateway chat/session 语义问题，而不强制要求本地安装完整 OpenClaw 环境。

## Capabilities

### New Capabilities
- `openclaw-gateway-native-chat`: 定义 Tesla 后端如何通过 OpenClaw Gateway 原生 chat/session API 建立会话、发送消息、接收流式事件与重置上游会话。

### Modified Capabilities
- `session-and-message-lifecycle`: 本地 Tesla session 与上游 OpenClaw session 的映射、恢复与清除语义将发生变化。
- `text-chat-streaming`: OpenClaw provider 的流式主链路将从兼容 HTTP 接口切换到 Gateway 原生 chat/session 事件流，但对前端仍保持当前 SSE 合同。

## Impact

- 后端 `OpenClawProvider`、`LlmService`、`TextService`、`session`/`message` 相关逻辑。
- OpenClaw 配置读取、上游连接与验证/调试说明。
- 现有清除上下文能力、恢复语义和流式测试用例。
- 需要补充一套面向本地 OpenClaw 环境的验证命令与文档。
