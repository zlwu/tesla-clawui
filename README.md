# Tesla OpenClaw Client MVP

面向 Tesla 老款 Atom / MCU2 浏览器的 OpenClaw 单端客户端。

## 文档入口

- 后续需求开发主入口：`openspec/README.md`
- 当前稳定能力基线：`openspec/specs/*/spec.md`
- 历史与运维参考：`docs/README.md`

## OpenSpec 开发流程

1. 先阅读相关 `openspec/specs/*/spec.md`，确认当前稳定基线。
2. 新需求、行为变更或范围调整，先创建 `openspec/changes/<change-name>/`。
3. 在 change 下完成 `proposal.md`、`design.md`、`tasks.md`，再进入实现。
4. 实现完成并验证通过后，归档 change，并把变更吸收到主 spec。

如果 `docs/` 中的历史文档与 OpenSpec 基线冲突，以 `openspec/` 为准。

## 当前范围

- Phase 0：单仓初始化、规范、配置、SQLite + Drizzle
- Phase 1：共享契约、文本聊天接口、最小大字聊天 UI
- Phase 2：文本主链路完善、系统语音输入提示、基础状态展示
- Phase 3：显式状态机、最近消息恢复、消息裁剪、前端稳定性收口
- Phase 4：统一错误模型、请求链路日志、requestId 幂等、弱网恢复、交付文档

## 当前状态

- 本地浏览器验证已通过：页面加载、文本发送、刷新恢复、弱网手动重试
- 真实 provider 联调已通过：`OpenClaw Gateway LLM`
- 本地 OpenClaw Gateway 原生 chat/session 已完成真实 `/api/text/input` 联调
- 文本主链路已支持 SSE streaming，assistant 回复可边输出边显示
- 服务端已校验上游流式 completion 信号，只有明确完成的回复才会落库并返回 `done`
- 当前聊天页已支持从右上角 `...` 菜单手动清除当前会话上下文；该能力会同时清空服务端 session 消息历史与本地最近消息缓存
- assistant 消息已支持受控 Markdown 子集渲染：标题、列表、引用、粗体、行内代码、代码块
- 消息区与输入区布局已收口为真实占位底栏；初始进入和流式输出默认定位到最新消息
- 已支持基于 `.env` 的 shared PIN 门禁，解锁后再进入当前 Tesla 会话
- PIN 解锁输入已收口为 6 格数字输入，支持自动跳位、回退和一次性粘贴
- 开发态与生产态都已验证可由 Fastify 单服务统一托管页面与 API
- 本地接手校验已通过：`npm run lint`、`npm run typecheck`、`npm test`、`npm run build`
- Tesla 真机主链路验证已通过，当前结论为 `Proceed with Caveats`
- 当前状态汇总见 `docs/tesla-openclaw-current-status.md`
- 当前真机 UI 重写设计见 `docs/tesla-openclaw-client-ui-design.md`
- Tesla 真机主输入路径已调整为：系统语音输入法 / 长按系统语音键输入 -> 文本框 -> 发送
- 当前输入区已收口为：单一 composer、右侧发送按钮、系统语音输入提示
- 当前消息滚动策略已收口为：初始定位到底部、streaming 默认跟随、用户手动上滑后停止强制跟随
- 当前主界面交互已收口为：发送后分离“等待首包”和“正在回复”两段状态，等待首包使用轻量 ASCII 点动画提示
- 当前顶栏交互已收口为：轻量状态提示、主题按钮和 `...` 折叠菜单；`清除上下文` 仍基于 Tesla 单会话文本主链路，不扩展为多会话管理
- 当前 Tesla / iOS 键盘避让策略已收口为：优先吃 layout viewport resize，其次 `visualViewport`，最后才退回 focus 驱动保守底部留白
- 当前渲染层已切到稳定 DOM 壳体 + 局部 patch，以保住焦点、滚动和 streaming 期间的节点稳定性
- 若出现“回复说到一半停止但车机端无浏览器日志”的排障场景，当前应优先查看后端结构化日志中的上游流 completion 诊断字段

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
- `npm run smoke:openclaw:gateway`：直接对 OpenClaw Gateway 做一次原生 WebSocket 探针
- `npm run smoke:openclaw`：对当前运行中的服务执行一次 OpenClaw 文本主链路冒烟
- `npm run smoke:clear-context`：验证清除上下文后，同一个本地 session 的上游 Gateway 记忆已被重置
- `openspec list --specs`：查看当前 OpenSpec capability 基线
- `openspec validate --specs`：校验 OpenSpec 基线结构

