## MODIFIED Requirements

### Requirement: 系统键盘安全布局
Tesla 主聊天界面 MUST 在 Tesla 车机和受支持的移动浏览器上，尽量保证 textarea、发送动作和关键状态区域不被系统输入法面板遮挡。

#### Scenario: 浏览器缺少可靠 viewport 信号
- **WHEN** Tesla 车机或移动浏览器无法稳定提供足够的 viewport 信息
- **THEN** UI MUST 回退到 focus 驱动的保守避让策略，并优先保证 textarea 与发送动作可见

#### Scenario: Tesla 真机缺少可靠 viewport 信号
- **WHEN** Tesla 真机在输入框 focus 后既没有可靠的 layout viewport 缩小，也没有足够可用的 `visualViewport` 信息
- **THEN** UI MUST 使用更强的保守底部抬升量，让 textarea 大部分可见，而不是只露出少量输入区域
