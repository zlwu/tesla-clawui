## Context

当前产品是共享 PIN 解锁后的单会话 Tesla 文本聊天主链路。前端在 `web/src/app.ts` 中持有 `sessionId`、`sessionToken`、`messages` 和 streaming 状态，并通过 `web/src/api.ts` 调用 `POST /api/text/input/stream` 与 `GET /api/messages`。聊天页顶栏当前包含两个文字 `status-pill` 和一个主题按钮。后端由 `server/src/services/text-service.ts` 在同一个 session 下读取最近历史、落库用户/助手消息，并通过 `request-log-service` 做 `requestId` 幂等复用。

“清除之前的对话上下文”不能被实现成多会话管理，也不能破坏现有 SSE streaming、最近消息恢复和 Tesla 稳定 DOM 壳体。设计重点是让用户显式地把当前会话恢复为“空历史”，同时保证正在进行的流式请求不会与清除动作并发打架。

## Goals / Non-Goals

**Goals:**
- 为当前 session 提供一个明确的清除上下文动作，清除后消息列表与持久化历史都回到空状态
- 保持当前 session 标识与授权模型不变，避免把需求扩展成多会话切换
- 保证清除后新的文本请求不再携带已清除历史
- 保证清除后发往 OpenClaw 的上游会话路由也切到新的空上下文
- 在 waiting / streaming 期间提供明确门禁，避免 SSE 与清除并发造成状态错乱
- 保持 Tesla 前端稳定 DOM 壳体与当前 SSE 主链路

**Non-Goals:**
- 不引入历史归档、回收站、撤销清除或多会话列表
- 不新增网页录音、TTS、手机协同或任何偏离当前 MVP 的产品形态
- 不把清除动作做成“重新创建 session 并切换 token”的重流程
- 不重构现有 streaming 协议或改用 WebSocket

## Decisions

### 1. 复用当前 session，只清空该 session 的消息与相关请求结果

后端新增一个“清除当前 session 上下文”的受保护接口，授权方式沿用现有 bearer `sessionToken` 与可选 `x-app-auth`。执行清除时删除当前 `sessionId` 下的消息记录，并失效化该 session 关联的文本请求幂等结果。

选择理由：当前前端持久化结构、`sessionId/sessionToken` 生命周期和最近消息恢复都围绕单会话模型建立。若改成“清除时新建 session”，前端需要同步替换 token、处理旧 session 残留、刷新恢复和潜在授权边界，复杂度明显更高，也更接近多会话模型。

替代方案：清除时创建新 session 并切换到它。优点是物理隔离强；缺点是会扩大产品语义、增加恢复与授权复杂度，因此放弃。

### 2. 清除接口使用显式写操作，而不是复用 `GET /api/messages`

后端应新增专用清除接口，例如 `POST /api/session/clear` 或 `DELETE /api/messages`，由 `sessionService` 做鉴权，再由 `messageService` / `requestLogService` 执行删除。接口返回统一成功包裹与 `sessionId`，便于前端在成功后立刻清空本地状态。

选择理由：清除是有副作用的写操作，必须与读消息接口分离，避免语义含混，也便于后续测试失败路径和并发门禁。

替代方案：在消息拉取接口上增加特殊 query 参数触发清除。该方案会混淆读写语义，放弃。

### 3. 清除入口放在顶栏右侧的 `...` 菜单中，并同步压缩顶栏状态表达

前端将清除入口放在聊天页 header 右侧的折叠 `...` 菜单中，而不是直接暴露为独立按钮。为避免 Tesla 顶栏过挤，现有“状态”和“网络”两个文字 pill 需要收敛为单个紧凑状态指示器，优先使用无边框的独立色点或小图标，而不是继续保留两个独立文字块或一个额外按钮壳体。

选择理由：清除是低频且带破坏性的全局动作，放在 `...` 菜单里更符合次级操作语义，也能降低 Tesla 触屏误触风险。无边框状态点则比按钮式状态更轻，不会和主题、菜单入口争夺视觉权重。

替代方案：把清除按钮直接放在 header 里、把清除按钮塞到 composer 旁边，或仅用纯绿点/红点表达全部状态。前两者分别存在顶栏拥挤和误触风险；最后一种在离线、错误、等待、空闲等状态之间可辨识度不足，因此都不采用。

