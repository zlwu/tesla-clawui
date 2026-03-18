## MODIFIED Requirements

### Requirement: SSE 流式回复路径
助手回复 MUST 支持 server-sent event streaming，并作为当前主回复路径。只有在上游 provider 流明确完成且服务端已经形成可信的最终回复后，服务端才 MUST 发送终止性的 `done` 事件。对于 `LLM_PROVIDER=openclaw`，服务端 MUST 将 OpenClaw Gateway 原生 chat/session 流式事件桥接为现有的 `start` / `delta` / `done` SSE 语义，而前端接口形式保持不变。

#### Scenario: 开始流式回复
- **WHEN** 客户端针对合法请求打开流式文本接口
- **THEN** 服务端 MUST 在任何助手文本增量之前先发送 `start` 事件

#### Scenario: 推送助手文本增量
- **WHEN** provider 返回增量助手文本
- **THEN** 服务端 MUST 按顺序发送 `delta` 事件，使客户端可以渐进渲染回复内容

#### Scenario: 完成流式回复
- **WHEN** 上游 provider 明确给出完整结束信号，且服务端已持久化本次成功响应
- **THEN** 服务端 MUST 发送终止性的 `done` 事件，并携带已持久化的响应负载

#### Scenario: 上游流静默结束
- **WHEN** 服务端已经收到至少一个助手文本增量，但上游 provider 在缺少明确完成信号的情况下结束流
- **THEN** 服务端 MUST NOT 发送 `done` 事件，且 MUST 将该次流式回复视为失败

## ADDED Requirements

### Requirement: OpenClaw 原生事件桥接
当使用 OpenClaw Gateway 原生 chat/session API 时，服务端 MUST 把原生事件流稳定映射到现有 Tesla 前端可消费的 SSE 语义，并保留错误与完成性诊断能力。

#### Scenario: 原生 Gateway 事件映射为 SSE
- **WHEN** OpenClaw Gateway 原生 chat/session 返回一组有序事件
- **THEN** 服务端 MUST 仅向前端暴露兼容当前 UI 的 `start`、`delta`、`done` 或 `error` 事件集合

#### Scenario: 原生 Gateway 流异常结束
- **WHEN** OpenClaw Gateway 原生 chat/session 在缺少可信完成信号的情况下结束
- **THEN** 服务端 MUST 将该次回复视为失败，并返回与当前 SSE 主链路一致的错误语义
