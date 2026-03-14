## Context

当前文本主链路是 `Tesla 浏览器 -> Fastify SSE route -> TextService -> LlmService -> OpenClaw Gateway/OpenAI-compatible upstream`。前端只会在自身 SSE 连接没有收到 `done` 或收到显式 `error` 时进入错误态；如果后端已经发出 `done`，前端就会把该回复视为成功完成。

问题在于当前上游流读取实现只返回“已经拼接出的文本”，没有把“是否收到明确完成信号”作为成功条件一起返回。这样一来，只要上游在吐出若干 `delta` 后静默结束，服务端仍可能把半截文本当成完整回复持久化，并向车机端发出 `done`。在 Tesla 真机场景里，浏览器端日志不可见，因此定位此类问题必须依赖后端的结构化日志，而不是前端控制台。

这个变更虽然不改产品主路径和前端 transport，但会跨越 provider、LLM service、text service、SSE route、requestId 幂等与测试层，是一次明确的后端收尾语义收口。

## Goals / Non-Goals

**Goals:**
- 把“流式成功完成”的判定从“收到了非空文本”收紧为“收到了明确 completion 信号并完成收尾”。
- 在上游流静默截断时，让服务端输出稳定、可重试的错误语义，而不是发送成功 `done`。
- 保持当前 `start -> delta -> done/error` SSE 契约和 Tesla 前端交互模型不变，让前端继续依赖统一错误恢复路径。
- 为每次上游流记录足够的后端诊断信息，让后续可以区分链路截断、Gateway 异常和模型正常停止。
- 保持 requestId 幂等模型：只有完整成功结果才进入 request log 和消息持久化。

**Non-Goals:**
- 不引入 WebSocket、轮询或前端 transport 重构。
- 不增加自动重试、断点续传或“继续生成”产品能力。
- 不修改 Tesla 车机 UI、Markdown 渲染或系统语音输入主路径。
- 不为不同 provider 引入独立的数据表或额外持久化状态机。

## Decisions

### 1. Provider 流读取必须返回“文本 + 完成性元数据”，而不是只返回字符串

流读取层将不再把 `Promise<string>` 作为唯一输出，而是返回一个带元数据的结构，例如完整文本、是否收到显式完成标记、`finish_reason`、delta 计数、累计字符数和终止原因。`LlmService` 和 `TextService` 继续把文本内容当作主数据使用，但必须同时基于该元数据判断这次流能否被视为成功完成。

这样设计的原因是“有没有文本”与“有没有完整结束”是两个不同维度。当前问题正是因为这两个维度被混在一起，导致服务端没有能力区分“模型正常说完了”和“Gateway/链路只把前半句送到了这里”。

备选方案：
- 继续返回字符串，并在 route 层通过 SSE 事件数量推断是否正常完成。否决，因为 route 并不知道上游 completion 语义，只看得到本服务已经转发出来的内容。
- 只要收到了至少一个 `delta` 就视为成功。否决，因为这正是当前半截成功问题的根源。

### 2. 只有明确完成的上游流才能触发持久化和 SSE `done`

`TextService.handleInputStream()` 将把“上游流完整结束”作为持久化用户/助手消息、写入 request log、发送终止性 `done` 事件的前置条件。如果 provider 返回“静默结束”“完成标记缺失”或其他不完整收尾信号，服务端必须抛出稳定的可重试应用错误，SSE route 统一发出 `error` 事件并关闭连接。

这样可以保证车机端只有在真正拿到可信的完整回复时才看到成功完成，避免把半截内容保存为正式 assistant 消息，也避免把错误结果缓存成某个 `requestId` 的最终答案。

备选方案：
- 保留半截内容并加一个 `partial` 标志持久化。否决，因为当前产品没有“部分回复”概念，会把异常链路泄漏到用户层。
- 让前端自行判断回复是不是说完。否决，因为前端没有上游 completion 信号，也看不到服务端到 Gateway 的链路状态。

### 3. 继续复用现有 SSE 事件类型，不扩展新的前端协议分支

这个变更不会新增 SSE 事件类型。正常成功仍然使用 `start`、`delta`、`done`；任何不完整流、上游解析异常或 provider 收尾异常都统一映射到现有 `error` 事件，沿用 `retryable: true` 的错误恢复语义。

