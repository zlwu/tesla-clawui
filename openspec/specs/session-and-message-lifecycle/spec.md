## Purpose

定义会话、消息、恢复和幂等的基础行为，让后续变更在一致的数据与交互生命周期上推进。

## Requirements

### Requirement: 会话创建契约
客户端 MUST 能在发送消息之前，通过专用 API 创建 Tesla 浏览器会话。

#### Scenario: 创建会话
- **WHEN** 客户端向会话创建接口提交 Tesla 浏览器设备描述
- **THEN** 后端 MUST 创建会话记录，并返回 session 标识与 session token

#### Scenario: 使用无效 session token
- **WHEN** 受保护请求未携带有效 bearer token
- **THEN** 后端 MUST 用稳定的未授权 session 错误拒绝请求

### Requirement: 消息历史持久化
系统 MUST 按 session 持久化用户消息和助手消息，并让最近会话内容可被恢复。

#### Scenario: 完成一次文本交互
- **WHEN** 用户消息收到助手回复
- **THEN** 两条消息 MUST 持久化到同一个 session 下

#### Scenario: 恢复最近会话
- **WHEN** 客户端重新加载一个活跃 session
- **THEN** 它 MUST 能拉取并展示该 session 最近的消息

### Requirement: 可见消息窗口
Tesla 客户端 MUST 把可见消息窗口限制在适合老浏览器渲染的最近小集合内。

#### Scenario: 存在较长历史会话
- **WHEN** 某个 session 中的消息数超过 Tesla UI 一次应渲染的范围
- **THEN** 客户端 MUST 只展示最近的有界子集，并保持消息顺序不变

### Requirement: 请求幂等
文本交互链路 MUST 遵守客户端提供的请求标识，以避免生成重复的助手回复。

#### Scenario: 重试已经提交过的请求
- **WHEN** 同一个 `requestId` 在相同 session 和相同意图下再次发送
- **THEN** 系统 MUST 避免创建重复的用户/助手回复对
