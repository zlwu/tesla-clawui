## Purpose

定义 Tesla 车机聊天界面的稳定行为，包括输入区、消息区、受控 Markdown 渲染、滚动策略和键盘避让兼容。

## Requirements

### Requirement: 稳定的 Tesla 聊天壳体
聊天 UI MUST 为认证视图、聊天视图、textarea、PIN 输入框和消息列表保持稳定 DOM 壳体，以避免更新时破坏 Tesla 输入和滚动状态。

#### Scenario: 状态更新后重新渲染
- **WHEN** 应用在输入、解锁或流式回复期间发生状态变化
- **THEN** UI MUST 更新现有壳体节点，而不是重建整页 DOM 树

### Requirement: Composer 优先布局
Tesla 聊天界面 MUST 使用真实占位的底部 composer 布局，而不是遮挡最近消息的覆盖式浮层。

#### Scenario: 查看最近消息
- **WHEN** 聊天界面处于打开状态
- **THEN** composer MUST 占据真实布局空间，并保证最新消息仍可在其上方被看到和滚动到

#### Scenario: 展示发送动作
- **WHEN** 草稿文本为空或当前不可发送
- **THEN** 发送动作 MAY 保持视觉弱化，但 composer 布局 MUST 保持稳定

### Requirement: 感知流式状态的消息跟随行为
消息列表 MUST 默认跟随到最新内容，同时允许用户查看历史时不被强制拉回底部。

#### Scenario: 初次进入或流式回复进行中
- **WHEN** 用户首次进入聊天，或助手回复正在流式输出
- **THEN** UI MUST 默认定位到最新消息

#### Scenario: 用户手动上滑查看历史
- **WHEN** 用户离开底部位置并查看历史消息
- **THEN** UI MUST 停止强制自动跟随，直到适合恢复为止

### Requirement: 受控的助手消息渲染
助手消息 MUST 只支持受控 Markdown 子集，并且默认 MUST NOT 允许原始 HTML 透传或富媒体扩展。

#### Scenario: 渲染助手内容
- **WHEN** 助手文本包含被支持的 Markdown 特性
- **THEN** UI MUST 只渲染为安全可读性所需的受控子集

#### Scenario: 渲染不受支持的富内容
- **WHEN** 助手文本包含原始 HTML、表格、图片或不支持的复杂结构
- **THEN** UI MUST 避免把它们渲染成可执行内容或完整富文本内容

### Requirement: Tesla 键盘兼容性
UI MUST 通过保守的键盘避让行为维持 Tesla 输入可用性。

#### Scenario: `visualViewport` 信息可用
- **WHEN** Tesla 浏览器在输入框 focus 期间能提供可用的 `visualViewport` 变化
- **THEN** UI MUST 使用该信号保守调整底部留白

#### Scenario: `visualViewport` 信息不可靠
- **WHEN** Tesla 硬件上 `visualViewport` 缺失或不足以支撑布局调整
- **THEN** UI MUST 回退到基于 focus 的底部留白方案，并在 blur 后恢复布局
