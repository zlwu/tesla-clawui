## Purpose

定义当前文本输入与 SSE streaming 回复主链路，确保后续功能扩展不会偏离文本流式交互的核心约束。

## Requirements

### Requirement: 文本输入契约
Tesla 客户端 MUST 通过专用文本输入 API 发送消息，并校验 `sessionId`、`text` 和 `requestId`。

#### Scenario: 发送有效文本请求
- **WHEN** 客户端携带 bearer 认证提交合法的文本输入负载
- **THEN** 后端 MUST 接受请求，并基于当前活跃 session 上下文处理它

#### Scenario: 发送无效文本请求
- **WHEN** 请求负载缺少必填字段或超过允许范围
- **THEN** 后端 MUST 按统一错误响应结构拒绝该请求

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

### Requirement: 统一错误语义
文本交互接口 MUST 返回稳定、可机读、且带重试语义的错误信息。任何未完整完成的上游流都 MUST 映射为明确的失败结果，而不是部分成功。

#### Scenario: 流式处理中发生错误
- **WHEN** 流式回复开始后发生应用层错误
- **THEN** 服务端 MUST 发送包含标准错误对象的 `error` 事件，然后关闭连接

#### Scenario: 上游流被截断
- **WHEN** 上游 provider 流在未满足成功完成条件时提前结束或无法确认完整收尾
- **THEN** 服务端 MUST 发送带有稳定错误对象的 `error` 事件，且该错误 MUST 标记为可重试

#### Scenario: 非流式文本请求失败
- **WHEN** 请求在完成前失败
- **THEN** JSON 响应 MUST 使用标准 `ok: false` 错误包裹结构，并包含 `code`、`message` 和 `retryable`

### Requirement: 上游流完成性诊断
服务端 MUST 为每次上游 LLM 流式请求记录足够的结构化诊断信息，以便区分正常完成、显式失败和静默截断。

#### Scenario: 流式回复成功完成
- **WHEN** 一次上游流完整结束并被服务端判定为成功
- **THEN** 服务端 MUST 记录与该 `requestId` 对应的完成性诊断信息，包括是否收到完成信号、delta 统计和最终收尾结果

#### Scenario: 流式回复异常结束
- **WHEN** 一次上游流因解析异常、显式上游错误或静默截断而失败
- **THEN** 服务端 MUST 记录与该 `requestId` 对应的异常终止原因和完成性诊断信息，以支持后端排障

### Requirement: 清除上下文后的文本请求从空历史开始
文本输入主链路 MUST 在清除上下文成功后，把同一 session 的后续文本请求视为从空历史开始的新对话。

#### Scenario: 清除后发送第一条消息
- **WHEN** 用户在清除上下文成功后发送第一条新消息
- **THEN** 服务端 MUST 在不带任何已清除历史消息的前提下处理该请求

### Requirement: 流式期间禁止并发清除
系统 MUST 避免在同一 session 的文本流式请求尚未完成时并发执行清除上下文，以防止进行中的 SSE 回复与消息持久化状态失配。

#### Scenario: 流式请求进行时尝试清除
- **WHEN** 同一 session 仍有 waiting 或 streaming 中的文本请求
- **THEN** 系统 MUST 拒绝该次清除上下文请求，并返回稳定、可机读的失败结果

### Requirement: OpenClaw 原生事件桥接
当使用 OpenClaw Gateway 原生 chat/session API 时，服务端 MUST 把原生事件流稳定映射到现有 Tesla 前端可消费的 SSE 语义，并保留错误与完成性诊断能力。

#### Scenario: 原生 Gateway 事件映射为 SSE
- **WHEN** OpenClaw Gateway 原生 chat/session 返回一组有序事件
- **THEN** 服务端 MUST 仅向前端暴露兼容当前 UI 的 `start`、`delta`、`done` 或 `error` 事件集合

#### Scenario: 原生 Gateway 流异常结束
- **WHEN** OpenClaw Gateway 原生 chat/session 在缺少可信完成信号的情况下结束
- **THEN** 服务端 MUST 将该次回复视为失败，并返回与当前 SSE 主链路一致的错误语义
