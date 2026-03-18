## ADDED Requirements

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
