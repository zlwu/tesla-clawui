## Why

当前 Tesla 主界面已经具备稳定 DOM、SSE streaming 和键盘避让能力，但核心交互仍偏“工程可用”而不是“车机场景顺手可用”。对照 ChatGPT 在 iPad 和移动网页上已经验证有效的聊天节奏，当前界面在历史浏览、回到底部、输入中状态反馈，以及输入框与系统输入法面板的遮挡处理上还有可见缺口，值得在 Tesla 边界内做一次交互收口。

## What Changes

- 调整消息列表的跟随策略，为“用户离开底部”提供明确的回到底部入口，而不是仅靠隐式阈值恢复自动滚动。
- 优化 composer 交互，减少空草稿/流式回复时的状态跳变，让发送、等待回复、错误恢复的反馈更接近成熟平板聊天产品的节奏。
- 收口聊天头部和状态呈现，减少对 Tesla 纵向空间的占用，把关键状态转移到更靠近当前操作的位置。
- 系统性改进 Tesla 与 iOS Safari/Chrome 上的键盘安全布局，优先利用真实 viewport resize，再回退到 `visualViewport` 与 focus 驱动的保守避让，避免输入框、发送动作和状态提示被系统输入法面板遮挡。
- 改进键盘收放后的滚动保持逻辑，避免用户查看历史或整理输入时被强制拉回到底部。
- 为上述行为补充规格、测试和实现任务，确保后续优化不回退到覆盖式浮层或整页重建。

## Capabilities

### New Capabilities
- `tesla-main-screen-interactions`: 定义 Tesla 主聊天界面的底部跟随、回到底部入口、composer 状态反馈，以及 Tesla 与移动浏览器上的键盘安全布局行为。

### Modified Capabilities
- `tesla-chat-ui`: 扩展现有聊天壳体规范，覆盖更细的滚动恢复、状态展示收口，以及输入框与系统输入法面板之间的遮挡处理要求。

## Impact

- Affected code: `web/index.html`, `web/src/app.ts`, `web/src/render.ts`, `web/src/state.ts`, `web/src/state-machine.ts`, `web/styles/main.css`, 相关前端测试。
- Affected specs: `openspec/specs/tesla-chat-ui/spec.md`，以及新增主界面交互 capability 的 spec。
- No backend API or dependency changes are expected; this is a Tesla-first frontend interaction refinement on top of the existing SSE text path.
