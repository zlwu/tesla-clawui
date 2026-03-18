## 1. Gateway Verification Baseline

- [x] 1.1 准备一套可复现的 OpenClaw Gateway 验证/调试基线，并把最小连接步骤与参数整理到文档中；不强制要求本地安装完整 OpenClaw 环境。
- [x] 1.2 基于官方 Gateway 原生 chat/session 文档，确认最小认证、会话初始化、发送消息和读取流式事件的参数形状。
- [x] 1.3 补充一条最小上游验证命令或脚本，用于确认 `main/tars` 在原生 Gateway 路径下的真实返回行为。

## 2. Native Gateway Provider

- [x] 2.1 在后端新增 OpenClaw Gateway 原生 client，并支持建立连接、发送 chat 消息和消费流式事件。
- [x] 2.2 重写 `OpenClawProvider`，让 `LLM_PROVIDER=openclaw` 改走原生 Gateway chat/session API，而不是 `/v1/chat/completions`。
- [x] 2.3 保持 `LlmService`、`TextService` 对前端的现有 `generateReply` / `generateReplyStream` 契约不变，由后端完成原生事件到现有结果对象的桥接。

## 3. Session Mapping And Clear Semantics

- [x] 3.1 把本地 Tesla session 与上游 OpenClaw session 的映射下沉到后端管理，移除前端直接持有 `openclawSessionKey` 的主逻辑。
- [x] 3.2 调整清除上下文实现，使其同时清理本地消息/幂等状态并重置对应的上游 OpenClaw session。
- [x] 3.3 通过 API 级验证重登、刷新恢复、重试和清除后的后续发送，都能命中正确的上游 OpenClaw session 语义。

## 4. Regression Coverage And Docs

- [x] 4.1 为原生 Gateway provider、session 映射和清除语义补充服务端测试与 smoke 验证。
- [x] 4.2 更新 README 和相关运行文档，明确 OpenClaw 原生 Gateway 接入方式、本地开发环境要求以及排障路径。
- [x] 4.3 运行 `npm run lint`、`npm run typecheck`、`npm test`、`npm run build`，并记录 Gateway 验证基线下的自动化验证结论。
