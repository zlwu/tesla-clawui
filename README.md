# Tesla OpenClaw Client MVP

面向 Tesla 老款 Atom / MCU2 浏览器的 OpenClaw 单端客户端。

## 当前范围

- Phase 0：单仓初始化、规范、配置、SQLite + Drizzle
- Phase 1：共享契约、文本聊天接口、最小大字聊天 UI
- Phase 2：语音录音、语音上传、mock ASR -> LLM、基础状态展示
- Phase 3：显式状态机、最近消息恢复、消息裁剪、前端稳定性收口
- Phase 4：统一错误模型、请求链路日志、requestId 幂等、弱网恢复、交付文档

## 当前状态

- 本地浏览器验证已通过：页面加载、文本发送、语音录音、刷新恢复、弱网手动重试
- 真实 provider 联调已通过：`Qwen ASR + OpenRouter LLM`
- 开发态与生产态都已验证可由 Fastify 单服务统一托管页面与 API
- 本地接手校验已通过：`npm run lint`、`npm run typecheck`、`npm test`、`npm run build`
- Tesla 真机主链路验证已通过，当前结论为 `Proceed with Caveats`
- 当前状态汇总见 `docs/tesla-openclaw-current-status.md`
- 当前真机 UI 重写设计见 `docs/tesla-openclaw-client-ui-design.md`
- Tesla 真机主输入路径已调整为：系统语音输入法 / 长按系统语音键输入 -> 文本框 -> 发送
- 当前输入区已收口为：单一 composer、右侧发送按钮、次级麦克风工具位
- 当前已知真机瑕疵：输入框仍会被输入面板部分遮挡

## 目录

- `packages/shared`：共享类型与 Zod schema
- `server`：Fastify + SQLite + Drizzle API
- `web`：Vite + Vanilla TypeScript 前端

## 开发命令

- `npm run dev`：统一启动开发环境；Fastify 对外提供页面与 API，前端仅做构建 watch
- `npm run dev:server`：单独启动 Fastify 服务
- `npm run dev:web`：仅执行前端静态产物 watch
- `npm run build`：构建 shared、server、web
- `npm run lint`：执行 ESLint
- `npm run typecheck`：执行 TypeScript 严格检查
- `npm run test`：执行 Vitest

## 环境变量

- 服务端配置放在项目根目录 `.env`
- 示例配置见 `.env.example`
- 默认同源访问 `/api`
- 如果前端需要直连其他 API 域名，可设置 `VITE_API_BASE_URL`

## 运行步骤

1. 在项目根准备 `.env`
2. 执行 `npm install`
3. 执行 `npm run dev`
4. 打开 `http://127.0.0.1:3000`

## 冒烟清单

1. 打开页面后可自动创建 session
2. 文本发送成功，消息能回显
3. 语音录音成功，返回 transcript 和回复
4. 刷新页面后最近消息仍可见
5. 断网后出现可解释错误，恢复网络后可点“重试上一步”
6. 相同 `requestId` 不会重复生成多份回复

真机实测请直接使用 `docs/tesla-openclaw-smoke-checklist.md`。

## 已知边界

- 真实 `ASR + LLM` 本地已验证通过，但 Tesla 真机兼容性仍未完成
- TTS、手机端协同、SSE、WebSocket 都不在 MVP
- Tesla 真机兼容性仍需按 `docs/tesla-openclaw-mvp-validation-plan.md` 实测
- `cloudflared`/临时公网隧道只用于测试，不属于正式产品方案
