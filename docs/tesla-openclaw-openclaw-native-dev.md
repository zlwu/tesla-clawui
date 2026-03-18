# OpenClaw Native Gateway 验证基线

> 状态：当前原生 Gateway 迁移的开发/排障说明。
> 与 OpenSpec 的关系：用于支撑 `migrate-openclaw-native-chat-transport` 的本地验证，不替代 capability 规范。

## 目标

在不经过 Tesla App Server 的前提下，先直接验证可访问的 OpenClaw Gateway 的原生 WebSocket 能力，再回到本仓库验证后端桥接。这个基线可以对接本地 Gateway，也可以对接远程或共享 Gateway，不强制要求本地安装完整 OpenClaw 环境。

最小验证顺序：

1. 准备一个可访问的 OpenClaw Gateway
2. 直接对 Gateway 发起原生 `connect`
3. 直接发送一次 `chat.send`
4. 确认目标 agent 返回真实身份
5. 再启动本仓库服务做 `/api/text/input` 与 `/api/session/clear` 回归

## 最小连接参数

- `LLM_PROVIDER=openclaw`
- `LLM_BASE_URL=<OpenClaw Gateway WebSocket 地址>`
- `LLM_API_KEY=<gateway token 或 password>`
- `LLM_MODEL=openclaw`
- `OPENCLAW_AGENT_ID=main`

兼容旧配置时，服务端也会接受 `http(s)://.../v1/chat/completions` 形式的 `LLM_BASE_URL`，并在内部自动换算到 Gateway WebSocket 根地址；但当前验证基线推荐直接使用 `ws://` / `wss://` 地址，便于排障。

## 最小连接步骤

1. 准备一个可访问的 Gateway，并确认它接受 WebSocket 连接
2. 为 Gateway 准备 token 或 password
3. 在本仓库根目录复制 `.env.example` 为 `.env`
4. 把 `.env` 里的 `LLM_BASE_URL`、`LLM_API_KEY`、`OPENCLAW_AGENT_ID` 改成你的 Gateway 配置

## 直接探测 Gateway

先不要启动 Tesla App，直接运行：

```bash
npm run smoke:openclaw:gateway
```

这个脚本会：

- 直接通过 WebSocket 连接 Gateway
- 先发送 `connect`
- 使用 `chat.send` 向 `agent:<agentId>:probe_<timestamp>` 发一条最小文本
- 等待 `chat` 事件中的 `delta` / `final`
- 校验 `main/tars` 是否返回预期身份

可选环境变量：

- `OPENCLAW_GATEWAY_URL`：覆盖 Gateway 地址，默认回退到 `LLM_BASE_URL`
- `OPENCLAW_GATEWAY_TOKEN`：覆盖 Gateway token，默认回退到 `LLM_API_KEY`
- `OPENCLAW_AGENT_ID`：默认 `main`
- `SMOKE_TEXT`：覆盖探测文本
- `SMOKE_EXPECTED_IDENTITY`：默认 `tars`

## 回到 Tesla App 回归

Gateway 直连探针通过后，再运行：

```bash
npm run dev
npm run smoke:openclaw
npm run smoke:clear-context
```

预期：

- `smoke:openclaw` 证明 App Server 的 REST/SSE 桥接正常
- `smoke:clear-context` 证明同一个本地 Tesla session 在调用 `/api/session/clear` 后，上游 Gateway session 记忆已被重置

## 当前协议落点

根据 OpenClaw 官方文档与官方仓库 `docs.acp.md`，当前迁移采用的最小原生能力是：

- 握手：`connect`
- 聊天：`chat.send`
- 流式事件：`event=chat`
- 清除上下文：`sessions.reset`

当前仓库不把 WebSocket 暴露给 Tesla 前端；仍由服务端把原生 `chat` 事件桥接为现有的 `start` / `delta` / `done` SSE 语义。
