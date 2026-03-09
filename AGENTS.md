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
- 语音输入是主入口
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
- `T4.6` Tesla 真机验证尚未完成

## 当前已验证结论

- 本地浏览器验证通过：页面加载、session 创建、文本发送、刷新恢复、弱网手动重试
- 语音浏览器真录音未在本地 headless 浏览器完成，因为没有真实麦克风设备
- 公网临时隧道可用但不稳定，不应当写进长期方案

## 开发约定

- 每次改动后优先执行 `npm run lint`、`npm run typecheck`、`npm test`、`npm run build`
- 先补文档再扩功能时，要同步更新 `README.md`
- 如果只是为了临时 Tesla 外网访问，可使用 `cloudflared` quick tunnel；不要把它写成产品正式依赖