### 4. 前端直接执行清除，并轮换独立的 OpenClaw session key
前端在现有 header 或稳定操作区中增加一个清除入口。触发后直接发起清除请求；成功时把 `state.messages` 置空、清掉重试错误和待中的本地 optimistic 状态，并保留现有 `sessionId`、`sessionToken` 与 composer 壳体。同时，客户端必须维护独立于 app session 的 `openclawSessionKey`，并在清除成功后立即轮换该 key，使后续请求命中新的一条 OpenClaw gateway 会话。

选择理由：当前渲染层已经以稳定 DOM 壳体 + 局部 patch 为原则，清除后只需要切换消息区到空态，不应通过整页重建或路由跳转来实现。与此同时，Telegram `/new` 一类语义本质上是重置上游 chat session，而不是改动本地产品 session；单独维护 OpenClaw session key 更符合这一模型，也不会丢失 agent 绑定与系统设定。

替代方案：清除后整页重新初始化应用，或重新创建本地 session 并切换 token。前者更容易打断焦点、滚动与 Tesla 键盘状态；后者会把本地授权语义和上游 gateway 会话耦在一起，因此都放弃。

### 5. Streaming 期间前后端同时加门禁

前端在 `responsePhase` 为 `waiting` 或 `streaming` 时禁用清除入口；后端也要以 session 维度拒绝清除正在进行中的文本请求，返回稳定错误码，避免旧前端或竞态请求绕过前端门禁。

选择理由：仅靠前端门禁不足以保证一致性。`text-service` 当前会在流式完成后落库用户/助手消息，若清除与落库交错，容易出现“界面已空，但旧回复又被写回”的错误状态。

替代方案：允许清除打断进行中的流。该方案需要中断 provider 流、清理 in-flight 请求和 SSE 客户端状态，超出当前范围。

### 6. 幂等结果按 session 范围失效，避免清除后复用旧回答

`request-log-service` 当前按 `requestId` 提供复用结果。清除上下文后，需要额外删除或失效化当前 session 下的文本请求记录，避免用户重新开始新话题时，仍然命中清除前遗留的结果。

选择理由：如果只删除消息，不删除 request log，后续某些重试或重复请求仍可能返回旧结果，违背“空上下文重新开始”的语义。

替代方案：仅要求前端永远生成全新 `requestId`。这无法覆盖服务端历史残留，也无法保证语义完整，因此不采用。

## Risks / Trade-offs

- [清除范围过大] 如果删除逻辑没有限制在当前 `sessionId`，会误伤其他数据。→ 通过 session 级 where 条件和服务层测试覆盖精确约束。
- [前后端状态不同步] 清除成功后若本地 optimistic 消息、错误态或 OpenClaw session key 未一起更新，界面或上游上下文会残留旧状态。→ 成功路径统一重置消息、错误、pending assistant 标识、跟随状态并轮换 session key。
- [并发竞态] 如果 streaming 请求在清除前后交错完成，可能把旧回复重新写回。→ 前端禁用 + 后端拒绝并发清除双重门禁。
- [Tesla 顶栏拥挤] 顶栏右侧同时容纳状态、主题和清除动作时容易过满。→ 将多个状态 pill 收敛为无边框状态点，并把清除动作折叠进 `...` 菜单。
- [状态过度图标化] 如果只剩一个无语义色点，用户可能无法区分离线、错误和等待回复。→ 使用“图标/色点 + 极短状态语义”的紧凑表达，而不是纯颜色编码。
- [折叠菜单 discoverability] `...` 菜单会降低清除动作的显眼程度。→ 仅把低频次级动作放进去，并保证菜单图标位置稳定、点击面积足够。

## Migration Plan

这是一次向后兼容的增量变更，不涉及数据库结构迁移。上线顺序为：先发布后端清除接口与服务逻辑，再发布前端入口与 OpenClaw session key 轮换；若需要回滚，可先隐藏前端入口，后端保留接口不会破坏现有文本主链路。

## Open Questions

- `...` 菜单中除了“清除上下文”是否还要容纳其他低频动作，目前不在本次 scope，默认只放这一项。
- 清除成功后是否展示一次性 toast 文案，还是只依赖空态消息区表达，需在实现时按现有状态反馈样式收口。
