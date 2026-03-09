# Tesla OpenClaw Client MVP

面向 Tesla 老款 Atom / MCU2 浏览器的 OpenClaw 单端客户端。

## 当前范围

- Phase 0：单仓初始化、规范、配置、SQLite + Drizzle
- Phase 1：共享契约、文本聊天接口、最小大字聊天 UI
- Phase 2：语音录音、语音上传、mock ASR -> LLM、基础状态展示
- Phase 3：显式状态机、最近消息恢复、消息裁剪、前端稳定性收口
- Phase 4：统一错误模型、请求链路日志、requestId 幂等、弱网恢复、交付文档

## 当前状态

- 本地浏览器验证已通过：页面加载、文本发送、刷新恢复、弱网手动重试
- Tesla 真机验证还没做完
- 当前状态汇总见 `docs/tesla-openclaw-current-status.md`

## 目录

- `packages/shared`：共享类型与 Zod schema
- `server`：Fastify + SQLite + Drizzle API
- `web`：Vite + Vanilla TypeScript 前端

## 开发命令

- `npm run dev:server`：启动 Fastify API
- `npm run dev:web`：启动 Vite 前端
- `npm run build`：构建 shared、server、web
- `npm run lint`：执行 ESLint
- `npm run typecheck`：执行 TypeScript 严格检查
- `npm run test`：执行 Vitest

## 环境变量

- 服务端配置放在项目根目录 `.env`
- 示例配置见 `.env.example`
- 前端默认通过 Vite 代理访问 `/api`
- 如果前端需要直连其他 API 域名，可设置 `VITE_API_BASE_URL`

## 运行步骤

1. 在项目根准备 `.env`
2. 执行 `npm install`
3. 执行 `npm run dev:server`
4. 执行 `npm run dev:web`
5. 打开 Vite 提示的本地地址

## 冒烟清单

1. 打开页面后可自动创建 session
2. 文本发送成功，消息能回显
3. 语音录音成功，返回 transcript 和回复
4. 刷新页面后最近消息仍可见
5. 断网后出现可解释错误，恢复网络后可点“重试上一步”
6. 相同 `requestId` 不会重复生成多份回复

## 已知边界

- 默认使用 `mock` ASR 和 `mock` LLM，优先保证链路稳定
- TTS、手机端协同、SSE、WebSocket 都不在 MVP
- Tesla 真机兼容性仍需按 `docs/tesla-openclaw-mvp-validation-plan.md` 实测
- `cloudflared`/临时公网隧道只用于测试，不属于正式产品方案
