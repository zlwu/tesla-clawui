## Purpose

定义 Tesla 主聊天界面的主屏交互，包括消息跟随、composer 就近状态反馈、阶段化等待体验，以及键盘弹出期间的可达性和稳定性。

## Requirements

### Requirement: 显式的回到底部入口
Tesla 主聊天界面 MUST 在用户脱离消息列表底部时提供显式的“回到底部”入口，并用该入口恢复自动跟随。

#### Scenario: 用户手动查看历史消息
- **WHEN** 用户上滑消息列表并离开底部位置
- **THEN** UI MUST 停止自动跟随最新消息，并显示可见的回到底部入口

#### Scenario: 用户选择恢复跟随
- **WHEN** 用户触发回到底部入口
- **THEN** UI MUST 滚动到最新消息，并恢复后续流式内容的自动跟随

### Requirement: Composer 就近状态反馈
Tesla 主聊天界面 MUST 把发送中、错误恢复、离线提示等强交互状态呈现在 composer 附近，而不是只依赖远离输入区的头部状态。

#### Scenario: 用户刚发送消息且尚未收到首个增量
- **WHEN** 文本请求已经成功发出，但助手回复还未开始输出首个流式内容
- **THEN** composer 附近 MUST 显示明确的等待回复状态提示

#### Scenario: 助手正在流式回复
- **WHEN** 当前请求已发送且助手回复仍在 streaming
- **THEN** composer 附近 MUST 显示明确的忙碌状态提示

#### Scenario: 请求进入可恢复错误
- **WHEN** 文本发送或消息恢复进入可重试错误状态
- **THEN** 恢复动作 MUST 与错误提示一起呈现在 composer 附近

### Requirement: 发送后的阶段化等待反馈
Tesla 主聊天界面 MUST 在“消息已发送、等待首个回复增量”和“助手已经开始流式输出”之间提供可区分的交互状态。

#### Scenario: 请求已发出但首个回复尚未到达
- **WHEN** 用户发送消息后服务端请求已经建立，但还没有收到第一个助手文本增量
- **THEN** UI MUST 呈现单独的等待首包状态，而不能直接表现为无反馈空白

#### Scenario: 收到首个流式增量
- **WHEN** 助手回复的第一个流式文本增量到达
- **THEN** UI MUST 从等待首包状态切换为进行中的回复状态

#### Scenario: 等待首包时的轻量动画反馈
- **WHEN** UI 处于等待首包状态
- **THEN** 它 MUST 使用轻量、低噪音的等待反馈，例如 ASCII `.` / `..` / `...` 轮替，而 MUST NOT 依赖复杂 loader 作为主反馈

#### Scenario: 等待首包被首个文本或错误打断
- **WHEN** 首个流式文本增量到达，或请求进入错误状态
- **THEN** 等待首包动画 MUST 立即停止，并切换到对应的回复中或错误状态

### Requirement: 流式期间可继续整理下一条草稿
Tesla 主聊天界面 MUST 允许用户在当前助手回复 streaming 期间继续编辑草稿，同时保持单请求发送门禁。

#### Scenario: 助手 streaming 期间编辑输入框
- **WHEN** 助手正在输出回复且用户继续在 textarea 中输入
- **THEN** textarea MUST 保持可编辑，且草稿内容 MUST 被保留

#### Scenario: 助手 streaming 期间尝试再次发送
- **WHEN** 当前回复尚未结束
- **THEN** UI MUST 阻止第二次发送，并向用户呈现当前仍在等待回复的状态

### Requirement: 系统键盘安全布局
Tesla 主聊天界面 MUST 在 Tesla 车机和受支持的移动浏览器上，尽量保证 textarea、发送动作和关键状态区域不被系统输入法面板遮挡。

#### Scenario: 浏览器会在输入法弹出时缩小可用 viewport
- **WHEN** 输入框 focus 后浏览器能提供可靠的 viewport 缩小信号
- **THEN** UI MUST 基于新的可用高度重新布局消息区与 composer，而不是继续使用旧的满屏高度

#### Scenario: 浏览器无法可靠缩小 layout viewport
- **WHEN** 输入框 focus 后 layout viewport 没有可靠变化，但 `visualViewport` 或其他辅助信号可用
- **THEN** UI MUST 使用这些信号保守调整底部空间，并把 composer 保持在可操作区域内

#### Scenario: 浏览器缺少可靠 viewport 信号
- **WHEN** Tesla 车机或移动浏览器无法稳定提供足够的 viewport 信息
- **THEN** UI MUST 回退到 focus 驱动的保守避让策略，并优先保证 textarea 与发送动作可见

#### Scenario: Tesla 真机缺少可靠 viewport 信号
- **WHEN** Tesla 真机在输入框 focus 后既没有可靠的 layout viewport 缩小，也没有足够可用的 `visualViewport` 信息
- **THEN** UI MUST 使用更强的保守底部抬升量，让 textarea 大部分可见，而不是只露出少量输入区域

### Requirement: 键盘避让信号优先级
Tesla 主聊天界面 MUST 以确定性的优先级选择键盘避让信号，并避免多种补偿同时叠加。

#### Scenario: layout viewport 已可靠缩小
- **WHEN** 输入框 focus 后根容器高度已经反映真实可用 viewport
- **THEN** UI MUST 以该高度作为主布局依据，并 MUST NOT 再叠加额外的保守键盘 inset

#### Scenario: 需要退回 `visualViewport`
- **WHEN** layout viewport 没有可靠变化但 `visualViewport` 可用
- **THEN** UI MUST 仅根据 `visualViewport` 结果推导一次底部避让空间

#### Scenario: 环境存在 safe area
- **WHEN** 设备底部存在 safe area inset
- **THEN** UI MUST 同时考虑 safe area 与键盘占位，但 MUST NOT 对同一底部空间做重复累加

### Requirement: 键盘过渡期稳定性
Tesla 主聊天界面 MUST 在系统键盘弹出、收起和高度变化期间保持布局稳定，避免连续抖动和重复滚动。

#### Scenario: 键盘动画期间 viewport 连续变化
- **WHEN** 系统键盘动画导致短时间内出现多次 resize 或 viewport 更新
- **THEN** UI MUST 收敛到最后一个稳定布局结果，而不是对每次变化都立即触发新的滚动

#### Scenario: 输入中切换候选栏或输入法高度
- **WHEN** 系统输入法面板高度在输入过程中再次变化
- **THEN** UI MUST 重新计算 composer 可用空间，并保持 textarea 与发送动作持续可见

### Requirement: 输入焦点下的操作可达性
Tesla 主聊天界面 MUST 在输入焦点存在时优先保证当前输入任务可完成，而不是优先保留更多历史消息可见面积。

#### Scenario: 键盘弹出后可视高度不足
- **WHEN** 系统输入法弹出后可视高度明显压缩
- **THEN** UI MUST 优先保留 textarea、发送动作和就近状态区的可达性，即使消息区可见高度被压缩

#### Scenario: 用户在输入状态下发送
- **WHEN** 用户在输入框保持 focus 时触发发送
- **THEN** UI MUST 保持 composer 节点稳定，并避免因为状态切换造成输入区被瞬间遮挡或跳位