## 环境变量

- 服务端配置放在项目根目录 `.env`
- 示例配置见 `.env.example`
- 默认同源访问 `/api`
- 如果前端需要直连其他 API 域名，可设置 `VITE_API_BASE_URL`
- 如需启用 shared PIN 门禁，可设置 `AUTH_ENABLED=true`、`AUTH_SHARED_PIN=6位数字PIN`
- 当前推荐 LLM 配置为 `LLM_PROVIDER=openclaw`
- OpenClaw 使用 `LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL`，可选 `OPENCLAW_AGENT_ID`
- 本地新基线推荐把 `LLM_BASE_URL` 直接设为 Gateway WebSocket 地址，例如 `ws://127.0.0.1:18789`

## 运行步骤

1. 在项目根准备 `.env`
2. 执行 `npm install`
3. 执行 `npm run dev`
4. 打开 `http://127.0.0.1:3000`

## Coolify 部署

推荐直接使用仓库内的 `Dockerfile` 部署到 Coolify。
详细步骤见 `docs/tesla-openclaw-coolify-deploy.md`。
仓库已提供 `Dockerfile` 与 `.dockerignore`，可以直接交给 Coolify 构建。

## 冒烟清单

1. 打开页面后可自动创建 session
2. 文本发送成功，消息能回显
3. 文本发送后返回 OpenClaw 回复
4. 刷新页面后最近消息仍可见
5. 断网后出现可解释错误，恢复网络后可点“重试上一步”
6. 相同 `requestId` 不会重复生成多份回复

真机实测请直接使用 `docs/tesla-openclaw-smoke-checklist.md`。
本地原生 Gateway 调试基线见 `docs/tesla-openclaw-openclaw-native-dev.md`。

如需先绕过 App Server 直连验证 Gateway 本身，可执行：

```bash
npm run smoke:openclaw:gateway
```

本地 OpenClaw 文本主链路可执行：

```bash
npm run smoke:openclaw
```

如需验证“清除上下文”是否真的重置了同一个 Tesla session 背后的上游 Gateway 会话，可执行：

```bash
npm run smoke:clear-context
```

这个脚本会在同一个本地 session 下连续发送多次请求：
- 先确认 agent 仍能稳定回答自己的固定身份
- 再在同一个 Tesla session 背后的上游 Gateway session 中写入一条临时暗号并验证它确实记住了
- 中间调用一次 `/api/session/clear`
- 清除后继续在同一个本地 Tesla session 下发送，验证 agent 身份仍保留，但刚才那条临时暗号记忆不再存在

可选环境变量：

- `SMOKE_BASE_URL`：默认 `http://127.0.0.1:3000`
- `SMOKE_TEXT`：自定义本次冒烟发送的文本

## 主界面交互模型

- 消息区与 composer 保持在正常文档流中，不使用覆盖式 fixed 浮层；“回到底部”入口锚定在 composer 上方，随 composer 一起移动。
- 用户离开底部查看历史时，会停止强制自动跟随，并显示“回到底部”入口。
- 用户发送消息后，界面先进入“等待首包”状态；assistant 占位区显示 `正在等待回复.` / `..` / `...` 的轻量 ASCII 点轮替。
- 收到第一个流式文本增量后，等待提示立即停止，真实回复文本接管消息区；composer 保持安静，只承担输入与发送动作本身。
- 流式回复期间 textarea 保持可编辑，但发送动作会继续门禁，直到当前回复结束或失败。
- 当前会话如需重新开始，可从右上角 `...` 菜单选择 `清除上下文`；成功后刷新或重新进入同一 session 也不会恢复已清除历史。

