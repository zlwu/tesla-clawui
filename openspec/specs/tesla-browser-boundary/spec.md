## Purpose

定义 Tesla OpenClaw 的稳定产品边界，确保后续所有变更继续以 Tesla 老款 Atom / MCU2 浏览器上的文本对话体验为中心。

## Requirements

### Requirement: Tesla 浏览器兼容性边界
产品 MUST 以 Tesla 老款 Atom / MCU2 浏览器为首要兼容目标。

#### Scenario: 评估新功能
- **WHEN** 提议引入新的 capability 或依赖
- **THEN** 它 MUST 保持在老款 Tesla 浏览器上的可用性，或者先通过 OpenSpec 变更明确修改产品范围

#### Scenario: 选择实现方案
- **WHEN** 存在多个实现方案
- **THEN** MUST 优先选择运行时更轻、对浏览器能力假设更少的方案

### Requirement: MVP 必须保持文本优先
MVP MUST 保持 “Tesla 系统语音输入法 + 文本发送” 作为主输入路径，并保持大字文本多轮对话作为主输出路径。

#### Scenario: 定义主输入路径
- **WHEN** Tesla 客户端交付给用户使用
- **THEN** 它 MUST 支持系统语音输入后的文本发送，并且 MUST NOT 依赖网页内麦克风采集才能完成主链路

#### Scenario: 定义主输出路径
- **WHEN** 展示助手回复
- **THEN** 主成功路径 MUST 是可读的大字文本对话，而不是音频播放

### Requirement: 明确的非目标默认不得重新进入基线
除非 OpenSpec 变更明确引入，当前基线产品 MUST 排除手机协同、双端协作、TTS 主导体验和重型前端框架。

#### Scenario: 提议扩展产品范围
- **WHEN** 某项工作引入手机协同、OAuth 类账号、WebRTC 语音或 TTS 优先播放
- **THEN** 这项工作 MUST 被视为 scope change，而不是普通实现细节

#### Scenario: 提议修改前端技术栈
- **WHEN** 实现工作考虑引入 React、Next.js、Vue 或重型 UI 框架
- **THEN** 在没有前置 OpenSpec 变更更新本 capability 的情况下，该提议 MUST 被拒绝
