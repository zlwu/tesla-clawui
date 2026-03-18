## Context

当前项目已经完成 Tesla 文本主链路、SSE streaming、共享 PIN 门禁和清除上下文能力，但 OpenClaw 接入仍走 OpenAI 兼容 HTTP 接口。实际联调中，这条路径在 `main` agent 上返回了与预期 `tars` 不一致的 codex 风格行为，说明兼容接口并未稳定命中我们需要的原生 chat/session 语义。

官方文档显示 OpenClaw 自身的 WebChat 通过 Gateway 原生 chat/session 通道工作，而不是兼容 `/v1/chat/completions`。同时，当前前端已经稳定依赖后端提供的 REST + SSE 合同，Tesla 浏览器兼容性也要求我们避免在前端直接引入新的 WebSocket 复杂度。因此，这次迁移应当以“后端内部换传输、前端接口保持稳定”为原则推进。

## Goals / Non-Goals

**Goals:**
- 让 `LLM_PROVIDER=openclaw` 通过 OpenClaw Gateway 原生 chat/session API 与 `main/tars` 对话。
- 保持前端现有 `/api/text/input` 与 `/api/text/input/stream` 契约不变，继续使用现有 SSE 主链路。
- 把本地 Tesla session 与上游 OpenClaw session 的映射下沉到后端管理，减少前端对 Gateway 语义的直接耦合。
- 让清除上下文能够同时重置本地消息状态与上游 OpenClaw 会话状态。
- 为后续调试准备可复现的 Gateway 验证基线与验证脚本，而不强制要求本地安装完整 OpenClaw 环境。

**Non-Goals:**
- 不重构前端为直接连接 Gateway WebSocket 的架构。
- 不改回网页录音、ASR 上传、TTS 或手机协同等已明确排除的路线。
- 不引入多会话列表、多用户账户或新的 Tesla 主界面信息架构。
- 不在本次迁移中扩展 Markdown、滚动、键盘避让等与传输层无关的 UI 范围。

## Decisions

### 1. 仅替换后端 OpenClaw 传输层，前端 REST + SSE 外观保持不变

后端新增一个 Gateway 原生 chat/session client，由 `OpenClawProvider` 在内部负责连接、发送 chat 消息、读取上游事件并桥接成现有 `generateReply` / `generateReplyStream` 结果。前端仍然通过当前 Fastify API 与 SSE 交互。

选择理由：Tesla 浏览器兼容性和现有 UI 状态机已经围绕当前 REST + SSE 设计收口。把 WebSocket 直接暴露到前端会扩大改动面，也会重新引入 Tesla 浏览器网络兼容风险。

替代方案：前端直接连接 Gateway WebSocket。优点是链路更短；缺点是鉴权、重连、事件排序和 Tesla 浏览器兼容性都显著复杂，因此不采用。

### 2. 上游 OpenClaw session 由后端显式管理，不再由前端传递 `openclawSessionKey`

本地 Tesla session 创建后，后端应建立或记录对应的上游 OpenClaw session 标识；后续文本请求直接依据本地 session 找到对应的上游 session。清除上下文时，由后端负责重置或轮换上游 session，并同步清理本地消息与幂等状态。

选择理由：一旦接入原生 Gateway chat/session，`openclawSessionKey` 就不再只是一个轻量 header，而是后端真正的会话基础设施。继续让前端掌管它会让恢复、清除、重登和并发门禁都更脆弱。

替代方案：保留前端生成 `openclawSessionKey`。优点是改动较小；缺点是会把 Gateway 会话语义外泄到前端状态层，并让后端难以保证恢复和清除的一致性，因此不采用。

### 3. 清除上下文改为“重置本地消息 + 重置上游 OpenClaw session”

当前清除逻辑已经能删除本地消息和 request log，但迁移后还必须同时重置原生 Gateway chat/session 状态。实现层面可以是显式 reset 当前上游 session，或更稳妥地为本地 session 绑定一个新的上游 session 标识。

选择理由：在原生 Gateway 模型里，上下文不仅来自本地消息表，还来自上游会话本身。如果只清本地数据库，不重置上游 session，清除语义仍然不完整。

替代方案：保留本地清除逻辑，不操作上游 session。该方案已经在兼容接口路径下暴露问题，因此不采用。

### 4. 先建立可复现的 Gateway 验证基线，再推进实现

由于这次迁移涉及原生 Gateway 行为、session 语义和事件流排查，因此在推进实现前，需要先准备一套可复现的 Gateway 验证基线。该基线可以是本地 Gateway，也可以是可稳定访问的现成 Gateway；核心要求是能独立于 Tesla App Server 直接验证 `connect`、`chat.send`、`sessions.reset` 和目标 agent 身份，而不是强制要求本地安装完整 OpenClaw 环境。

选择理由：先有独立于 App Server 的 Gateway 探针，才能区分“Gateway 语义问题”和“服务端桥接问题”。这比是否本地安装更关键。

替代方案：完全跳过独立 Gateway 验证，只通过应用端联调确认。优点是准备成本更低；缺点是协议问题与桥接问题会混在一起，排障成本更高，因此不采用。

## Risks / Trade-offs

- [原生 Gateway 协议接入复杂] → 先以最小 client 实现必需的会话、发送和流式读取能力，不在第一版扩展额外通道。
- [本地 session 与上游 session 映射不清] → 把映射作为显式后端状态处理，并增加清除/恢复测试覆盖。
- [清除语义再次跑偏] → 在本地 OpenClaw 环境中增加“身份保留、会话记忆清空”的专项验证。
- [迁移期间前端回归] → 保持前端 REST + SSE 合同稳定，把变更集中在 provider 与后端 session 管理层。
- [不同 Gateway 环境之间存在差异] → 文档中明确独立 Gateway 探针、应用侧 smoke 步骤以及需要记录的环境信息，优先保证验证路径可复现。

## Migration Plan

1. 准备可复现的 Gateway 验证基线，确认 Gateway 原生 chat/session 的最小可用配置与验证步骤。
2. 在后端新增 OpenClaw Gateway 原生 client，并以 provider 形式接入现有 `LlmService`。
3. 把本地 session 与上游 OpenClaw session 的映射下沉到后端，移除前端 `openclawSessionKey` 直连路径。
4. 调整清除上下文逻辑，确保本地与上游会话同时重置。
5. 保持前端 API 不变，补齐服务端、集成与 smoke 验证。
6. 如需回滚，保留兼容 HTTP provider 分支，以配置切换方式临时恢复旧链路。

## Open Questions

- Gateway 原生 chat/session 所需的最小认证与会话初始化参数集合，需要在可访问的 Gateway 验证环境中最终确认。
- 上游 session 映射应存入 SQLite session 表，还是作为可推导/可重建的后端状态管理，需要在实现前定稿。
- 是否保留兼容 HTTP provider 作为 fallback 配置，还是在迁移完成后彻底移除，需根据本地验证结果决定。
