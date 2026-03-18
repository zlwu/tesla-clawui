## ADDED Requirements

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
