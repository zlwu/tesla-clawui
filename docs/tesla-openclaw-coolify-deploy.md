# Tesla OpenClaw Coolify 部署说明

适用场景：

- 单节点 VPS
- Coolify 托管
- 使用 Dockerfile 构建
- Fastify 单服务同时托管前端页面和 API

## 推荐部署形态

- 一个 Coolify Application 即可
- 不拆前端 / 后端
- SQLite 继续本地持久卷
- OpenClaw Gateway 如也部署在同机，优先走内网地址

## Coolify 基本配置

- Source：当前 Git 仓库
- Build Pack：`Dockerfile`
- Dockerfile：仓库根目录 `Dockerfile`
- Port：`3000`
- Health Check Path：`/api/health`

不建议继续优先使用 Nixpacks，因为当前项目已经涉及：

- monorepo workspaces
- `better-sqlite3` 原生依赖
- SQLite 持久化目录
- 明确的生产启动链路

这些场景下 Dockerfile 的行为更稳定、更容易排错。

## 持久化挂载

至少挂这两个目录：

- `/app/server/data`
- `/app/server/uploads`

推荐对应环境变量：

- `DATABASE_URL=./server/data/openclaw.db`
- `UPLOAD_DIR=./server/uploads`

## 生产环境变量

最小必填：

- `HOST=0.0.0.0`
- `PORT=3000`
- `AUTH_ENABLED=true`
- `AUTH_SHARED_PIN=<6位正式PIN>`
- `AUTH_SESSION_DAYS=90`
- `AUTH_TOKEN_SECRET=<高强度随机值>`
- `LLM_PROVIDER=openclaw`
- `LLM_BASE_URL=<OpenClaw Gateway 地址>`
- `LLM_API_KEY=<Gateway token>`
- `LLM_MODEL=openclaw`
- `OPENCLAW_AGENT_ID=main`
- `ASR_PROVIDER=qwen`
- `ASR_BASE_URL=https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`
- `ASR_API_KEY=<DashScope key>`
- `ASR_MODEL=qwen3-asr-flash`

建议同时保留：

- `SESSION_TOKEN_BYTES=24`
- `MESSAGE_LIMIT_DEFAULT=8`
- `MESSAGE_LIMIT_MAX=20`

## OpenClaw 网络建议

如果 OpenClaw Gateway 和应用都在同一台 VPS：

- 不要优先暴露 OpenClaw 到公网
- 优先使用容器内可达的宿主机地址
- 应用只需要能访问 `/v1/chat/completions`

例如：

- `LLM_BASE_URL=http://openclaw:18789/v1/chat/completions`
- 或 `LLM_BASE_URL=http://172.17.0.1:18789/v1/chat/completions`

实际取决于 Coolify 中 OpenClaw 的部署方式。

## 上线前检查

1. Coolify Health Check 显示正常
2. `/api/health` 返回 200
3. `server/data` 和 `server/uploads` 已挂卷
4. `AUTH_SHARED_PIN` 已换成正式值，不再使用本地测试 PIN
5. `AUTH_TOKEN_SECRET` 已设置为强随机值
6. `LLM_BASE_URL` 已指向生产 OpenClaw Gateway
7. `ASR_API_KEY` 与 `LLM_API_KEY` 已使用生产密钥

## 上线后最小回归

1. 打开首页，能看到 PIN 解锁页
2. 输入 PIN 后能进入聊天界面
3. 刷新页面后仍能恢复当前会话
4. 发送一条文本后能收到 OpenClaw 回复
5. 语音上传后能返回 transcript 和回复
6. 重启容器后历史消息仍在

## 当前不建议

- 不要先拆成多服务前后端架构
- 不要先把 SQLite 升级成外部数据库再上线
- 不要把 OpenClaw Gateway 直接裸露到公网
- 不要把 shared PIN 当成正式多用户账号系统
