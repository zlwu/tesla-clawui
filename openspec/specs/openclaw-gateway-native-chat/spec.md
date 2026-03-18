## Purpose

定义 `LLM_PROVIDER=openclaw` 时服务端通过 OpenClaw Gateway 原生 chat/session 能力接入上游 agent 的稳定基线。

## Requirements

### Requirement: OpenClaw 原生 Gateway chat/session 接入
当 `LLM_PROVIDER=openclaw` 时，后端 MUST 通过 OpenClaw Gateway 原生 chat/session 能力与上游 agent 交互，而不是继续依赖 OpenAI 兼容 `/v1/chat/completions`。

#### Scenario: 建立上游 OpenClaw 会话
- **WHEN** 后端首次为一个本地 Tesla session 准备 OpenClaw 上游上下文
- **THEN** 系统 MUST 建立或定位一个对应的原生 OpenClaw session，并将后续消息发送到该 session

#### Scenario: 发送原生 chat 消息
- **WHEN** 用户在本地 Tesla session 中提交一条文本消息
- **THEN** 后端 MUST 通过 OpenClaw Gateway 原生 chat/session API 把该消息发送到目标 agent 对应的上游会话

#### Scenario: 接收上游流式事件
- **WHEN** OpenClaw Gateway 原生 chat/session 返回增量事件
- **THEN** 后端 MUST 能按顺序消费这些事件，并形成可供本地 SSE 桥接的稳定流式输出

### Requirement: OpenClaw agent 路由由原生 Gateway 语义决定
系统 MUST 使用 OpenClaw Gateway 原生 agent/session 路由语义与目标 agent 交互，而 MUST NOT 依赖兼容接口特有的路由变体来推断 agent 身份。

#### Scenario: 命中目标 agent
- **WHEN** 系统以目标 agent 身份初始化一次原生 Gateway chat/session 会话
- **THEN** 上游响应 MUST 体现该 agent 的真实身份与系统设定，而不是兼容接口 fallback 的其他 agent 行为