这样做可以保持 Tesla 浏览器前端的简单性。前端当前已经能正确处理“无 `done` 的提前结束”和显式 `error`，因此最稳妥的方式是让服务端把更多上游异常转换成它已经理解的失败路径，而不是为车机再引入新的状态分支。

备选方案：
- 新增 `partial` 或 `truncated` SSE 事件。否决，因为会增加前端状态复杂度，而现有 `error` 足以表达“这次回复不可信，需要重试”。

### 4. 诊断日志放在后端 provider 与 service 边界，浏览器不承担排障职责

结构化日志将以 `requestId`、`sessionId` 为主键，记录上游 provider 名称、是否收到 completion 标记、delta 数量、累计字符数、最后一次 delta 的时间点、终止原因以及最终是 `done` 还是 `error`。日志重点放在 provider 流读取完成点和 `TextService` 决定落库/失败的边界。

这样做的原因是 Tesla 车机和用户侧浏览器日志不可获得，真正可观察的排障数据只能来自后端。把日志留在 provider 和 service 两层，可以同时看到“上游到底怎么结束的”和“本服务最终把它判成了什么结果”。

备选方案：
- 只打 route 级别日志。否决，因为 route 无法解释上游为何结束。
- 只在前端做埋点。否决，因为用户当前拿不到浏览器日志，而且前端看不到 Gateway completion 细节。

### 5. 幂等语义保持“成功结果可复用，失败结果可重试”

对 `requestId` 的处理保持现有模型：只有完整成功的请求结果才写入 request log 并可被后续重复请求复用；中断、截断或失败的流不写最终结果，因此同一 `requestId` 在后续重试时仍可重新执行，但不得产生重复持久化消息对。

这样既保持了当前手动“重试上一步”的行为，也避免因为一次静默截断把半截文本永远锁定成该 `requestId` 的最终答案。

备选方案：
- 失败请求也写入 request log，后续直接回放失败。否决，因为这会让临时弱网或 Gateway 抖动无法通过同一次用户动作恢复。

## Risks / Trade-offs

- [Risk] 某些上游 provider 的 completion 语义不完全一致，过严判定可能把原本可接受的结束方式判成失败。 → Mitigation: 先按 OpenAI-compatible 已知信号建立明确判定规则，并在日志中保留终止原因，必要时再按 provider 做有限兼容。
- [Risk] 把静默截断改成失败后，用户会看到比现在更多的显式错误。 → Mitigation: 这是有意为之；显式失败比半截成功更可恢复，也更符合车机主链路的可信度要求。
- [Risk] 新增元数据对象会触及 mock/openclaw/openai-compatible 三条 provider 路径。 → Mitigation: 保持返回结构最小化，只给流式路径新增必要字段，并用测试覆盖三类 provider。
- [Risk] 日志字段过多会增加排查成本或噪音。 → Mitigation: 只记录完成性判定所需的高价值字段，避免记录全文内容。

## Migration Plan

1. 先更新 specs，明确流式成功、错误和消息持久化的边界。
2. 调整 provider 流读取返回结构，让完成性元数据能沿 `provider -> llmService -> textService` 传递。
3. 在 `TextService` 中把持久化、request log 保存和 `onDone()` 调用都收紧到“明确完成”的路径。
4. 在 SSE route 保持现有 `error` 事件格式，并补齐针对截断路径的测试。
5. 补充结构化日志和单元/接口测试，覆盖正常完成、上游显式报错、上游静默截断三类场景。
6. 按现有工程约定执行 `npm run lint`、`npm run typecheck`、`npm test`、`npm run build`。
7. 若上线后发现对某类 provider 过严，可回退到上一版解析逻辑；该回退不会触及数据库 schema，也不需要数据迁移。

## Open Questions

- OpenClaw Gateway 当前是否稳定透传 OpenAI-compatible 的 `[DONE]` 和 `finish_reason`，还是存在需要兼容的自定义收尾形式。
- 对于“收到完整 completion 但最终文本为空”的情况，是否继续统一映射到现有 `LLM_FAILED`，还是区分更细的错误码；本 change 默认保持现有错误码稳定。
