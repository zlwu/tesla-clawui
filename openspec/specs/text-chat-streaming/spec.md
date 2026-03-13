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
助手回复 MUST 支持 server-sent event streaming，并作为当前主回复路径。

#### Scenario: 开始流式回复
- **WHEN** 客户端针对合法请求打开流式文本接口
- **THEN** 服务端 MUST 在任何助手文本增量之前先发送 `start` 事件

#### Scenario: 推送助手文本增量
- **WHEN** provider 返回增量助手文本
- **THEN** 服务端 MUST 按顺序发送 `delta` 事件，使客户端可以渐进渲染回复内容

#### Scenario: 完成流式回复
- **WHEN** 助手回复成功结束
- **THEN** 服务端 MUST 发送终止性的 `done` 事件，并携带已持久化的响应负载

### Requirement: 统一错误语义
文本交互接口 MUST 返回稳定、可机读、且带重试语义的错误信息。

#### Scenario: 流式处理中发生错误
- **WHEN** 流式回复开始后发生应用层错误
- **THEN** 服务端 MUST 发送包含标准错误对象的 `error` 事件，然后关闭连接

#### Scenario: 非流式文本请求失败
- **WHEN** 请求在完成前失败
- **THEN** JSON 响应 MUST 使用标准 `ok: false` 错误包裹结构，并包含 `code`、`message` 和 `retryable`
