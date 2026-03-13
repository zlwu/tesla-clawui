## MODIFIED Requirements

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
