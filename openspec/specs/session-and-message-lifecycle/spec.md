## Purpose

定义会话、消息、恢复、清除与幂等的基础行为，让后续变更在一致的数据与交互生命周期上推进。

## Requirements

### Requirement: 会话创建契约
客户端 MUST 能在发送消息之前，通过专用 API 创建 Tesla 浏览器会话。对于 `LLM_PROVIDER=openclaw`，系统 MUST 为该本地 session 建立或准备一个对应的上游 OpenClaw session 标识，以便后续文本请求与清除上下文都能作用于同一上游会话。

#### Scenario: 创建会话
- **WHEN** 客户端向会话创建接口提交 Tesla 浏览器设备描述
- **THEN** 后端 MUST 创建会话记录，并返回 session 标识与 session token

#### Scenario: 使用无效 session token
- **WHEN** 受保护请求未携带有效 bearer token
- **THEN** 后端 MUST 用稳定的未授权 session 错误拒绝请求

### Requirement: 消息历史持久化
系统 MUST 按 session 持久化用户消息和助手消息，并让最近会话内容可被恢复。只有完整成功的文本交互结果才 MAY 被持久化为正式的用户/助手消息对。对于 OpenClaw 原生 Gateway 路径，本地持久化历史与上游 OpenClaw session 状态 MUST 保持一致的生命周期语义。

#### Scenario: 完成一次文本交互
- **WHEN** 用户消息收到完整成功的助手回复
- **THEN** 两条消息 MUST 持久化到同一个 session 下

#### Scenario: 流式回复中途失败
- **WHEN** 一次流式文本回复在未满足成功完成条件时失败或被截断
- **THEN** 系统 MUST NOT 把半截助手内容持久化为正式 assistant 消息

#### Scenario: 恢复最近会话
- **WHEN** 客户端重新加载一个活跃 session
- **THEN** 它 MUST 能拉取并展示该 session 最近的消息

### Requirement: 可见消息窗口
Tesla 客户端 MUST 把可见消息窗口限制在适合老浏览器渲染的最近小集合内。

#### Scenario: 存在较长历史会话
- **WHEN** 某个 session 中的消息数超过 Tesla UI 一次应渲染的范围
- **THEN** 客户端 MUST 只展示最近的有界子集，并保持消息顺序不变

### Requirement: 请求幂等
文本交互链路 MUST 遵守客户端提供的请求标识，以避免生成重复的助手回复。只有完整成功的最终结果才 MAY 作为该 `requestId` 的可复用结果被保存。对于 OpenClaw 原生 Gateway 路径，幂等重试 MUST NOT 导致上游会话中出现重复的用户/助手回复。

#### Scenario: 重试已经提交过的请求
- **WHEN** 同一个 `requestId` 在相同 session 和相同意图下再次发送，且此前已经存在完整成功结果
- **THEN** 系统 MUST 复用该成功结果，并避免创建重复的用户/助手回复对

#### Scenario: 重试失败的流式请求
- **WHEN** 同一个 `requestId` 之前只经历了失败、截断或未完成的流式处理
- **THEN** 系统 MUST NOT 把半截结果当作最终答案复用，且后续重试完成后仍 MUST 最多生成一组正式的用户/助手回复对

### Requirement: 当前会话上下文可清除
系统 MUST 允许已授权客户端清除当前 session 下已持久化的消息历史，并让该 session 在清除后表现为一个空上下文会话。

#### Scenario: 清除已有消息历史
- **WHEN** 已授权客户端对一个包含历史消息的 session 触发清除上下文
- **THEN** 系统 MUST 删除该 session 下已持久化的用户与助手消息，并返回清除成功结果

#### Scenario: 清除后恢复最近会话
- **WHEN** 客户端在清除成功后刷新页面或重新加载同一个活跃 session
- **THEN** 它 MUST 拉取到空的消息列表，而 MUST NOT 恢复已被清除的旧消息

#### Scenario: 清除空会话
- **WHEN** 已授权客户端对当前没有正式消息的 session 触发清除上下文
- **THEN** 系统 MUST 返回成功结果，并保持该 session 处于空消息状态

### Requirement: 清除后幂等结果失效
系统 MUST 在清除上下文时一并移除或失效化当前 session 相关的可复用文本请求结果，以避免后续请求重新带回已清除上下文对应的历史输出。

#### Scenario: 清除后重发新请求
- **WHEN** 用户在清除上下文后发送新的文本请求
- **THEN** 系统 MUST 基于清空后的消息历史处理该请求，而 MUST NOT 复用清除前 session 历史对应的上下文结果

### Requirement: 清除上下文时同步重置上游 OpenClaw 会话
当本地 Tesla session 触发清除上下文时，系统 MUST 同时清理本地消息与幂等状态，并重置对应的上游 OpenClaw session 状态，避免本地已清空而上游仍残留旧会话上下文。

#### Scenario: 清除当前会话上下文
- **WHEN** 已授权客户端对一个使用 OpenClaw 原生 Gateway 的本地 session 触发清除上下文
- **THEN** 系统 MUST 让后续请求命中一个已重置或空状态的上游 OpenClaw session
