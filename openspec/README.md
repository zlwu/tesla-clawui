# OpenSpec 基线

本目录是 Tesla OpenClaw 后续需求变更的主入口。

## 目标

- 用 OpenSpec capability specs 固化当前稳定产品边界
- 让后续所有变更先落到 `openspec/changes/*`，再进入实现
- 把旧 `docs/` 从“主真相”降级为背景、运维和历史参考

## 当前基线能力

- `tesla-browser-boundary`
  - 固化目标设备、MVP 边界和禁止偏离项
- `shared-pin-auth`
  - 固化共享 PIN 门禁与解锁流程
- `session-and-message-lifecycle`
  - 固化会话创建、消息持久化、上下文清除、最近消息恢复和请求幂等
- `text-chat-streaming`
  - 固化文本发送、SSE 流式回复、清除门禁、统一错误结构和流式完成语义
- `openclaw-gateway-native-chat`
  - 固化 OpenClaw Gateway 原生 chat/session 接入与 agent 路由语义
- `tesla-chat-ui`
  - 固化 Tesla 输入区、消息区、顶栏清除入口、滚动和受控 Markdown 展示要求
- `tesla-main-screen-interactions`
  - 固化主界面等待反馈、回到底部入口与 composer 就近交互

## 后续工作方式

1. 先阅读本目录下相关 capability spec。
2. 新需求或改动先创建 `openspec/changes/<change-name>/`。
3. 在 `proposal`、`design`、`tasks` 中明确改动的 capability。
4. 实现完成后归档 change，并把变更吸收到主 spec。

## 文档优先级

1. 活跃变更：`openspec/changes/<change-name>/tasks.md`、`design.md`、`proposal.md`
2. 稳定基线：`openspec/specs/*/spec.md`
3. 项目约束：`openspec/config.yaml`
4. 参考资料：`docs/README.md` 及其索引到的旧文档

## 旧文档映射

- `docs/tesla-openclaw-project-overview.md`
  - 已拆分到 `tesla-browser-boundary`、`tesla-chat-ui`
- `docs/tesla-openclaw-client-tech-spec.md`
  - 已拆分到全部 capability spec，保留为历史技术背景
- `docs/tesla-openclaw-client-api.md`
  - 已拆分到 `shared-pin-auth`、`session-and-message-lifecycle`、`text-chat-streaming`
- `docs/tesla-openclaw-client-tasks.md`
  - 不再作为实施主入口；后续以 OpenSpec change tasks 为准
- `docs/tesla-openclaw-mvp-validation-plan.md`
  - 作为验证背景保留，具体变更验证写进各 change 的 tasks

## 校验

- 查看基线能力：`openspec list --specs`
- 校验 OpenSpec 结构：`openspec validate --specs`
- 查看某个 capability：`openspec show <spec-id>`