## 手工验证清单

以下清单适用于 Tesla 真机、iOS Safari 和 iOS Chrome：

1. focus 输入框后，composer、发送动作和状态提示都仍可见，不被系统输入法面板遮挡。
2. 输入法弹出后，页面仍保持单一消息滚动容器；composer 没有切成覆盖消息区的浮层。
3. 发送消息后，用户消息立刻入列，assistant 占位区出现“正在等待回复...” ASCII 点动画。
4. 首个流式文本到达后，ASCII 等待动画立即停止，并切到真实回复文本。
5. 流式回复期间 textarea 仍可继续编辑，但发送按钮保持不可再次触发。
6. 手动上滑查看历史时，自动跟随停止，并出现锚定在 composer 上方的“回到底部”图标入口。
7. 在查看历史的同时收到新回复时，消息列表不会强制跳到底部；点击“回到底部”后恢复跟随。
8. 键盘收起时，如果原本正在查看历史，页面不会被强制拉回到底部。
9. 键盘收起时，如果原本处于底部跟随状态，最近消息与 composer 的相对上下文保持稳定。
10. iOS Safari / Chrome 上切换候选栏或输入法高度变化时，composer 不出现双重抬升或底部空白残留。

## 已知边界

- 真实 `LLM` 本地已验证通过，Tesla 真机文本主链路也已验证通过
- 当前 LLM 主链路已切换为本地 OpenClaw Gateway；如需回退，可改回 `openai-compatible`
- TTS、手机端协同、WebSocket 都不在 MVP
- 当前已落地的流式能力限定为文本 SSE streaming，不扩展为 WebSocket 对话架构
- Markdown 渲染当前仅限 assistant 消息的受控子集，不支持 HTML 直通、表格、图片和复杂嵌套语法
- 当前 `renderApp()` 已切到固定壳体 + keyed message patch，不再做整页 `innerHTML` 重建
- 当前登录能力仅为 shared PIN 门禁，不是多用户账号体系；适合单环境 / 小范围固定用户使用
- Tesla 真机当前结论为 `Proceed with Caveats`，仍可继续按 `docs/tesla-openclaw-mvp-validation-plan.md` 补充后续回归与优化验证
- Tesla 真机网页麦克风权限不可用，因此网页录音与 ASR 已从主线删除，首版真机主路径固定为系统语音输入法 / 长按系统语音键输入
- `cloudflared`/临时公网隧道只用于测试，不属于正式产品方案

## OpenClaw 接入

- 当前仓库默认按本地 OpenClaw Gateway 联调
- 将 `LLM_PROVIDER` 设为 `openclaw`
- 将 `LLM_BASE_URL` 设为 OpenClaw Gateway 的 WebSocket 根地址，例如 `ws://127.0.0.1:18789`
- 将 `LLM_API_KEY` 设为 Gateway token 或 password 对应 bearer token
- 将 `LLM_MODEL` 设为 `openclaw` 或 `openclaw:<agentId>`
- 如需固定 agent，也可设置 `OPENCLAW_AGENT_ID`，服务端会自动把它编码到 `LLM_MODEL`
- 当前 OpenClaw 路径默认依赖 agent 自身的人设与系统设定；服务端不会再额外注入一层通用 `system prompt` 去覆盖它
- 当前 OpenClaw 路径的会话记忆默认交给 Gateway session 管理；服务端会把本地 Tesla session 映射到固定的上游 `sessionKey`，前端不再直接持有或传递 `openclawSessionKey`
- 当前实现通过原生 `connect` / `chat.send` / `sessions.reset` 与 Gateway 交互，再由服务端把原生 `chat` 事件桥接回现有 SSE `start` / `delta` / `done` 协议
