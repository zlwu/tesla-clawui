## MODIFIED Requirements

### Requirement: 消息历史持久化
系统 MUST 按 session 持久化用户消息和助手消息，并让最近会话内容可被恢复。只有完整成功的文本交互结果才 MAY 被持久化为正式的用户/助手消息对。

#### Scenario: 完成一次文本交互
- **WHEN** 用户消息收到完整成功的助手回复
- **THEN** 两条消息 MUST 持久化到同一个 session 下

#### Scenario: 流式回复中途失败
- **WHEN** 一次流式文本回复在未满足成功完成条件时失败或被截断
- **THEN** 系统 MUST NOT 把半截助手内容持久化为正式 assistant 消息

#### Scenario: 恢复最近会话
- **WHEN** 客户端重新加载一个活跃 session
- **THEN** 它 MUST 能拉取并展示该 session 最近的消息

### Requirement: 请求幂等
文本交互链路 MUST 遵守客户端提供的请求标识，以避免生成重复的助手回复。只有完整成功的最终结果才 MAY 作为该 `requestId` 的可复用结果被保存。

#### Scenario: 重试已经提交过的请求
- **WHEN** 同一个 `requestId` 在相同 session 和相同意图下再次发送，且此前已经存在完整成功结果
- **THEN** 系统 MUST 复用该成功结果，并避免创建重复的用户/助手回复对

#### Scenario: 重试失败的流式请求
- **WHEN** 同一个 `requestId` 之前只经历了失败、截断或未完成的流式处理
- **THEN** 系统 MUST NOT 把半截结果当作最终答案复用，且后续重试完成后仍 MUST 最多生成一组正式的用户/助手回复对
