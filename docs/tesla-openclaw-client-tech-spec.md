# Tesla 车机 OpenClaw 客户端实施文档（MVP）

> 状态：历史技术背景文档，不再作为后续 OpenSpec 开发主规范。
> 当前对应 OpenSpec：`tesla-browser-boundary`、`shared-pin-auth`、`session-and-message-lifecycle`、`text-chat-streaming`、`tesla-chat-ui`
> 2026-03-11 更新：Tesla 真机已确认网页麦克风权限不可用，网页录音、语音上传与 ASR 已从当前代码主线删除。当前主路径固定为：系统语音输入法 / 长按系统语音键输入 -> 文本框 -> 发送 -> OpenClaw 文本流式回复。
## 1. 文档目标

本文档用于指导一个可运行于 **Tesla 老款 Atom / MCU2 浏览器** 上的 OpenClaw 客户端实现。

当前 MVP 的目标已经收敛为：

- 在 Tesla 浏览器上可稳定运行
- **支持系统语音输入法驱动的文本输入**
- **支持大字文本形式的多轮对话显示**
- 界面足够简洁
- 弱网下可恢复
- 便于交给 Codex 持续开发与迭代

本阶段 **不将 TTS 播放作为主链路要求**，也 **不引入手机端协同**，除非 Tesla 浏览器存在无法绕过的技术门槛。

---

## 2. 产品定位

该客户端本质上是：

> 一个运行在 Tesla 浏览器中的超轻量文本输入终端 + 服务端对话编排网关。

### 2.1 设计原则

1. **浏览器端极简**
2. **服务端承担重活**
3. **系统语音输入法优先，文本显示为主**
4. **低内存、低渲染、低依赖**
5. **不依赖 Tesla 浏览器的高级能力稳定存在**
6. **工程结构清晰，适合 AI 编程协作**

### 2.2 非目标

以下内容不在 MVP 范围内：

- 富文本聊天体验
- 复杂 Markdown 渲染
- 前端实时 ASR
- 浏览器本地 TTS 作为主链路
- 车机端自动语音播报作为必须能力
- 手机端协同 / 双端同步
- WebRTC 双工实时语音通话
- 持续唤醒词
- 多页面复杂 SPA 架构
- React / Next.js / Vue 等重型前端方案

---

## 3. 目标设备与约束

### 3.1 目标环境

- Tesla 车机浏览器
- 老款 Atom / MCU2 为首要兼容目标
- 浏览器内存与 JS 性能较弱
- 浏览器 API 支持可能不完整或不稳定

### 3.2 关键约束

1. **避免重型 JS 框架**
2. **避免大体积首屏资源**
3. **避免长消息历史渲染**
4. **避免复杂动画与频繁重绘**
5. **不要假设 Web Speech API 一定可用**
6. **不要假设麦克风权限流程与桌面 Chrome 一致**
7. **不要把 TTS 能不能稳定播放，作为 MVP 成败前提**

---

## 4. 总体架构

```text
Tesla Browser
  -> 轻量 Web 前端
  -> API Gateway / App Server
  -> LLM / OpenClaw Gateway
  -> (Optional) TTS Provider
```

### 4.1 架构说明

#### 浏览器端职责

仅负责：

- 展示最近消息
- 提交文本
- 展示有限状态信息
- 以大号文本显示最近多轮对话

#### 服务端职责

负责全部重活：

- 会话管理
- 对话上下文组装
- 调用 OpenClaw / LLM
- 可选的 TTS 合成
- 日志、错误处理、重试、限流

---

## 5. 技术栈建议

## 5.1 前端技术栈

### 推荐

- **TypeScript**
- **Vite**
- **Vanilla DOM API**
- **手写 CSS**

### 可选

- 原生 `<audio>` 播放（后续启用 TTS 时再接入）

### 不推荐

- React
- Next.js
- Vue
- 大型 UI 库
- Tailwind 大规模依赖
- 复杂状态管理框架

### 选择理由

这套方案兼顾两点：

1. 运行时轻量，适合 Tesla 浏览器
2. 类型明确，适合 Codex 持续开发

---

## 5.2 后端技术栈

### 推荐

- **Node.js**
- **TypeScript**
- **Fastify**
- **Zod** 进行请求/响应校验
- **Pino** 进行日志记录

### 可选补充

- `@fastify/cors`：如需跨域
- `undici` / 原生 `fetch`：调用外部服务

### 选择理由

- 开发效率高
- 与 OpenClaw 生态衔接自然
- 结构清晰，易于 Codex 理解与维护
- 方便后续扩展 SSE 或 provider adapter

---

## 5.3 数据库与存储

### 第一阶段推荐

- **SQLite**
- **Drizzle ORM**

### 后续可升级

- PostgreSQL

### 文件存储

- 可选的 TTS 音频缓存（非首版必需）

### 说明

MVP 优先简单落地，不要一开始上 Redis / Kafka / 对象存储三件套。

---

## 5.4 测试工具

### 推荐

