# 文档索引

`docs/` 目录保留为背景、历史、运维和验证参考，不再作为后续需求开发的第一真相。

后续 OpenSpec 开发入口在 `openspec/README.md` 和 `openspec/specs/*/spec.md`。

## 使用方式

- 需要理解当前稳定产品边界时，优先读 `openspec/specs/*/spec.md`
- 需要发起新需求时，先创建 `openspec/changes/<change-name>/`
- 需要查历史背景、部署或验证细节时，再回到本目录

## 状态说明

- 标记为“历史参考”的文档，不再作为后续实现的主依据
- 若历史文档与 `openspec/` 下的基线或活跃 change 冲突，以 `openspec/` 为准
- 仅部署、冒烟清单、当前状态记录类文档保留较强参考价值
- 凡是仍把“网页录音 / 音频上传 / ASR”写成主链路的段落，都应视为历史方案说明

## 文档分组

- 产品和技术背景
  - `tesla-openclaw-project-overview.md`
  - `tesla-openclaw-client-tech-spec.md`
  - `tesla-openclaw-current-status.md`
- 历史任务拆解
  - `tesla-openclaw-client-tasks.md`
- 历史接口和验证参考
  - `tesla-openclaw-client-api.md`
  - `tesla-openclaw-mvp-validation-plan.md`
  - `tesla-openclaw-smoke-checklist.md`
- 设计和部署参考
  - `tesla-openclaw-client-ui-design.md`
  - `tesla-openclaw-coolify-deploy.md`

## OpenSpec 映射

- 产品边界与目标设备
  - `openspec/specs/tesla-browser-boundary/spec.md`
- 认证门禁
  - `openspec/specs/shared-pin-auth/spec.md`
- 会话、消息与恢复
  - `openspec/specs/session-and-message-lifecycle/spec.md`
- 文本输入与流式回复
  - `openspec/specs/text-chat-streaming/spec.md`
- Tesla UI、滚动、键盘避让与受控 Markdown
  - `openspec/specs/tesla-chat-ui/spec.md`
