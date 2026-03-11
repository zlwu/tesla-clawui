# AGENTS.md

Tesla OpenClaw 项目的后续开发必须遵守以下规则。

## 工作目录

- 所有读写、安装依赖、运行命令都只在本目录内进行
- 不要把项目文件重新散落到 workspace 根目录

## 文档优先级

发生冲突时按以下优先级执行：

1. `docs/tesla-openclaw-project-overview.md`
2. `docs/tesla-openclaw-mvp-validation-plan.md`
3. `docs/tesla-openclaw-client-tech-spec.md`
4. `docs/tesla-openclaw-client-api.md`
5. `docs/tesla-openclaw-client-tasks.md`

## 不可偏离的产品边界

- 目标设备是 Tesla 老款 Atom / MCU2 浏览器
- Tesla 单端优先
- 系统语音输入法是主入口，网页录音不进入主线
- 大字文本多轮显示是主输出
- TTS 不是首版主链路
- 手机端协同不进入 MVP

## 不可偏离的技术栈

- 前端：Vanilla TypeScript + Vite + 原生 DOM API + 手写 CSS
- 后端：Node.js + TypeScript + Fastify + Zod + Pino
- 数据层：SQLite + Drizzle ORM

## 禁止事项

- 不要引入 React / Next.js / Vue / 重型 UI 库
- 不要擅自改成双端协同方案
- 不要为了“更现代”牺牲 Tesla 浏览器兼容性
- 不要让 TTS 绑架主链路
- 不要跳过测试只追求“看起来能跑”

## 当前实现状态

- Phase 0 已完成
- Phase 1 已完成
- Phase 2 已完成
- Phase 3 已完成
- Phase 4 的开发与文档已完成
- `T4.6` Tesla 真机验证已完成，当前结论为 `Proceed with Caveats`
- 文本主链路已支持 SSE streaming
- assistant 消息已支持受控 Markdown 子集渲染
- 消息区与 composer 已收口为真实占位布局，默认定位到最新消息
- 已支持 `.env` 驱动的 shared PIN 门禁
- PIN 解锁页已收口为 6 格数字输入交互
- Tesla 键盘避让已采用 `visualViewport` 优先、focus 兜底上移的兼容方案

## 当前已验证结论

- 本地浏览器验证通过：页面加载、session 创建、文本发送、刷新恢复、弱网手动重试
- 真实 provider 联调已通过：`OpenClaw Gateway LLM`
- 本地 OpenClaw Gateway HTTP chat endpoint 已完成真实 `/api/text/input` 联调
- `npm run smoke:openclaw` 已通过真实 OpenClaw Gateway 主链路验证
- Tesla 真机已确认网页麦克风权限不可用，当前主路径为系统语音输入法 / 长按系统语音键输入
- 公网临时隧道可用但不稳定，不应当写进长期方案

## 开发约定

- 每次改动后优先执行 `npm run lint`、`npm run typecheck`、`npm test`、`npm run build`
- 先补文档再扩功能时，要同步更新 `README.md`
- 涉及文本输出体验时，默认建立在现有 SSE streaming 主链路之上，不回退到轮询或 WebSocket 重构
- Markdown 渲染只允许做受控子集增强；不要引入完整富文本、HTML 直通、表格图片等复杂能力
- 涉及消息滚动与输入区布局时，优先保持 composer 真实占位，不要回退到覆盖式浮层模型
- 涉及 Tesla 系统输入面板兼容时，优先使用标准 viewport 信号；信号缺失时允许使用 focus 驱动的保守底部偏移兜底
- 当前登录只允许做轻量 shared PIN gate；不要擅自扩成邮箱密码、OAuth 或多用户系统
- 不要重新引入网页录音、语音上传接口或 ASR 依赖；Tesla 主链路固定为系统语音输入法 + 文本发送
- 如果只是为了临时 Tesla 外网访问，可使用 `cloudflared` quick tunnel；不要把它写成产品正式依赖