- **Vitest**
- Integration tests（API）
- 少量 Playwright 冒烟测试

### 测试重点

- API 响应契约
- 错误处理
- 消息渲染与恢复
- provider mock 行为

---

## 6. 当前文本与消息链路设计

## 6.1 输入链路

### 主方案

- 用户在 Tesla 上通过系统语音输入法或手动键盘输入文本
- 服务端调用 LLM 生成回复
- 浏览器展示用户文本与助手文本

### 不采用方案

- 网页内录音 + 上传 + ASR 作为当前首版主链路
- 浏览器本地 `SpeechRecognition` 作为主链路
- WebRTC 实时音频流第一版上线

---

## 6.2 输出链路

### MVP 主方案

- 服务端返回文本结果
- 浏览器以**大字文本**展示最近对话
- 不要求默认语音播报

### 可选扩展

- 服务端生成 TTS 音频文件
- 返回文本结果和音频 URL
- 浏览器通过用户主动点击或后续策略播放

### 结论

TTS 在本阶段是**增强项**，不是主链路前提。

---

## 7. LLM / OpenClaw 接入策略

## 7.1 调用链建议

```text
Tesla Browser -> App Server -> OpenClaw / LLM Provider
```

### 原则

- 浏览器绝不直接持有模型 API key
- 所有上下文管理在服务端完成
- 服务端负责 prompt 组装、历史裁剪、错误恢复

## 7.2 会话策略

服务端维护会话：

- 每台车 / 每设备一个 sessionId
- 仅保留最近 N 轮会话
- 超过阈值进行摘要压缩
- 浏览器不加载全量历史

### 推荐保留策略

- 前端展示最近 6~8 条
- 服务端保存最近 10~30 轮
- 达到阈值时做摘要归档

---

## 8. API 设计原则

## 8.1 设计要求

- REST API 优先
- JSON 契约明确
- 所有请求/响应使用 Zod schema 定义
- 错误码统一化
- 状态字段枚举化

## 8.2 推荐接口

### 会话
- `POST /api/session/create`
- `GET /api/session/:id`

### 消息
- `POST /api/text/input`
- `GET /api/messages?sessionId=...`

### 健康检查
- `GET /api/health`

### 可选
- `GET /api/audio/:id`（后续启用 TTS 时）
- `GET /api/status?sessionId=...`
- `POST /api/text/input/stream`（已实现的文本 SSE 流式接口）
- `GET /api/events?sessionId=...`（如后续采用更通用的 SSE 状态流）

---

## 9. 前端页面形态

## 9.1 页面结构

推荐单页面布局：

1. 顶部状态栏
   - 在线/离线
   - 当前状态（空闲/思考中/错误，历史兼容状态除外）

2. 中间消息区
   - 最近 6~8 条消息
   - 用户消息保持纯文本；assistant 消息支持受控 Markdown 子集渲染
   - **大字体优先，可读性优先**

3. 底部输入区
   - 文本输入框
   - 发送按钮
   - 朗读按钮（后续可选，不进入首版必需）

## 9.2 UI 原则

- 单列布局
- 无复杂动画
- 无富文本
- 无长滚动历史
- 无大图与背景特效
- 无外部字体依赖
- 字号和对比度优先于视觉花活

---

## 10. 状态机设计

前端必须有一套简单、明确的状态机。

### 推荐状态枚举

- `idle`
- `thinking`
- `error`

### 历史兼容状态

- `recording`
- `uploading`
- `transcribing`

### 可选扩展状态

- `synthesizing`
- `playing`

### 基本流转

```text
idle
 -> thinking
 -> idle
```

### 错误流转

任意阶段失败：

```text
* -> error -> idle
```

### 实现要求

- 同一时刻仅允许一个主状态
- 错误状态必须可恢复
- `recording` / `uploading` / `transcribing` 仅作为历史兼容状态保留，不应再作为当前主线新实现的目标
- 后续若启用 TTS，再扩展播放相关状态

---

## 11. 弱网与失败恢复

必须处理以下情况：

1. 文本请求失败
2. LLM 调用失败
3. 网络暂时断开
4. 可选的 TTS 失败

### 恢复原则

- 文本请求失败：提示重试
- LLM 失败：返回明确错误提示
- 网络失败：提示当前离线/失败，不无限重试
- TTS 失败：不影响文本主链路

### 幂等建议

对 `/api/text/input` 使用 requestId，避免重复提交导致重复生成。

---

## 12. 安全与认证

## 12.1 原则

- 模型与服务 API key 仅保存在服务端
- 浏览器只拿短期 session token
- 禁止前端拼接 system prompt
- 禁止暴露管理接口

## 12.2 推荐方案

- 设备初始化后由服务端签发 session token
- token 仅用于当前设备/会话
- 服务端校验来源与会话绑定

---

## 13. 可观测性与日志

## 13.1 最少需要采集的指标

- LLM 返回耗时
- 整体端到端耗时
- 错误率
- 会话连续成功率

### 可选指标

- TTS 合成耗时
- 播放成功率

