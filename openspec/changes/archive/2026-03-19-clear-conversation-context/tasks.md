## 1. Backend Context Clear Path

- [x] 1.1 在后端 shared schema 与路由层新增“清除当前 session 上下文”接口契约，沿用现有 session token / app auth 鉴权并返回统一成功或失败结构。
- [x] 1.2 在 `server/src/services/message-service.ts` 与相关服务中实现按 `sessionId` 清除正式消息历史的能力，并确保空会话清除仍返回成功。
- [x] 1.3 在 `server/src/services/request-log-service.ts` 或相关调用链中实现按 `sessionId` 失效化文本请求复用结果，避免清除后继续命中旧上下文结果。
- [x] 1.4 在清除接口中加入 session 级并发门禁；当同一 session 仍有 waiting / streaming 中的文本请求时，返回稳定、可机读的失败结果。

## 2. Tesla UI And Client State

- [x] 2.1 在 `web/src/api.ts` 与前端状态层新增清除上下文请求封装，并在成功后统一重置本地 `messages`、错误态、pending assistant 标识和跟随状态，同时保留当前 `sessionId` / `sessionToken`。
- [x] 2.2 在 `web/src/render.ts`、`web/src/app.ts` 与 `web/styles/main.css` 中把顶栏状态收敛为单个无边框的紧凑状态指示器，避免把状态做成按钮样式。
- [x] 2.3 在 `web/src/render.ts`、`web/src/app.ts` 与 `web/styles/main.css` 中加入位于顶栏右侧的 `...` 折叠菜单，并把清除上下文入口放入该菜单，确保 Tesla 主聊天壳体不因该动作重建整页 DOM。
- [x] 2.4 为紧凑状态指示器实现图标或色点加极短语义反馈，避免只靠纯颜色表达在线、离线、错误和等待状态。
- [x] 2.5 在前端 `responsePhase` 为 `waiting` 或 `streaming` 时禁用清除入口，并在失败时保留现有消息显示与明确反馈。
- [x] 2.6 在客户端新增独立于本地 app session 的 OpenClaw session key，并在清除成功后轮换该 key，确保上游 gateway 会话也从空上下文开始。
- [x] 2.7 验证清除成功后刷新页面或重新进入同一 session 时仍保持空消息恢复语义，且新发送的第一条消息从空历史开始。

## 3. Regression Coverage And Docs

- [x] 3.1 为后端补充服务/API 测试，覆盖清除成功、清除空会话、streaming 期间拒绝清除，以及清除后不再复用旧 request log 结果。
- [x] 3.2 为前端补充 `app` / `render` / `api` 相关测试，覆盖清除入口显隐或禁用、清除成功后的空态切换、OpenClaw session key 轮换、失败提示，以及 streaming 期间门禁。
- [x] 3.3 更新 `README.md`，说明当前支持手动清除会话上下文，以及该能力仍基于 Tesla 单会话文本主链路而非多会话管理。
- [x] 3.4 运行 `npm run lint`、`npm run typecheck`、`npm test`、`npm run build`。
