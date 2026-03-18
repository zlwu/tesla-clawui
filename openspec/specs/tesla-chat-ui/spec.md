## Purpose

定义 Tesla 车机聊天界面的稳定行为，包括输入区、消息区、顶栏交互、受控 Markdown 渲染、滚动策略和键盘避让兼容。

## Requirements

### Requirement: 稳定的 Tesla 聊天壳体
聊天 UI MUST 为认证视图、聊天视图、textarea、PIN 输入框和消息列表保持稳定 DOM 壳体，以避免更新时破坏 Tesla 输入和滚动状态。

#### Scenario: 状态更新后重新渲染
- **WHEN** 应用在输入、解锁或流式回复期间发生状态变化
- **THEN** UI MUST 更新现有壳体节点，而不是重建整页 DOM 树

### Requirement: Composer 优先布局
Tesla 聊天界面 MUST 使用真实占位的底部 composer 布局，而不是遮挡最近消息的覆盖式浮层，并保持输入与动作区在空草稿、发送中和错误恢复状态下的稳定性。

#### Scenario: 查看最近消息
- **WHEN** 聊天界面处于打开状态
- **THEN** composer MUST 占据真实布局空间，并保证最新消息仍可在其上方被看到和滚动到

#### Scenario: 展示发送动作
- **WHEN** 草稿文本为空、当前回复仍在 streaming，或当前不可发送
- **THEN** composer 的输入壳体与动作区 MUST 保持稳定，不得因动作显隐导致布局跳变

#### Scenario: 键盘弹出时重排主界面
- **WHEN** 输入框 focus 导致可用 viewport 减少
- **THEN** composer MUST 继续占据真实布局空间，而 MUST NOT 切换为覆盖消息列表的 fixed 浮层

### Requirement: 感知流式状态的消息跟随行为
消息列表 MUST 默认跟随到最新内容，同时允许用户查看历史时不被强制拉回底部，并在离开底部后提供显式恢复跟随的入口。

#### Scenario: 初次进入或流式回复进行中
- **WHEN** 用户首次进入聊天，或助手回复正在流式输出且消息列表仍处于底部跟随状态
- **THEN** UI MUST 默认定位到最新消息

#### Scenario: 用户手动上滑查看历史
- **WHEN** 用户离开底部位置并查看历史消息
- **THEN** UI MUST 停止强制自动跟随，直到用户显式恢复跟随或重新回到底部

### Requirement: 受控的助手消息渲染
助手消息 MUST 只支持受控 Markdown 子集，并且默认 MUST NOT 允许原始 HTML 透传或富媒体扩展。

#### Scenario: 渲染助手内容
- **WHEN** 助手文本包含被支持的 Markdown 特性
- **THEN** UI MUST 只渲染为安全可读性所需的受控子集

#### Scenario: 渲染不受支持的富内容
- **WHEN** 助手文本包含原始 HTML、表格、图片或不支持的复杂结构
- **THEN** UI MUST 避免把它们渲染成可执行内容或完整富文本内容

### Requirement: 显式的清除上下文入口
Tesla 聊天界面 MUST 在主聊天视图中提供一个稳定、可触达的清除上下文入口，使用户可以主动开始一轮不受旧消息影响的新对话。

#### Scenario: 存在历史消息时展示入口
- **WHEN** 当前 session 已存在正式消息且聊天界面可交互
- **THEN** UI MUST 在顶栏右侧的折叠菜单中展示可触发的清除上下文入口，并保持现有稳定 DOM 壳体不变

#### Scenario: 当前没有消息历史
- **WHEN** 当前 session 没有正式消息
- **THEN** UI MAY 隐藏清除上下文入口，或以明确的禁用状态呈现，但 MUST NOT 误导用户为仍有可清除内容

### Requirement: 紧凑的顶栏状态表达
Tesla 聊天界面 MUST 在为清除上下文入口腾出操作空间时，把顶栏状态反馈收敛为紧凑表达，而不是并排堆叠多个宽文字状态块。

#### Scenario: 顶栏展示状态反馈
- **WHEN** 聊天主界面处于正常显示状态
- **THEN** UI MUST 使用单个紧凑状态指示器承载连接或会话状态反馈，并为清除与主题等次级操作保留稳定点击区域

#### Scenario: 状态需要区分多种语义
- **WHEN** 界面需要表达在线、离线、等待回复或错误等状态
- **THEN** UI MUST 使用图标或色点配合短语义反馈，而 MUST NOT 仅依赖无文字说明的纯颜色圆点

#### Scenario: 状态为常驻轻量提示
- **WHEN** 顶栏常驻显示状态反馈
- **THEN** 该状态指示器 MUST NOT 被渲染为带明显边框的按钮样式，而应保持为轻量的非操作性提示元素

### Requirement: 直接清除与清除后反馈
Tesla 聊天界面 MUST 支持用户直接执行清除上下文，并在清除完成后立即把消息区切换到空状态反馈。

#### Scenario: 用户执行清除
- **WHEN** 用户触发清除上下文入口
- **THEN** UI MUST 发起清除请求，并在成功后立即移除当前消息列表中的历史消息显示

#### Scenario: 清除失败
- **WHEN** 清除上下文请求失败
- **THEN** UI MUST 保留现有消息显示，并向用户呈现明确的失败提示与可重试反馈

### Requirement: 流式期间的清除门禁
Tesla 聊天界面 MUST 在助手回复等待中或 streaming 期间受控处理清除动作，以避免破坏进行中的主链路状态。

#### Scenario: 回复仍在进行中
- **WHEN** 当前文本请求仍处于 waiting 或 streaming 状态
- **THEN** UI MUST 禁止执行清除上下文，并向用户说明当前需等待回复结束

### Requirement: Tesla 键盘兼容性
UI MUST 通过保守且分层的键盘避让行为维持 Tesla 输入可用性，并在键盘收放时尽量保持用户当前阅读上下文，避免输入框、发送动作和关键状态被系统输入法面板遮挡。

#### Scenario: 输入框获得焦点
- **WHEN** 用户 focus textarea
- **THEN** UI MUST 在有限延迟内完成键盘避让计算，并把 composer 调整到可操作区域

#### Scenario: `visualViewport` 信息可用
- **WHEN** Tesla 浏览器在输入框 focus 期间能提供可用的 `visualViewport` 变化
- **THEN** UI MUST 使用该信号保守调整底部留白，并保持 composer 可见

#### Scenario: `visualViewport` 信息不可靠
- **WHEN** Tesla 硬件上 `visualViewport` 缺失或不足以支撑布局调整
- **THEN** UI MUST 回退到基于 focus 的底部留白方案，并优先保证 textarea 与发送动作不被遮挡

#### Scenario: safe area 与键盘同时存在
- **WHEN** 设备底部 safe area 与系统输入法面板同时影响布局
- **THEN** UI MUST 正确合成两者影响，避免 composer 被遮挡或底部留下重复空白

#### Scenario: 键盘收起且用户正在查看历史
- **WHEN** 用户收起键盘时消息列表并不处于底部跟随状态
- **THEN** UI MUST 回收键盘占位，但 MUST NOT 因 blur 自动把消息列表强制滚到底部

#### Scenario: 键盘收起且用户正在编辑最新一条消息
- **WHEN** 用户原本处于底部跟随状态并收起键盘
- **THEN** UI MAY 恢复到底部跟随，但 MUST 保持 composer 和最近消息之间的相对上下文稳定