## 13.2 日志建议

- 使用 Pino
- 每次请求带 requestId
- 每次会话带 sessionId
- 记录 provider 耗时与错误信息

---

## 14. 目录结构建议

## 14.1 前端目录

```text
web/
  index.html
  src/
    main.ts
    app.ts
    api.ts
    state.ts
    types.ts
  styles/
    main.css
  assets/
    icons/
```

### 可选扩展

```text
    audio.ts
```

## 14.2 后端目录

```text
server/
  src/
    index.ts
    app.ts
    routes/
      session.ts
      text.ts
      health.ts
    services/
      session-service.ts
      llm-service.ts
      message-service.ts
    providers/
      llm/
    db/
      schema.ts
      client.ts
    lib/
      logger.ts
      config.ts
      errors.ts
      auth.ts
      ids.ts
    types/
      api.ts
```

### 可选扩展

```text
    routes/audio.ts
    services/tts-service.ts
    providers/tts/
```

---

## 15. provider adapter 设计建议

为避免未来替换供应商时大改代码，LLM 应统一走 adapter 抽象。TTS 可作为可选扩展。

## 15.1 历史 ASR Adapter 说明

> 本节仅保留为历史扩展方向记录，当前主线不要求实现 ASR adapter。

```ts
interface AsrProvider {
  transcribe(input: {
    filePath: string;
    mimeType: string;
    language?: string;
  }): Promise<{
    text: string;
    durationMs?: number;
  }>;
}
```

## 15.2 LLM Adapter

```ts
interface LlmProvider {
  reply(input: {
    sessionId: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  }): Promise<{
    text: string;
    usage?: {
      inputTokens?: number;
      outputTokens?: number;
    };
  }>;
}
```

## 15.3 可选 TTS Adapter

```ts
interface TtsProvider {
  synthesize(input: {
    text: string;
    voice?: string;
    format?: 'mp3' | 'm4a' | 'wav';
  }): Promise<{
    audioPath: string;
    mimeType: string;
    durationMs?: number;
  }>;
}
```

---

## 16. Codex 协作要求

为了让 Codex 更容易稳定实现，项目必须满足以下要求：

1. **类型优先**：所有接口与状态都有明确类型
2. **模块边界清晰**：输入、消息渲染、API、状态机分别独立
3. **文档先行**：至少包含 README、ARCHITECTURE、API、TASKS
4. **测试最小闭环**：核心状态机与接口必须可测
5. **避免隐式行为**：不要靠约定俗成的字符串和散落逻辑

---

## 17. MVP 开发优先级

## Phase 1：跑通文本主链路

目标：文本输入 + 文本回复 + 大字消息展示可用

- 会话创建
- 文本消息发送
- LLM 回复
- 消息区展示最近消息

## Phase 2：历史语音主链路阶段

> 当前主线已不再适用。本阶段仅保留为早期路线记录，不作为继续实施依据。

## Phase 3：稳定性提升

- 错误处理
- 弱网恢复
- requestId 幂等
- 端到端日志
- 页面性能与消息裁剪

## Phase 4：可选体验增强

- 可选 TTS
- 简单文本 SSE 流
- assistant 受控 Markdown 子集渲染
- 历史压缩
- 性能指标面板

---

## 18. 明确禁止事项

以下内容在 MVP 期间默认禁止：

- 引入 React / Next.js / Vue
- 引入大型 UI 组件库
- 在前端实现复杂 Markdown 渲染
- 在 streaming 稳定前过早做完整 Markdown 排版
- 在浏览器端直接调用 LLM API
- 将 API key 暴露到前端
- 在第一版引入手机协同与双端同步
- 在第一版引入 WebRTC 双工音频
- 在第一版实现持续监听或唤醒词
- 为了“现代感”牺牲性能与稳定性

---

## 19. 最终拍板方案

### 运行时技术栈

- 前端：**Vanilla TypeScript + Vite + 原生 DOM + 手写 CSS**
- 后端：**Node.js + TypeScript + Fastify + Zod + Pino**
- 数据层：**SQLite + Drizzle ORM**
- 音频输入：**不作为当前主线要求**
- 主输出：**大字文本显示**
- 模型接入：**服务端调用 OpenClaw / LLM**
- 部署：**Nginx + App Server + systemd**

### 架构结论

> Tesla 车机不是完整前端应用的运行平台，而是一个轻量语音输入终端。
>
> 前端必须尽可能薄，服务端必须承担所有复杂性；MVP 先解决“能听进去、能显示出来、能连续聊下去”，再谈播报与扩展。

---

## 20. 后续文档建议

后续建议补充以下配套文档：

1. `ARCHITECTURE.md`：系统架构与模块关系
2. `API.md`：接口请求/响应定义
3. `TASKS.md`：按阶段拆解开发任务
4. `TESTPLAN.md`：测试清单与验收标准

---

## 21. 一句话实施原则

> 运行时极简，开发时规范；先做系统语音输入法辅助输入和大字文本多轮，再考虑播报和扩展。
